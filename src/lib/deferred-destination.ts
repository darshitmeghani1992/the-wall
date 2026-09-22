import AsyncStorage from "@react-native-async-storage/async-storage";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { DEFERRED_DESTINATION_STORAGE_KEY, deferredRecordIsExpired, destinationScreenIdentity, isCanonicalUuid, parseDeferredDestinationUrl, parseStoredDeferredDestination, sameDeferredScreen, serializeDeferredDestinationRecord, type DeferredAttemptToken, type DeferredDestination, type DeferredNavigationRef, type DeferredScreenIdentity, type DeferredSubject, type StoredDeferredDestinationV1 } from "./deferred-destination-contract.ts";

export type DeferredStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

type ActiveAttempt = {
  token: DeferredAttemptToken;
  snapshot: string;
  subject: string;
  generation: number;
  expectedScreen: DeferredScreenIdentity;
  navigated: boolean;
};

type NavigationReference = {
  token: DeferredAttemptToken;
  subject: string;
  generation: number;
  expectedScreen: DeferredScreenIdentity;
};

export type DeferredPrepareResult =
  | { status: "none" }
  | { status: "navigate"; href: string; navigationRef: DeferredNavigationRef }
  | { status: "terminal_unavailable"; href: string; navigationRef: DeferredNavigationRef }
  | { status: "durable_disabled" }
  | { status: "in_flight" };

function normalizeSubject(subject: DeferredSubject): DeferredSubject {
  return subject.status === "authenticated"
    ? { status: "authenticated", userId: subject.userId.toLowerCase() }
    : subject;
}

function secureOpaqueValue(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") {
    return `${cryptoApi.randomUUID()}${cryptoApi.randomUUID()}`.replaceAll("-", "");
  }
  if (typeof cryptoApi?.getRandomValues === "function") {
    const bytes = new Uint8Array(32);
    cryptoApi.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  // `expo-auth-session` already installs this native CSPRNG; no dependency or native config is added.
  const expoCrypto = require("expo-crypto") as typeof import("expo-crypto");
  const bytes = new Uint8Array(32);
  expoCrypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hrefForScreen(
  screen: DeferredScreenIdentity,
  navigationRef: DeferredNavigationRef,
  subject: string,
): string {
  const ref = encodeURIComponent(navigationRef);
  switch (screen.kind) {
    case "handle": return `/u/${encodeURIComponent(screen.handle)}?__deferred_ref=${ref}`;
    case "personal": {
      const path = screen.ownerId === subject ? "/(tabs)/home" : `/person/${screen.ownerId}`;
      const focus = screen.focusMarkId ? `focusMark=${screen.focusMarkId}&` : "";
      return `${path}?${focus}__deferred_ref=${ref}`;
    }
    case "shared": {
      const focus = screen.focusMarkId ? `focusMark=${screen.focusMarkId}&` : "";
      return `/shared/${screen.wallId}?${focus}__deferred_ref=${ref}`;
    }
    case "shared_invite": return `/shared/invite/${screen.wallId}?__deferred_ref=${ref}`;
    case "unavailable": return `/deferred-destination-unavailable?__deferred_ref=${ref}`;
  }
}

/**
 * One serialized owner for durable intent state and process-only attempts. The class is exported
 * only so contract tests can inject storage/failures; app code uses the singleton functions below.
 */
export class DeferredDestinationCoordinator {
  private queue: Promise<void> = Promise.resolve();
  private durableDisabled = false;
  private generation = 0;
  private active: ActiveAttempt | null = null;
  private references = new Map<DeferredNavigationRef, NavigationReference>();
  private currentSubject: DeferredSubject = { status: "unknown" };
  private readonly storage: DeferredStorage;
  private readonly clock: () => number;
  private readonly randomValue: () => string;

  constructor(
    storage: DeferredStorage,
    clock: () => number = Date.now,
    randomValue: () => string = secureOpaqueValue,
  ) {
    this.storage = storage;
    this.clock = clock;
    this.randomValue = randomValue;
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.catch(() => undefined).then(operation);
    this.queue = result.then(() => undefined, () => undefined);
    return result;
  }

  private invalidateAttempts(): void {
    this.generation += 1;
    this.active = null;
    this.references.clear();
  }

  private quarantine(): void {
    this.durableDisabled = true;
    this.currentSubject = { status: "unknown" };
    this.invalidateAttempts();
  }

  private randomToken(): DeferredAttemptToken {
    return this.randomValue() as DeferredAttemptToken;
  }

  private randomReference(): DeferredNavigationRef {
    return this.randomValue() as DeferredNavigationRef;
  }

  private createReference(active: ActiveAttempt): { href: string; navigationRef: DeferredNavigationRef } {
    const navigationRef = this.randomReference();
    this.references.set(navigationRef, {
      token: active.token,
      subject: active.subject,
      generation: active.generation,
      expectedScreen: active.expectedScreen,
    });
    return { href: hrefForScreen(active.expectedScreen, navigationRef, active.subject), navigationRef };
  }

  private activate(snapshot: string, subject: string, screen: DeferredScreenIdentity): ActiveAttempt {
    this.invalidateAttempts();
    const active: ActiveAttempt = {
      token: this.randomToken(),
      snapshot,
      subject,
      generation: this.generation,
      expectedScreen: screen,
      navigated: false,
    };
    this.active = active;
    return active;
  }

  async capture(rawUrl: string, currentSubject: DeferredSubject, nowMs = this.clock()): Promise<"captured" | "rejected"> {
    const destination = parseDeferredDestinationUrl(rawUrl);
    const normalized = normalizeSubject(currentSubject);
    if (!destination || normalized.status === "unknown"
      || (normalized.status === "authenticated" && !isCanonicalUuid(normalized.userId))
      || !Number.isSafeInteger(nowMs) || nowMs < 0) return "rejected";
    return this.enqueue(async () => {
      if (this.durableDisabled) return "rejected";
      const record: StoredDeferredDestinationV1 = {
        version: 1,
        capturedAtMs: nowMs,
        boundSubject: normalized.status === "authenticated" ? normalized.userId : null,
        destination,
      };
      try {
        await this.storage.setItem(DEFERRED_DESTINATION_STORAGE_KEY, serializeDeferredDestinationRecord(record));
      } catch {
        this.quarantine();
        return "rejected";
      }
      this.currentSubject = normalized;
      this.invalidateAttempts();
      return "captured";
    });
  }

  async prepare(subject: string, nowMs = this.clock()): Promise<DeferredPrepareResult> {
    const normalizedSubject = subject.toLowerCase();
    if (!isCanonicalUuid(normalizedSubject)) return { status: "durable_disabled" };
    return this.enqueue(async () => {
      if (this.durableDisabled) return { status: "durable_disabled" };
      let snapshot: string | null;
      try { snapshot = await this.storage.getItem(DEFERRED_DESTINATION_STORAGE_KEY); }
      catch { this.quarantine(); return { status: "durable_disabled" }; }
      if (snapshot === null) return { status: "none" };

      const record = parseStoredDeferredDestination(snapshot);
      const terminal = !record || deferredRecordIsExpired(record, nowMs);
      if (record?.boundSubject && record.boundSubject !== normalizedSubject) {
        try { await this.storage.removeItem(DEFERRED_DESTINATION_STORAGE_KEY); }
        catch { this.quarantine(); return { status: "durable_disabled" }; }
        this.invalidateAttempts();
        return { status: "none" };
      }
      if (record && !terminal) {
        if (record.boundSubject === null) {
          const bound = { ...record, boundSubject: normalizedSubject };
          snapshot = serializeDeferredDestinationRecord(bound);
          try { await this.storage.setItem(DEFERRED_DESTINATION_STORAGE_KEY, snapshot); }
          catch { this.quarantine(); return { status: "durable_disabled" }; }
        }
      }

      if (this.active && this.active.snapshot === snapshot && this.active.subject === normalizedSubject) {
        return this.active.navigated ? { status: "in_flight" } : { status: "none" };
      }
      let active: ActiveAttempt;
      try {
        active = this.activate(
          snapshot,
          normalizedSubject,
          terminal ? { kind: "unavailable" } : destinationScreenIdentity(record!.destination),
        );
      } catch {
        this.quarantine();
        return { status: "durable_disabled" };
      }
      active.navigated = true;
      let reference: { href: string; navigationRef: DeferredNavigationRef };
      try { reference = this.createReference(active); }
      catch { this.quarantine(); return { status: "durable_disabled" }; }
      return terminal
        ? { status: "terminal_unavailable", ...reference }
        : { status: "navigate", ...reference };
    });
  }

  async reconcile(previousSubject: DeferredSubject, nextSubject: DeferredSubject): Promise<void> {
    const previous = normalizeSubject(previousSubject);
    const next = normalizeSubject(nextSubject);
    await this.enqueue(async () => {
      if (this.durableDisabled) return;
      if (next.status === "unknown") { this.quarantine(); return; }
      if (next.status === "authenticated" && !isCanonicalUuid(next.userId)) { this.quarantine(); return; }
      // Automatic expiry preserves the bound record for same-account reauthentication.
      if (previous.status === "authenticated" && next.status === "signed_out") {
        this.currentSubject = next;
        this.invalidateAttempts();
        return;
      }
      if (next.status === "signed_out") {
        this.currentSubject = next;
        this.invalidateAttempts();
        return;
      }

      let raw: string | null;
      try { raw = await this.storage.getItem(DEFERRED_DESTINATION_STORAGE_KEY); }
      catch { this.quarantine(); return; }
      if (raw !== null) {
        const record = parseStoredDeferredDestination(raw);
        const definiteAccountSwitch = previous.status === "authenticated" && previous.userId !== next.userId;
        if ((record?.boundSubject && record.boundSubject !== next.userId) || (!record && definiteAccountSwitch)) {
          try { await this.storage.removeItem(DEFERRED_DESTINATION_STORAGE_KEY); }
          catch { this.quarantine(); return; }
        } else if (record?.boundSubject === null) {
          try {
            await this.storage.setItem(DEFERRED_DESTINATION_STORAGE_KEY, serializeDeferredDestinationRecord({
              ...record,
              boundSubject: next.userId,
            }));
          } catch { this.quarantine(); return; }
        }
      }
      this.currentSubject = next;
      if (previous.status !== "authenticated" || previous.userId !== next.userId) this.invalidateAttempts();
    });
  }

  async clearForExplicitSignOut(): Promise<void> {
    // Quarantine happens synchronously before the first await, so sign-out can never race a read.
    this.quarantine();
    await this.enqueue(async () => {
      try { await this.storage.removeItem(DEFERRED_DESTINATION_STORAGE_KEY); } catch { /* Retry after sign-out. */ }
    });
  }

  async retryExplicitSignOutScrub(): Promise<void> {
    await this.enqueue(async () => {
      try { await this.storage.removeItem(DEFERRED_DESTINATION_STORAGE_KEY); } catch { /* Remain quarantined. */ }
    });
  }

  claimReference(
    navigationRef: DeferredNavigationRef,
    exactScreen: DeferredScreenIdentity,
    subject: string,
  ): DeferredAttemptToken | null {
    if (this.durableDisabled) return null;
    const reference = this.references.get(navigationRef);
    this.references.delete(navigationRef);
    const active = this.active;
    if (!reference || !active || reference.token !== active.token || reference.generation !== active.generation
      || reference.subject !== subject.toLowerCase() || active.subject !== subject.toLowerCase()
      || !sameDeferredScreen(reference.expectedScreen, exactScreen)
      || !sameDeferredScreen(active.expectedScreen, exactScreen)) return null;
    return active.token;
  }

  private transfer(token: DeferredAttemptToken, exactTarget: DeferredScreenIdentity): { href: string; navigationRef: DeferredNavigationRef } | null {
    const active = this.active;
    if (this.durableDisabled || !active || active.token !== token) return null;
    this.references.clear();
    active.expectedScreen = exactTarget;
    try { return this.createReference(active); }
    catch { this.quarantine(); return null; }
  }

  transferHandleTarget(token: DeferredAttemptToken, exactTarget: DeferredScreenIdentity) {
    if (exactTarget.kind !== "personal") return null;
    return this.transfer(token, exactTarget);
  }

  transferToUnavailable(token: DeferredAttemptToken) {
    return this.transfer(token, { kind: "unavailable" });
  }

  private async acknowledge(token: DeferredAttemptToken, expected: "destination" | "unavailable"): Promise<boolean> {
    return this.enqueue(async () => {
      const active = this.active;
      if (this.durableDisabled || !active || active.token !== token
        || (expected === "unavailable") !== (active.expectedScreen.kind === "unavailable")) return false;
      let current: string | null;
      try { current = await this.storage.getItem(DEFERRED_DESTINATION_STORAGE_KEY); }
      catch { this.quarantine(); return false; }
      if (current !== active.snapshot) return false;
      try { await this.storage.removeItem(DEFERRED_DESTINATION_STORAGE_KEY); }
      catch { this.quarantine(); return false; }
      this.invalidateAttempts();
      return true;
    });
  }

  acknowledgeArrival(token: DeferredAttemptToken): Promise<boolean> {
    return this.acknowledge(token, "destination");
  }

  acknowledgeUnavailable(token: DeferredAttemptToken): Promise<boolean> {
    return this.acknowledge(token, "unavailable");
  }

  async retry(token: DeferredAttemptToken): Promise<boolean> {
    return this.enqueue(async () => Boolean(!this.durableDisabled && this.active?.token === token));
  }
}

const coordinator = new DeferredDestinationCoordinator(AsyncStorage);

export const captureDeferredDestinationUrl = (rawUrl: string, subject: DeferredSubject, nowMs?: number) => coordinator.capture(rawUrl, subject, nowMs);
export const prepareDeferredDestinationResume = (subject: string, nowMs?: number) => coordinator.prepare(subject, nowMs);
export const reconcileDeferredDestinationIdentity = (previous: DeferredSubject, next: DeferredSubject) => coordinator.reconcile(previous, next);
export const clearDeferredDestinationForExplicitSignOut = () => coordinator.clearForExplicitSignOut();
export const retryDeferredDestinationSignOutScrub = () => coordinator.retryExplicitSignOutScrub();
export const claimDeferredAttemptReference = (navigationRef: DeferredNavigationRef, exactScreen: DeferredScreenIdentity, subject: string) => coordinator.claimReference(navigationRef, exactScreen, subject);
export const transferDeferredHandleTarget = (token: DeferredAttemptToken, exactTarget: DeferredScreenIdentity) => coordinator.transferHandleTarget(token, exactTarget);
export const transferDeferredAttemptToUnavailable = (token: DeferredAttemptToken) => coordinator.transferToUnavailable(token);
export const acknowledgeDeferredArrival = (token: DeferredAttemptToken) => coordinator.acknowledgeArrival(token);
export const acknowledgeDeferredUnavailable = (token: DeferredAttemptToken) => coordinator.acknowledgeUnavailable(token);
export const retryDeferredDestination = (token: DeferredAttemptToken) => coordinator.retry(token);

export function deferredSubjectForUserId(userId: string | null | undefined): DeferredSubject {
  return userId ? { status: "authenticated", userId } : { status: "signed_out" };
}

export function destinationForDeferredResolution(
  destination: DeferredDestination,
): DeferredScreenIdentity {
  return destinationScreenIdentity(destination);
}
