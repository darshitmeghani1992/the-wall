import { useCallback, useEffect, useRef, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/auth";
import { getProfileByHandle } from "@/lib/profiles";
import {
  claimDeferredAttemptReference,
  retryDeferredDestination,
  transferDeferredAttemptToUnavailable,
  transferDeferredHandleTarget,
} from "@/lib/deferred-destination";
import type { DeferredAttemptToken, DeferredNavigationRef } from "@/lib/deferred-destination-contract";
import { resolveDeferredDestination } from "@/lib/deferred-destination-resolver";
import { TargetRouteFence } from "@/lib/relationship-ui";
import { SessionFocusFence } from "@/lib/session-generation";
import { handleLinkSubjectKey, sameHandleLinkSubject } from "@/lib/handle-link-scope";
import { personalWallDeepLink } from "@/lib/share-contract";
import { colors, markColors } from "@/theme";

function Spinner() {
  return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}><ActivityIndicator color={markColors.brandYellow} /></View>;
}

type ClaimedAttempt = { reference: string; subjectKey: string; token: DeferredAttemptToken | null };
type ResolvedView =
  | { subjectKey: string; status: "target"; href: string }
  | { subjectKey: string; status: "retryable" | "not_found" };

export default function HandleLink() {
  const router = useRouter();
  const { handle, __deferred_ref: rawReference } = useLocalSearchParams<{ handle: string; __deferred_ref?: string }>();
  const clean = String(handle ?? "").replace(/^@/, "").toLowerCase();
  const validHandle = personalWallDeepLink(clean) === `thewall://u/${clean}`;
  const reference = typeof rawReference === "string" ? rawReference : null;
  const { loading, session, accountRoute } = useAuth();
  const subjectKey = handleLinkSubjectKey(session?.user.id, clean, reference, validHandle && accountRoute === "ready");
  const [resolvedView, setResolvedView] = useState<ResolvedView | null>(null);
  const [attempt, setAttempt] = useState<ClaimedAttempt | null>(null);
  const claimedKey = useRef<string | null>(null);
  const sessionFence = useRef(new SessionFocusFence());
  const handleFence = useRef(new TargetRouteFence());
  const currentUserId = useRef<string | null>(session?.user.id ?? null);
  const currentHandle = useRef<string | null>(clean || null);
  const currentSubjectKey = useRef(subjectKey);
  currentUserId.current = session?.user.id ?? null;
  currentHandle.current = clean || null;
  currentSubjectKey.current = subjectKey;

  useFocusEffect(useCallback(() => {
    const subject = session?.user.id ?? null;
    sessionFence.current.focus(subject);
    handleFence.current.focus(clean || null);
    return () => {
      sessionFence.current.blur();
      handleFence.current.blur();
    };
  }, [clean, session?.user.id]));

  useEffect(() => {
    const subject = session?.user.id;
    const key = reference && subject ? subjectKey : null;
    if (!reference || !subject || accountRoute !== "ready" || !key || claimedKey.current === key) return;
    claimedKey.current = key;
    setResolvedView(null);
    const token = claimDeferredAttemptReference(
      reference as DeferredNavigationRef,
      { kind: "handle", handle: clean },
      subject,
    );
    setAttempt({ reference, subjectKey: key, token });
  }, [accountRoute, clean, reference, session?.user.id, subjectKey]);

  const resolve = useCallback(async (capturedAttempt: ClaimedAttempt | null) => {
    const subject = session?.user.id;
    const capturedSubjectKey = subjectKey;
    const subjectToken = sessionFence.current.begin(subject ?? null);
    const handleToken = handleFence.current.capture(clean);
    if (!subject || !capturedSubjectKey || !subjectToken || !handleToken || accountRoute !== "ready") return;
    setResolvedView(null);
    const resolution = await resolveDeferredDestination(
      { kind: "personal_handle", handle: clean },
      subject,
      { profileByHandle: getProfileByHandle },
    );
    if (!sessionFence.current.isCurrent(subjectToken, currentUserId.current)
      || !handleFence.current.isCurrent(handleToken, currentHandle.current)
      || !sameHandleLinkSubject(capturedSubjectKey, currentSubjectKey.current)) return;
    if (resolution.status === "terminal_unavailable") {
      if (capturedAttempt?.token) {
        const unavailable = transferDeferredAttemptToUnavailable(capturedAttempt.token);
        if (unavailable) router.replace(unavailable.href as never);
      } else setResolvedView({ subjectKey: capturedSubjectKey, status: "not_found" });
      return;
    }
    if (resolution.status === "retryable_failure") {
      setResolvedView({ subjectKey: capturedSubjectKey, status: "retryable" });
      return;
    }
    if (capturedAttempt?.token) {
      const transferred = transferDeferredHandleTarget(capturedAttempt.token, resolution.exactTarget);
      if (transferred) router.replace(transferred.href as never);
      return;
    }
    setResolvedView({ subjectKey: capturedSubjectKey, status: "target", href: resolution.href });
  }, [accountRoute, clean, router, session?.user.id, subjectKey]);

  useEffect(() => {
    if (reference && !sameHandleLinkSubject(attempt?.subjectKey, subjectKey)) return;
    if (reference && !attempt?.token) return;
    void resolve(reference ? attempt : null);
  }, [attempt, reference, resolve, subjectKey]);

  async function retry() {
    if (!subjectKey || !sameHandleLinkSubject(subjectKey, currentSubjectKey.current)) return;
    const captured = reference && sameHandleLinkSubject(attempt?.subjectKey, subjectKey) ? attempt : null;
    if (reference && !captured) return;
    if (captured?.token && !await retryDeferredDestination(captured.token)) return;
    if (!sameHandleLinkSubject(subjectKey, currentSubjectKey.current)) return;
    await resolve(captured);
  }

  const activeAttempt = sameHandleLinkSubject(attempt?.subjectKey, subjectKey) ? attempt : null;
  const visibleView = sameHandleLinkSubject(resolvedView?.subjectKey, subjectKey) ? resolvedView : null;

  if (loading) return <Spinner />;
  if (!session) return <Redirect href="/welcome" />;
  if (accountRoute !== "ready") return <Redirect href="/" />;
  if (validHandle && reference && !activeAttempt) return <Spinner />;
  if (reference && activeAttempt && !activeAttempt.token) return <Redirect href="/(tabs)/home" />;
  if (visibleView?.status === "target") return <Redirect href={visibleView.href} />;
  if (visibleView?.status === "retryable") {
    return <Screen dockInset={false}><View style={{ flex: 1, justifyContent: "center", gap: 12 }}><Text accessibilityRole="alert" variant="headline">We couldn&apos;t open this Wall.</Text><Text variant="body" color={colors.outline}>Check your connection and try again.</Text><Button label="Retry" variant="yellow" onPress={() => void retry()} /><Button label="My Wall" variant="ghost" onPress={() => router.replace("/(tabs)/home")} /></View></Screen>;
  }
  if (!validHandle || visibleView?.status === "not_found") {
    return <Screen dockInset={false}><View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}><Text accessibilityRole="alert" variant="headline">This isn&apos;t available anymore.</Text><Button label="My Wall" variant="primary" onPress={() => router.replace("/(tabs)/home")} /><Button label="Discover" variant="ghost" onPress={() => router.replace("/(tabs)/discover")} /></View></Screen>;
  }
  return <Spinner />;
}
