import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, TextInput, View } from "react-native";
import { Audio, ResizeMode, Video } from "expo-av";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { UNSTABLE_usePreventRemove as usePreventRemove } from "@react-navigation/native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { MarkView } from "@/components/marks/MarkView";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { track } from "@/lib/analytics";
import { useAuth } from "@/lib/auth";
import {
  advanceMediaDraft, cancelMediaDraft, createMediaMarkGuarded, createMediaWriterDraft, prepareMediaMarkRequest,
  MediaWriterError, type MediaKind, type MediaWriterDraft, type PreparedMediaMarkRequest,
} from "@/lib/mark-media-writer";
import {
  createMarkRotation, createRequestId, prepareTextMarkSubmission, TextSubmissionLock,
  type PreparedTextMarkSubmission,
} from "@/lib/mark-writer-contract";
import { createTextMark, protectedMediaWriterRpc, type MarkWithAuthor } from "@/lib/marks";
import { getPersonalWall } from "@/lib/profiles";
import { formatDuration, MAX_VIDEO_MS, useVoiceRecorder } from "@/lib/recording";
import {
  abortProtectedMediaUpload, clearProtectedMediaOtherSessions, clearProtectedMediaResumeScope,
  createProtectedMediaTransport, getLocalMediaSize, MEDIA_LIMITS,
} from "@/lib/upload";
import type { MarkType } from "@/lib/types";
import { getWall } from "@/lib/walls";
import { colors, markColors, radius, shadow, stickySwatches } from "@/theme";

const MAX_TEXT = 500;

function Choice({ active, disabled, onPress, title, subtitle }: {
  active: boolean; disabled?: boolean; onPress: () => void; title: string; subtitle: string;
}) {
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="radio"
    accessibilityState={{ selected: active, disabled }} accessibilityLabel={`${title}, ${subtitle}`}
    style={{ flex: 1, borderWidth: 2, borderColor: colors.ink, borderRadius: radius.card,
      paddingVertical: 12, paddingHorizontal: 12, backgroundColor: active ? colors.ink : colors.card,
      opacity: disabled ? 0.6 : 1 }}>
    <Text variant="headline" style={{ fontSize: 15 }} color={active ? colors.surface : colors.ink}>{title}</Text>
    <Text variant="label" color={active ? markColors.brandYellow : colors.outline} style={{ marginTop: 2 }}>{subtitle}</Text>
  </Pressable>;
}

function AttachButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled }} style={{ flex: 1, minHeight: 44, borderWidth: 1.5,
      borderColor: colors.ink, borderRadius: radius.pill, alignItems: "center", justifyContent: "center",
      paddingVertical: 8, opacity: disabled ? 0.5 : 1 }}>
    <Text variant="label" color={colors.ink}>{label}</Text>
  </Pressable>;
}

function safeMediaMessage(cause: unknown): string {
  if (!(cause instanceof MediaWriterError)) return "Check your connection and try again.";
  if (cause.code === "rate_limited") return "You've reached the upload limit for now. Try again later.";
  if (cause.code === "paused") return "Upload paused in the background. Tap Retry.";
  if (cause.mediaFailureCode === "TOO_LARGE") return "That file is too large. Choose a smaller one.";
  if (cause.mediaFailureCode === "TOO_LONG") return "That recording is too long. Choose a shorter one.";
  if (cause.mediaFailureCode === "UNSUPPORTED_FORMAT") return "That media format isn't supported.";
  if (cause.mediaFailureCode === "INVALID_MEDIA") return "That file couldn't be safely processed. Choose another one.";
  if (cause.code === "validation_timeout") return "Processing is taking longer than expected. Try again shortly.";
  if (cause.code === "unavailable") return "You may no longer have permission to leave a Mark here.";
  return "Your media couldn't upload. Tap Retry.";
}

function DraftCard({ draft, index, count, disabled, onRemove, onRetry, onMove, onPlayVoice }: {
  draft: MediaWriterDraft; index: number; count: number; disabled: boolean; onRemove: () => void;
  onRetry: () => void; onMove: (direction: -1 | 1) => void; onPlayVoice: () => void;
}) {
  const working = ["reserving", "uploading", "uploaded", "validating", "cancelling"].includes(draft.state);
  const phase = draft.state === "uploading" ? `Uploading ${Math.round(draft.progress * 100)}%`
    : draft.state === "validating" || draft.state === "uploaded" ? "Processing safely…"
      : draft.state === "validated" ? "Ready" : draft.state === "failed" ? "Needs attention"
        : draft.state === "cancelling" ? "Removing…" : "Selected";
  return <View style={{ borderWidth: 2, borderColor: colors.ink, borderRadius: radius.card,
    padding: 10, backgroundColor: colors.card, gap: 8 }}>
    {draft.kind === "photo" ? <Image source={{ uri: draft.uri }} contentFit="contain"
      accessibilityLabel={`Selected photo ${index + 1} of ${count}`}
      style={{ width: "100%", height: 150, backgroundColor: colors.surfaceContainer }} />
      : draft.kind === "video" ? <Video source={{ uri: draft.uri }} useNativeControls resizeMode={ResizeMode.CONTAIN}
        accessibilityLabel="Selected video preview" style={{ width: "100%", height: 180, backgroundColor: colors.ink }} />
        : <Button label={`Play voice preview · ${formatDuration(draft.durationMs ?? 0)}`}
          variant="ghost" onPress={onPlayVoice} disabled={disabled} />}
    <Text variant="label" color={draft.state === "failed" ? colors.error : colors.outline}
      accessibilityLiveRegion="polite">{phase}</Text>
    {draft.state === "uploading" ? <View accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(draft.progress * 100) }}
      style={{ height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceContainerHigh }}>
      <View style={{ height: 6, width: `${Math.round(draft.progress * 100)}%`, borderRadius: radius.pill,
        backgroundColor: colors.ink }} />
    </View> : null}
    <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
      {draft.kind === "photo" && count > 1 ? <>
        <Pressable accessibilityRole="button" accessibilityLabel={`Move photo ${index + 1} earlier`}
          disabled={disabled || index === 0} onPress={() => onMove(-1)}>
          <Text variant="label" color={index === 0 ? colors.outlineVariant : colors.outline}>← EARLIER</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Move photo ${index + 1} later`}
          disabled={disabled || index === count - 1} onPress={() => onMove(1)}>
          <Text variant="label" color={index === count - 1 ? colors.outlineVariant : colors.outline}>LATER →</Text>
        </Pressable>
      </> : null}
      {draft.state === "failed" ? <Pressable accessibilityRole="button" onPress={onRetry} disabled={disabled}>
        <Text variant="label" color={colors.ink}>RETRY</Text></Pressable> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${draft.kind}`} onPress={onRemove}
        disabled={disabled || working}><Text variant="label" color={colors.error}>REMOVE</Text></Pressable>
    </View>
  </View>;
}

export default function Composer() {
  const router = useRouter();
  const navigation = useNavigation();
  const { wallId: targetWallId, recipientId, handle, sharedWallId, wallName } = useLocalSearchParams<{
    wallId?: string; recipientId?: string; handle?: string; sharedWallId?: string; wallName?: string;
  }>();
  const sharedMode = Boolean(sharedWallId);
  const targetLabel = sharedMode ? wallName ?? "a Shared Wall" : `@${handle}`;
  const { session, sessionGeneration, mediaAppActive, profile } = useAuth();
  const currentUserId = session?.user.id;
  const [text, setText] = useState("");
  const [color, setColor] = useState<string>(stickySwatches[0]);
  const [anonymous, setAnonymous] = useState(false);
  const [secret, setSecret] = useState(false);
  const [media, setMedia] = useState<MediaWriterDraft[]>([]);
  const [wallId, setWallId] = useState<string | null>(null);
  const [allowAnonymous, setAllowAnonymous] = useState(true);
  const [targetError, setTargetError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "posting">("idle");
  const [submissionLocked, setSubmissionLocked] = useState(false);
  const [confirmedMarkId, setConfirmedMarkId] = useState<string | null>(null);
  const textSubmissionRef = useRef<PreparedTextMarkSubmission | null>(null);
  const mediaRequestRef = useRef<PreparedMediaMarkRequest | null>(null);
  const lockRef = useRef(new TextSubmissionLock());
  const submitInFlightRef = useRef(false);
  const trackedRequestsRef = useRef(new Set<string>());
  const lifecycleRef = useRef(0);
  const mediaRef = useRef(media);
  const voicePreviewRef = useRef<Audio.Sound | null>(null);
  const discardConfirmedRef = useRef(false);
  const recorder = useVoiceRecorder();
  const recording = recorder.phase === "recording";
  const busy = phase !== "idle";
  mediaRef.current = media;

  useEffect(() => { lifecycleRef.current += 1; }, [currentUserId, sessionGeneration, mediaAppActive]);
  useEffect(() => {
    if (currentUserId) void clearProtectedMediaOtherSessions(currentUserId, sessionGeneration);
    return () => {
      if (!currentUserId) return;
      for (const draft of mediaRef.current) {
        if (draft.uploadId) void abortProtectedMediaUpload(currentUserId, draft.uploadId);
      }
      void clearProtectedMediaResumeScope(currentUserId, sessionGeneration);
    };
  }, [currentUserId, sessionGeneration]);
  useEffect(() => {
    if (mediaAppActive) return;
    setMedia((current) => current.map((draft) => {
      if (!["reserving", "uploading", "uploaded", "validating"].includes(draft.state)) return draft;
      const retryFrom = draft.state === "uploaded" || draft.state === "validating" ? "validation" : "upload";
      return { ...draft, state: "failed", retryFrom };
    }));
    // create_mark may already have committed despite backgrounding. Keep its
    // intent lock until the authoritative response settles; retry then reuses
    // the frozen request ID and reconciles as `existing`.
    if (phase !== "posting") {
      setPhase("idle");
      lockRef.current.finish();
      setSubmissionLocked(false);
      submitInFlightRef.current = false;
    }
  }, [mediaAppActive, phase]);
  useEffect(() => () => {
    lifecycleRef.current += 1;
    void voicePreviewRef.current?.unloadAsync().catch(() => undefined);
  }, []);

  const hasContent = text.trim().length > 0 || media.length > 0;
  async function cleanupDrafts() {
    if (currentUserId) await Promise.allSettled(mediaRef.current.map(async (draft) => {
      if (!draft.uploadId) return;
      await abortProtectedMediaUpload(currentUserId, draft.uploadId);
      await cancelMediaDraft(draft, protectedMediaWriterRpc);
    }));
    await recorder.reset();
  }
  usePreventRemove((hasContent || recording || submissionLocked) && !discardConfirmedRef.current, ({ data }) => {
    if (submissionLocked) return;
    Alert.alert("Discard Mark?", "Your Mark won't be saved.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => {
        discardConfirmedRef.current = true;
        void cleanupDrafts().finally(() => navigation.dispatch(data.action));
      } },
    ]);
  });

  useEffect(() => {
    if (submissionLocked || !confirmedMarkId) return;
    const markId = confirmedMarkId;
    setConfirmedMarkId(null);
    discardConfirmedRef.current = true;
    if (router.canDismiss()) router.dismissAll();
    router.push(sharedMode ? `/shared/${sharedWallId}?justCreated=${markId}` : `/person/${recipientId}?justCreated=${markId}`);
  }, [confirmedMarkId, recipientId, router, sharedMode, sharedWallId, submissionLocked]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (sharedMode) {
        if (!sharedWallId) return;
        const target = await getWall(sharedWallId);
        if (!active) return;
        if (!target || target.type !== "shared") return setTargetError("That Shared Wall is no longer available.");
        setAllowAnonymous(target.allow_anonymous);
        if (!target.allow_anonymous) setAnonymous(false);
        setWallId(target.id);
        return;
      }
      if (!currentUserId || !recipientId || !targetWallId || recipientId === currentUserId) {
        if (active) setTargetError("Choose another person's Wall before writing a Mark.");
        return;
      }
      const target = await getPersonalWall(recipientId);
      if (!active) return;
      if (!target || target.id !== targetWallId) return setTargetError("That recipient and Wall no longer match.");
      setAllowAnonymous(target.allow_anonymous);
      if (!target.allow_anonymous) setAnonymous(false);
      setWallId(target.id);
    })().catch(() => { if (active) setTargetError("Couldn't verify this Wall."); });
    return () => { active = false; };
  }, [currentUserId, recipientId, sharedMode, sharedWallId, targetWallId]);

  const overLimit = text.length > MAX_TEXT;
  const markType: MarkType = media[0]?.kind ?? "text";
  const canSubmit = Boolean(wallId && currentUserId && !overLimit && hasContent && !recording && !(secret && media.length));

  function requestNonSecretMedia(intent: () => void) {
    if (!lockRef.current.allowsIntent()) return;
    if (!secret) return intent();
    Alert.alert("Turn off Secret Mark?",
      "Secret media isn't supported yet. Your media will use protected Wall access, but it won't be one-time Secret content.", [
        { text: "Keep Secret", style: "cancel" },
        { text: "Turn off & continue", onPress: () => { setSecret(false); intent(); } },
      ]);
  }

  async function draftFromAsset(kind: MediaKind, asset: ImagePicker.ImagePickerAsset): Promise<MediaWriterDraft> {
    const mime = asset.mimeType ?? (kind === "photo" ? "image/jpeg" : "video/mp4");
    const bytes = asset.fileSize ?? await getLocalMediaSize(asset.uri);
    const limit = kind === "photo" ? MEDIA_LIMITS.image : MEDIA_LIMITS.video;
    if (bytes > limit) throw new Error(kind === "photo" ? "Choose a photo under 6 MB." : "Choose a video under 40 MB.");
    if (kind === "video" && typeof asset.duration === "number" && asset.duration > MAX_VIDEO_MS + 1_500) {
      throw new Error("Video Marks are up to 30 seconds.");
    }
    return createMediaWriterDraft({ kind, uri: asset.uri, mime, bytes, durationMs: asset.duration ?? undefined }, createRequestId());
  }

  async function pickPhotos(fromCamera: boolean) {
    try {
      if (media.some((draft) => draft.kind !== "photo") || media.length >= 5) return;
      if (fromCamera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return Alert.alert("Camera access is off", "Enable camera access in Settings to add a photo.", [
          { text: "Not now", style: "cancel" },
          { text: "Open Settings", onPress: () => void Linking.openSettings() },
        ]);
      }
      const remaining = 5 - media.length;
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsMultipleSelection: true, selectionLimit: remaining, orderedSelection: true, quality: 0.8 });
      if (result.canceled) return;
      const drafts = await Promise.all(result.assets.slice(0, remaining).map((asset) => draftFromAsset("photo", asset)));
      lockRef.current.runIntent(() => setMedia((current) => [...current, ...drafts].slice(0, 5)));
    } catch (cause) {
      Alert.alert("Couldn't add that photo", cause instanceof Error ? cause.message : "Choose another photo.");
    }
  }

  async function pickVideo(fromCamera: boolean) {
    try {
      if (fromCamera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return Alert.alert("Camera access is off", "Enable camera access in Settings to record a video.", [
          { text: "Not now", style: "cancel" },
          { text: "Open Settings", onPress: () => void Linking.openSettings() },
        ]);
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        videoMaxDuration: 30, quality: 0.8 };
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      setMedia([await draftFromAsset("video", result.assets[0])]);
    } catch (cause) {
      Alert.alert("Couldn't add that video", cause instanceof Error ? cause.message : "Choose another video.");
    }
  }

  function chooseVideoSource() {
    Alert.alert("Add a video", "Choose an existing video or record a new one.", [
      { text: "Cancel", style: "cancel" },
      { text: "Choose video", onPress: () => void pickVideo(false) },
      { text: "Record video", onPress: () => void pickVideo(true) },
    ]);
  }

  async function toggleVoice() {
    if (recording) {
      const clip = await recorder.stop();
      if (!clip) return;
      try {
        const bytes = await getLocalMediaSize(clip.uri);
        if (bytes > MEDIA_LIMITS.audio) throw new Error("Voice recordings must be under 8 MB.");
        setMedia([createMediaWriterDraft({ kind: "voice", uri: clip.uri, mime: clip.mime,
          bytes, durationMs: clip.durationMs }, createRequestId())]);
      } catch (cause) {
        Alert.alert("Couldn't use that recording", cause instanceof Error ? cause.message : "Please record it again.");
      }
      return;
    }
    await recorder.start();
  }

  function updateDraft(clientId: string, next: MediaWriterDraft) {
    setMedia((current) => current.map((draft) => draft.clientUploadId === clientId ? next : draft));
  }

  async function prepareDraft(draft: MediaWriterDraft, token: number): Promise<MediaWriterDraft> {
    if (!wallId || !currentUserId) throw new MediaWriterError("unavailable", true);
    return advanceMediaDraft(draft, { wallId, subject: currentUserId, rpc: protectedMediaWriterRpc,
      transport: createProtectedMediaTransport(currentUserId, sessionGeneration), update: (next) => updateDraft(draft.clientUploadId, next),
      isCurrent: () => token === lifecycleRef.current && session?.user.id === currentUserId && sessionGeneration > 0,
      isActive: () => mediaAppActive, maxPolls: 60, pollIntervalMs: 1_000 });
  }

  async function retryDraft(draft: MediaWriterDraft) {
    if (busy) return;
    const token = lifecycleRef.current;
    let retry = draft;
    if (draft.state === "failed" && draft.errorCode) {
      try {
        if (draft.uploadId && currentUserId) await abortProtectedMediaUpload(currentUserId, draft.uploadId);
        await cancelMediaDraft(draft, protectedMediaWriterRpc);
      } catch {
        return Alert.alert("Couldn't retry yet", "Check your connection and try again.");
      }
      retry = createMediaWriterDraft({ kind: draft.kind, uri: draft.uri, mime: draft.mime,
        bytes: draft.bytes, durationMs: draft.durationMs }, createRequestId());
      updateDraft(draft.clientUploadId, retry);
    }
    try {
      setPhase("uploading");
      await prepareDraft(retry, token);
    } catch (cause) {
      if (!(cause instanceof MediaWriterError) || cause.code !== "stale") Alert.alert("Media not ready", safeMediaMessage(cause));
    } finally {
      if (token === lifecycleRef.current) setPhase("idle");
    }
  }

  async function removeDraft(draft: MediaWriterDraft) {
    if (busy) return;
    try {
      if (draft.uploadId && currentUserId) {
        updateDraft(draft.clientUploadId, { ...draft, state: "cancelling" });
        await abortProtectedMediaUpload(currentUserId, draft.uploadId);
        await cancelMediaDraft(draft, protectedMediaWriterRpc);
      }
      setMedia((current) => current.filter((item) => item.clientUploadId !== draft.clientUploadId));
    } catch {
      updateDraft(draft.clientUploadId, { ...draft, state: "failed" });
      Alert.alert("Couldn't remove that yet", "Check your connection and try again.");
    }
  }

  function moveDraft(index: number, direction: -1 | 1) {
    setMedia((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function playVoice(uri: string) {
    try {
      await voicePreviewRef.current?.unloadAsync();
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
      voicePreviewRef.current = sound;
    } catch { Alert.alert("Couldn't play that", "Please try the recording again."); }
  }

  const preview = useMemo<MarkWithAuthor>(() => ({
    id: "preview", wall_id: wallId ?? "", author_id: currentUserId ?? null, type: "text",
    text: text.trim() || "your Mark…", color, anonymous, secret: false, media_url: null, payload: null,
    rotation: 0, pinned: false, status: "active", created_at: new Date().toISOString(), author: anonymous ? null
      : { id: currentUserId ?? "me", display_name: profile?.display_name ?? "You",
        avatar_url: profile?.avatar_url ?? null, handle: profile?.handle ?? "you" },
  }), [anonymous, color, currentUserId, profile, text, wallId]);

  function confirmDiscard() {
    if (!hasContent && !recording) return router.back();
    Alert.alert("Discard Mark?", "Your Mark won't be saved.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => {
        discardConfirmedRef.current = true;
        void cleanupDrafts().finally(() => router.back());
      } },
    ]);
  }

  async function submit() {
    if (!canSubmit || !wallId || !currentUserId || submitInFlightRef.current || !lockRef.current.tryBegin()) return;
    submitInFlightRef.current = true;
    setSubmissionLocked(true);
    const token = lifecycleRef.current;
    const isCurrent = () => token === lifecycleRef.current && session?.user.id === currentUserId && mediaAppActive;
    try {
      if (!media.length) {
        const submission = prepareTextMarkSubmission({ wallId, text, color, anonymous, secret }, textSubmissionRef.current);
        textSubmissionRef.current = submission;
        setPhase("posting");
        const result = await createTextMark(submission);
        if (!isCurrent()) return;
        if (result.status !== "created" && result.status !== "existing") {
          Alert.alert("Couldn't post that", result.status === "deleted" ? "That earlier post was deleted. Change the draft first."
            : result.status === "invalid" ? "Check this Mark and try again."
              : result.status === "request_id_reused" ? "This draft changed unexpectedly. Make a change and try again."
                : "This Wall isn't accepting that Mark right now.");
          return;
        }
        if (!trackedRequestsRef.current.has(submission.requestId)) {
          trackedRequestsRef.current.add(submission.requestId);
          track("Mark Created", { mark_type: "text", is_anonymous: anonymous, is_secret: secret });
        }
        setConfirmedMarkId(result.markId);
        return;
      }

      setPhase("uploading");
      const attempts = await Promise.allSettled(media.map((draft) => draft.state === "validated" ? draft : prepareDraft(draft, token)));
      const rejected = attempts.find((attempt) => attempt.status === "rejected");
      if (rejected?.status === "rejected") throw rejected.reason;
      const prepared = attempts.map((attempt) => (attempt as PromiseFulfilledResult<MediaWriterDraft>).value);
      if (token !== lifecycleRef.current) return;
      setMedia(prepared);
      setPhase("posting");
      const request = prepareMediaMarkRequest({ wallId, type: markType as MediaKind, text, anonymous,
        uploads: prepared }, mediaRequestRef.current, createRequestId, createMarkRotation);
      mediaRequestRef.current = request;
      const result = await createMediaMarkGuarded({ requestId: request.requestId, wallId, type: markType as MediaKind,
        text, anonymous, rotation: request.rotation, uploads: prepared }, protectedMediaWriterRpc, isCurrent);
      if (result.status === "stale") return;
      if (result.status !== "created" && result.status !== "existing") {
        const message = result.status === "media_not_ready" ? "One item is still processing. Try again shortly."
          : result.status === "deleted" ? "That earlier post was deleted. Change the draft first."
            : result.status === "request_id_reused" ? "This draft changed unexpectedly. Make a change and try again."
              : result.status === "invalid" ? "Check the Mark and try again."
                : "You may no longer have permission to leave a Mark here.";
        Alert.alert("Couldn't post that", message);
        return;
      }
      if (!trackedRequestsRef.current.has(request.requestId)) {
        trackedRequestsRef.current.add(request.requestId);
        track("Mark Created", { mark_type: markType, is_anonymous: anonymous, is_secret: false });
        if (sharedMode) track("Shared Wall Mark Created", { mark_type: markType });
      }
      setConfirmedMarkId(result.markId);
    } catch (cause) {
      if (!(cause instanceof MediaWriterError) || cause.code !== "stale") Alert.alert("Couldn't post that", safeMediaMessage(cause));
    } finally {
      setPhase("idle");
      lockRef.current.finish();
      setSubmissionLocked(false);
      submitInFlightRef.current = false;
    }
  }

  if (targetError) return <Screen scroll={false} dockInset={false}>
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
      <Text variant="headline">This Mark needs a recipient</Text>
      <Text variant="body" color={colors.error} style={{ textAlign: "center" }}>{targetError}</Text>
      <Button label="Choose a person" onPress={() => router.replace("/people-picker")} />
    </View>
  </Screen>;

  const canAddPhoto = !busy && (media.length === 0 || media[0].kind === "photo") && media.length < 5;
  const canAddAv = !busy && media.length === 0;
  const canToggleSecret = !media.length && !busy && !recording;
  return <Screen dockInset={false}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      marginTop: 12, marginBottom: 16 }}>
      <Pressable onPress={confirmDiscard} disabled={submissionLocked} accessibilityRole="button"
        accessibilityState={{ disabled: submissionLocked }} hitSlop={10}
        style={{ minHeight: 44, justifyContent: "center", opacity: submissionLocked ? 0.5 : 1 }}>
        <Text variant="label" color={colors.outline}>CANCEL</Text>
      </Pressable>
      <View style={{ alignItems: "center" }}><Text variant="display" style={{ fontSize: 20 }}>New Mark</Text>
        <Text variant="label" color={colors.outline}>{sharedMode ? `ON ${targetLabel}` : `FOR ${targetLabel}`}</Text></View>
      <Pressable onPress={submit} disabled={!canSubmit || busy} hitSlop={10} accessibilityRole="button"
        accessibilityState={{ disabled: !canSubmit || busy }} style={{ minHeight: 44, justifyContent: "center" }}>
        <Text variant="label" color={!canSubmit || busy ? colors.outlineVariant : colors.ink}>
          {phase === "uploading" ? "UPLOADING…" : phase === "posting" ? "POSTING…" : "POST"}
        </Text>
      </Pressable>
    </View>

    {media.length ? <View style={{ gap: 12, marginBottom: 14 }}>{media.map((draft, index) =>
      <DraftCard key={draft.clientUploadId} draft={draft} index={index} count={media.length} disabled={busy}
        onRemove={() => void removeDraft(draft)} onRetry={() => void retryDraft(draft)}
        onMove={(direction) => moveDraft(index, direction)} onPlayVoice={() => void playVoice(draft.uri)} />
    )}</View> : null}

    <View style={[{ backgroundColor: colors.card, borderWidth: 2, borderColor: colors.ink,
      borderRadius: radius.card, padding: 14, minHeight: media.length ? 70 : 140 }, shadow.mark]}>
      <TextInput value={text} onChangeText={(value) => lockRef.current.runIntent(() => setText(value))}
        editable={!submissionLocked} placeholder={media.length ? "add a caption…" : "leave a little note…"}
        placeholderTextColor={colors.outline} multiline maxLength={MAX_TEXT + 1} autoFocus={!media.length}
        accessibilityLabel={media.length ? "Mark caption" : "Mark text"}
        style={{ fontFamily: "Bricolage-Bold", fontSize: media.length ? 17 : 20, lineHeight: 26,
          color: colors.ink, minHeight: media.length ? 44 : 110, textAlignVertical: "top" }} />
    </View>
    <Text variant="label" color={overLimit ? colors.error : text.length > MAX_TEXT - 40 ? markColors.roastOrange : colors.outline}
      style={{ alignSelf: "flex-end", marginTop: 6 }}>{text.length}/{MAX_TEXT}</Text>

    {recording ? <View style={{ marginTop: 14, borderWidth: 2, borderColor: colors.ink,
      borderRadius: radius.card, padding: 16, alignItems: "center", gap: 12, backgroundColor: markColors.skyBlue }}>
      <Text variant="display" style={{ fontSize: 26 }}>{formatDuration(recorder.elapsedMs)}</Text>
      <Text variant="label" color={colors.outline}>RECORDING · UP TO 60s</Text>
      <Button label="Stop ■" variant="primary" onPress={() => void toggleVoice()} />
    </View> : <View style={{ gap: 10, marginTop: 14 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <AttachButton label={media[0]?.kind === "photo" ? `＋ Add photo (${media.length}/5)` : "＋ Photos"}
          onPress={() => requestNonSecretMedia(() => void pickPhotos(false))} disabled={!canAddPhoto} />
        <AttachButton label="Camera" onPress={() => requestNonSecretMedia(() => void pickPhotos(true))} disabled={!canAddPhoto} />
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <AttachButton label="🎙 Voice" onPress={() => requestNonSecretMedia(() => void toggleVoice())} disabled={!canAddAv} />
        <AttachButton label="🎬 Video" onPress={() => requestNonSecretMedia(chooseVideoSource)} disabled={!canAddAv} />
      </View>
      {recorder.denied ? <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()}>
        <Text variant="label" color={colors.error}>
          Microphone access is off — open Settings to record a voice Mark.</Text>
      </Pressable> : null}
    </View>}

    {media.length === 0 ? <View style={{ marginTop: 18 }}>
      <Text variant="label" color={colors.outline} style={{ marginBottom: 10 }}>COLOR</Text>
      <View style={{ flexDirection: "row", gap: 12 }}>{stickySwatches.map((swatch) =>
        <Pressable key={swatch} onPress={() => lockRef.current.runIntent(() => setColor(swatch))}
          disabled={submissionLocked} accessibilityRole="button"
          accessibilityLabel={`Card color${swatch === color ? ", selected" : ""}`}
          style={{ width: 40, height: 40, borderRadius: radius.sticky, backgroundColor: swatch,
            borderWidth: swatch === color ? 3 : 1, borderColor: colors.ink }} />
      )}</View>
    </View> : null}

    <View style={{ marginTop: 20 }}><Text variant="label" color={colors.outline}
      style={{ marginBottom: 10 }}>WHO'S THIS FROM?</Text><View style={{ flexDirection: "row", gap: 10 }}>
      <Choice active={!anonymous} disabled={busy} onPress={() => lockRef.current.runIntent(() => setAnonymous(false))}
        title="Post as me" subtitle={`@${profile?.handle ?? "you"}`} />
      <Choice active={anonymous} disabled={busy || !allowAnonymous}
        onPress={() => lockRef.current.runIntent(() => setAnonymous(true))} title="Anonymous"
        subtitle={allowAnonymous ? "Name hidden" : "Not allowed here"} />
    </View></View>

    <View style={{ marginTop: 16 }}><Pressable onPress={() => lockRef.current.runIntent(() => setSecret((value) => !value))}
      disabled={!canToggleSecret} accessibilityRole="switch"
      accessibilityState={{ checked: secret, disabled: !canToggleSecret }}
      accessibilityLabel="Secret Mark — only the recipient can open it, once, within an hour"
      style={{ flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 2,
        borderColor: secret ? colors.ink : colors.outlineVariant, borderRadius: radius.card, padding: 14,
        backgroundColor: secret ? markColors.secretPurple : colors.card, opacity: canToggleSecret ? 1 : 0.6 }}>
      <Text style={{ fontSize: 20 }}>{secret ? "🔒" : "🔓"}</Text><View style={{ flex: 1 }}>
        <Text variant="headline" style={{ fontSize: 15 }} color={secret ? markColors.secretOnPurple : colors.ink}>Secret Mark</Text>
        <Text variant="label" color={secret ? markColors.secretOnPurple : colors.outline} style={{ marginTop: 2 }}>
          {media.length ? "Text-only for now" : secret ? "Only they can open it — once, within an hour" : "Hide the content until they open it"}
        </Text></View>
    </Pressable></View>

    {!media.length && !recording ? <><Text variant="label" color={colors.outline}
      style={{ marginTop: 20, marginBottom: 12 }}>PREVIEW</Text><View style={{ alignItems: "center" }}>
      <View style={{ width: "70%" }}><MarkView mark={preview} /></View></View></> : null}
    <View style={{ marginTop: 18, marginBottom: 8 }}>{wallId === null && currentUserId
      ? <ActivityIndicator color={markColors.brandYellow} />
      : <Button label={phase === "uploading" ? "Uploading & processing…" : phase === "posting" ? "Posting…"
        : secret ? "Post Secret Mark 🔒" : "Leave a Mark ✦"} variant="primary" loading={busy}
        disabled={!canSubmit} onPress={submit} />}</View>
  </Screen>;
}
