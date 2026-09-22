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
import { colors, markColors } from "@/theme";

function Spinner() {
  return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}><ActivityIndicator color={markColors.brandYellow} /></View>;
}

type ClaimedAttempt = { reference: string; token: DeferredAttemptToken | null };

export default function HandleLink() {
  const router = useRouter();
  const { handle, __deferred_ref: rawReference } = useLocalSearchParams<{ handle: string; __deferred_ref?: string }>();
  const clean = String(handle ?? "").replace(/^@/, "").toLowerCase();
  const reference = typeof rawReference === "string" ? rawReference : null;
  const { loading, session, accountRoute } = useAuth();
  const [notFound, setNotFound] = useState(false);
  const [retryable, setRetryable] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<ClaimedAttempt | null>(null);
  const claimedKey = useRef<string | null>(null);
  const sessionFence = useRef(new SessionFocusFence());
  const handleFence = useRef(new TargetRouteFence());
  const currentUserId = useRef<string | null>(session?.user.id ?? null);
  const currentHandle = useRef<string | null>(clean || null);
  currentUserId.current = session?.user.id ?? null;
  currentHandle.current = clean || null;

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
    const key = reference && subject ? `${subject}:${clean}:${reference}` : null;
    if (!reference || !subject || accountRoute !== "ready" || claimedKey.current === key) return;
    claimedKey.current = key;
    setTarget(null);
    setNotFound(false);
    setRetryable(false);
    const token = claimDeferredAttemptReference(
      reference as DeferredNavigationRef,
      { kind: "handle", handle: clean },
      subject,
    );
    setAttempt({ reference, token });
  }, [accountRoute, clean, reference, session?.user.id]);

  const resolve = useCallback(async (capturedAttempt: ClaimedAttempt | null) => {
    const subject = session?.user.id;
    const subjectToken = sessionFence.current.begin(subject ?? null);
    const handleToken = handleFence.current.capture(clean);
    if (!subject || !subjectToken || !handleToken || accountRoute !== "ready") return;
    setRetryable(false);
    setNotFound(false);
    const resolution = await resolveDeferredDestination(
      { kind: "personal_handle", handle: clean },
      subject,
      { profileByHandle: getProfileByHandle },
    );
    if (!sessionFence.current.isCurrent(subjectToken, currentUserId.current)
      || !handleFence.current.isCurrent(handleToken, currentHandle.current)) return;
    if (resolution.status === "terminal_unavailable") {
      if (capturedAttempt?.token) {
        const unavailable = transferDeferredAttemptToUnavailable(capturedAttempt.token);
        if (unavailable) router.replace(unavailable.href as never);
      } else setNotFound(true);
      return;
    }
    if (resolution.status === "retryable_failure") {
      setRetryable(true);
      return;
    }
    if (capturedAttempt?.token) {
      const transferred = transferDeferredHandleTarget(capturedAttempt.token, resolution.exactTarget);
      if (transferred) router.replace(transferred.href as never);
      return;
    }
    setTarget(resolution.href);
  }, [accountRoute, clean, router, session?.user.id]);

  useEffect(() => {
    if (reference && !attempt) return;
    if (reference && !attempt?.token) return;
    void resolve(attempt);
  }, [attempt, reference, resolve]);

  async function retry() {
    const captured = attempt;
    if (captured?.token && !await retryDeferredDestination(captured.token)) return;
    await resolve(captured);
  }

  if (loading) return <Spinner />;
  if (!session) return <Redirect href="/welcome" />;
  if (accountRoute !== "ready") return <Redirect href="/" />;
  if (reference && attempt?.reference !== reference) return <Spinner />;
  if (reference && attempt?.reference === reference && !attempt.token) return <Redirect href="/(tabs)/home" />;
  if (target) return <Redirect href={target} />;
  if (retryable) {
    return <Screen dockInset={false}><View style={{ flex: 1, justifyContent: "center", gap: 12 }}><Text accessibilityRole="alert" variant="headline">We couldn&apos;t open this Wall.</Text><Text variant="body" color={colors.outline}>Check your connection and try again.</Text><Button label="Retry" variant="yellow" onPress={() => void retry()} /><Button label="My Wall" variant="ghost" onPress={() => router.replace("/(tabs)/home")} /></View></Screen>;
  }
  if (notFound) {
    return <Screen dockInset={false}><View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}><Text variant="headline">This isn&apos;t available anymore.</Text><Button label="My Wall" variant="primary" onPress={() => router.replace("/(tabs)/home")} /></View></Screen>;
  }
  return <Spinner />;
}
