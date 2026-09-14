// @ts-ignore Dependency-free Node contract tests require the explicit source extension.
import { runExpectedActorMutation } from "./expected-actor.ts";

type ActorProvider = {
  getActorId: () => Promise<string | null | undefined>;
};

export type AccountDeactivationPort = ActorProvider & {
  deactivate: () => Promise<void>;
};

export async function executeAccountDeactivation(
  expectedActorId: string,
  port: AccountDeactivationPort,
): Promise<void> {
  await runExpectedActorMutation(
    expectedActorId,
    "You need to be signed in to deactivate your account.",
    port.getActorId,
    async () => port.deactivate(),
  );
}

export type MarkRemovalReason = "normal" | "safety";
export type MarkRemovalPort = ActorProvider & {
  remove: (markId: string, reason: MarkRemovalReason) => Promise<void>;
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
    async () => port.remove(markId, reason),
  );
}
