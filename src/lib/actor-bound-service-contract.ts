// @ts-ignore Dependency-free Node contract tests require the explicit source extension.
import { runExpectedActorMutation } from "./expected-actor.ts";

type ActorProvider = {
  getActorId: () => Promise<string | null | undefined>;
};

export type ProfileUpdatePort<Patch, Result> = ActorProvider & {
  update: (expectedActorId: string, patch: Patch) => Promise<Result>;
};

export async function executeProfileUpdate<Patch, Result>(
  expectedActorId: string,
  patch: Patch,
  port: ProfileUpdatePort<Patch, Result>,
): Promise<Result> {
  return runExpectedActorMutation(
    expectedActorId,
    "You need to be signed in to update your profile.",
    port.getActorId,
    async (actorId) => port.update(actorId, patch),
  );
}

export type AccountDeactivationPort = ActorProvider & {
  deactivate: (expectedActorId: string) => Promise<void>;
};

export async function executeAccountDeactivation(
  expectedActorId: string,
  port: AccountDeactivationPort,
): Promise<void> {
  await runExpectedActorMutation(
    expectedActorId,
    "You need to be signed in to deactivate your account.",
    port.getActorId,
    async (actorId) => port.deactivate(actorId),
  );
}

export type AccountReactivationPort = ActorProvider & {
  reactivate: (expectedActorId: string) => Promise<void>;
};

export async function executeAccountReactivation(
  expectedActorId: string,
  port: AccountReactivationPort,
): Promise<void> {
  await runExpectedActorMutation(
    expectedActorId,
    "You need to be signed in to restore your account.",
    port.getActorId,
    async (actorId) => port.reactivate(actorId),
  );
}

export type MarkRemovalReason = "normal" | "safety";
export type MarkRemovalPort = ActorProvider & {
  remove: (expectedActorId: string, markId: string, reason: MarkRemovalReason) => Promise<void>;
};

export async function executeMarkRemoval(
  expectedActorId: string,
  markId: string,
  reason: MarkRemovalReason,
  port: MarkRemovalPort,
): Promise<void> {
  await runExpectedActorMutation(
    expectedActorId,
    "You need to be signed in to remove a Mark.",
    port.getActorId,
    async (actorId) => port.remove(actorId, markId, reason),
  );
}
