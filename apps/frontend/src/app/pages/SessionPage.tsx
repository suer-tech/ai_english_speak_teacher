import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAppContext } from "../context/AppContext";
import {
  SpeechToTextStreamClient,
  TutorSettings,
  formatApiError,
  generateTutorReply,
  speechToText,
  textToSpeech,
  textToSpeechStream,
} from "../../lib/api";
import {
  PcmCaptureSession,
  TARGET_SAMPLE_RATE,
} from "../../lib/audio/pcmCapture";
import { PcmStreamPlayer } from "../../lib/pcmStreamPlayer";
import { HoldToTalkButton } from "../components/session/HoldToTalkButton";
import { SessionIndicator } from "../components/session/SessionIndicator";
import { VoiceStage } from "../components/session/VoiceStage";
import type { SessionState } from "../components/session/types";

const personaTitles = {
  friendly_coach: "Дружелюбный коуч",
  strict_teacher: "Строгий преподаватель",
  conversation_buddy: "Разговорный buddy",
};

function formatRecordingDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");

  return `${minutes}:${seconds}`;
}

export function SessionPage() {
  const { settings, theme, token } = useAppContext();
  const navigate = useNavigate();
  const isDark = theme === "dark";

  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [isRecordButtonPressed, setIsRecordButtonPressed] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    "Удерживайте кнопку и говорите, когда будете готовы.",
  );
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);

  const pcmCaptureRef = useRef<PcmCaptureSession | null>(null);
  const audioPcmChunksRef = useRef<Uint8Array[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const pcmStreamPlayerRef = useRef<PcmStreamPlayer | null>(null);
  const ttsAbortControllerRef = useRef<AbortController | null>(null);
  const sttStreamRef = useRef<SpeechToTextStreamClient | null>(null);
  const isPointerHeldRef = useRef(false);

  const activeSettings: TutorSettings = settings ?? {
    persona: "friendly_coach",
    level: "elementary",
    voice: "Kin_24000",
    ui_language: "ru",
  };
  const personaTitle = personaTitles[activeSettings.persona] ?? "AI Tutor";

  useEffect(() => {
    if (sessionState !== "recording" || recordingStartedAt === null) {
      setRecordingDurationMs(0);
      return;
    }

    const updateDuration = () => {
      setRecordingDurationMs(Date.now() - recordingStartedAt);
    };

    updateDuration();
    const intervalId = window.setInterval(updateDuration, 100);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [recordingStartedAt, sessionState]);

  const clearRecordingSession = () => {
    audioPcmChunksRef.current = [];
    setRecordingStartedAt(null);
    setRecordingDurationMs(0);
  };

  const cleanupAudioPlayback = () => {
    ttsAbortControllerRef.current?.abort();
    ttsAbortControllerRef.current = null;
    void pcmStreamPlayerRef.current?.stop();
    pcmStreamPlayerRef.current = null;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  };

  const cleanupSttStream = () => {
    sttStreamRef.current?.close();
    sttStreamRef.current = null;
  };

  const buildPcmBlob = () => {
    const chunks = audioPcmChunksRef.current;
    if (!chunks.length) {
      return null;
    }

    return new Blob(chunks, {
      type: `audio/x-pcm;bit=16;rate=${TARGET_SAMPLE_RATE}`,
    });
  };

  const finalizeRecording = async () => {
    if (!pcmCaptureRef.current) {
      clearRecordingSession();
      return null;
    }

    await pcmCaptureRef.current.stop();
    pcmCaptureRef.current = null;

    const audioBlob = buildPcmBlob();
    clearRecordingSession();
    return audioBlob;
  };

  const playLegacyTts = async (text: string, voice: string) => {
    setStatusMessage("Загружаю совместимый аудиоответ...");
    const tts = await textToSpeech(text, voice);
    const binaryString = window.atob(tts.audio_base64);
    const bytes = Uint8Array.from(binaryString, (char) => char.charCodeAt(0));
    const blob = new Blob([bytes], { type: tts.content_type });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    audioRef.current = audio;
    audioUrlRef.current = url;
    audio.onended = () => {
      cleanupAudioPlayback();
      setSessionState("idle");
      setStatusMessage("Можно говорить снова.");
    };
    audio.onerror = () => {
      cleanupAudioPlayback();
      setSessionState("idle");
      setStatusMessage("Не удалось воспроизвести аудио.");
    };

    setSessionState("playing");
    setStatusMessage("Слушайте ответ.");
    await audio.play();
  };

  const playTutorReply = async (text: string, voice: string) => {
    cleanupAudioPlayback();

    let streamingStarted = false;

    try {
      const abortController = new AbortController();
      ttsAbortControllerRef.current = abortController;
      setSessionState("buffering");
      setStatusMessage("Буферизую аудиоответ...");

      const streamed = await textToSpeechStream(text, voice, abortController.signal);
      const player = new PcmStreamPlayer(streamed.sampleRate, {
        onPlaybackStart: () => {
          streamingStarted = true;
          setSessionState("playing");
          setStatusMessage("Слушайте ответ.");
        },
      });

      pcmStreamPlayerRef.current = player;
      await player.play(streamed.stream, abortController.signal);

      if (pcmStreamPlayerRef.current === player) {
        pcmStreamPlayerRef.current = null;
      }
      if (ttsAbortControllerRef.current === abortController) {
        ttsAbortControllerRef.current = null;
      }

      setSessionState("idle");
      setStatusMessage("Можно говорить снова.");
      return;
    } catch (error) {
      const isAbortError =
        error instanceof DOMException && error.name === "AbortError";

      if (pcmStreamPlayerRef.current) {
        void pcmStreamPlayerRef.current.stop();
        pcmStreamPlayerRef.current = null;
      }
      ttsAbortControllerRef.current = null;

      if (isAbortError) {
        throw error;
      }

      if (streamingStarted) {
        throw error;
      }
    }

    cleanupAudioPlayback();
    await playLegacyTts(text, voice);
  };

  const handlePointerDown = async () => {
    if (sessionState !== "idle") {
      return;
    }

    isPointerHeldRef.current = true;
    setIsRecordButtonPressed(true);
    setStatusMessage("Слушаю вас. Отпустите кнопку, когда закончите.");

    try {
      if (!token) {
        throw new Error("Authentication required");
      }

      const sttStream = new SpeechToTextStreamClient({
        token,
        language: "en-US",
        sampleRate: TARGET_SAMPLE_RATE,
      });
      await sttStream.connect();
      sttStreamRef.current = sttStream;

      const pcmCapture = new PcmCaptureSession({
        onPcmChunk: (chunk) => {
          if (!isPointerHeldRef.current) {
            return;
          }

          audioPcmChunksRef.current.push(chunk);
          sttStreamRef.current?.sendAudioChunk(chunk);
        },
        onSpeechActivityChange: (isSpeechActive) => {
          if (!isPointerHeldRef.current) {
            return;
          }

          setStatusMessage(
            isSpeechActive
              ? "Слышу ваш голос. Продолжайте говорить."
              : "Пауза в речи. Можете продолжить или отпустить кнопку.",
          );
        },
      });
      await pcmCapture.start();

      if (!isPointerHeldRef.current) {
        await pcmCapture.stop();
        pcmCaptureRef.current = null;
        clearRecordingSession();
        cleanupSttStream();
        setSessionState("idle");
        setStatusMessage("Удерживайте кнопку и говорите, когда будете готовы.");
        return;
      }

      pcmCaptureRef.current = pcmCapture;
      setSessionState("recording");
      setRecordingStartedAt(Date.now());
      setRecordingDurationMs(0);
    } catch (error) {
      isPointerHeldRef.current = false;
      setIsRecordButtonPressed(false);
      await pcmCaptureRef.current?.stop();
      pcmCaptureRef.current = null;
      clearRecordingSession();
      cleanupSttStream();
      setStatusMessage(formatApiError(error, "Нет доступа к микрофону"));
      setSessionState("idle");
    }
  };

  const handlePointerUp = async () => {
    isPointerHeldRef.current = false;
    setIsRecordButtonPressed(false);

    if (sessionState !== "recording") {
      if (sessionState === "idle") {
        setStatusMessage("Удерживайте кнопку и говорите, когда будете готовы.");
      }
      return;
    }

    setSessionState("processing");
    setStatusMessage("Завершаю распознавание речи...");

    try {
      const sttStream = sttStreamRef.current;
      sttStreamRef.current = null;
      const audioBlob = await finalizeRecording();
      if (!audioBlob || audioBlob.size === 0) {
        cleanupSttStream();
        setSessionState("idle");
        setStatusMessage("Не удалось записать аудио. Попробуйте еще раз.");
        return;
      }

      let recognizedText = "";
      try {
        if (!sttStream) {
          throw new Error("Streaming speech recognition is unavailable");
        }
        recognizedText = (await sttStream.finish()).trim();
      } catch {
        recognizedText = (await speechToText(audioBlob, "en-US", TARGET_SAMPLE_RATE)).trim();
      }

      if (!recognizedText) {
        setSessionState("idle");
        setStatusMessage("Не удалось распознать речь. Попробуйте еще раз.");
        return;
      }

      setStatusMessage("Формирую ответ...");
      const reply = await generateTutorReply(recognizedText, activeSettings);

      await playTutorReply(reply.tutor_reply, activeSettings.voice);
    } catch (error) {
      clearRecordingSession();
      stopMediaStream();
      cleanupAudioPlayback();
      setStatusMessage(formatApiError(error, "Ошибка обработки речи"));
      setSessionState("idle");
    }
  };

  const handlePointerCancel = async () => {
    isPointerHeldRef.current = false;
    setIsRecordButtonPressed(false);

    if (sessionState !== "recording") {
      return;
    }
    await pcmCaptureRef.current?.stop();
    pcmCaptureRef.current = null;
    clearRecordingSession();
    cleanupSttStream();
    setSessionState("idle");
    setStatusMessage("Запись отменена. Удерживайте кнопку, чтобы попробовать еще раз.");
  };

  useEffect(() => {
    return () => {
      cleanupAudioPlayback();
      cleanupSttStream();
      void pcmCaptureRef.current?.stop();
      pcmCaptureRef.current = null;
      isPointerHeldRef.current = false;
    };
  }, []);

  const recordingDurationLabel =
    sessionState === "recording"
      ? `Запись ${formatRecordingDuration(recordingDurationMs)}`
      : formatRecordingDuration(recordingDurationMs);

  const backgroundAccent =
    sessionState === "recording"
      ? "from-rose-500/18 via-transparent to-transparent"
      : sessionState === "processing"
      ? "from-violet-500/16 via-transparent to-amber-500/8"
      : sessionState === "buffering"
      ? "from-sky-500/18 via-transparent to-indigo-500/8"
      : sessionState === "playing"
      ? "from-indigo-500/20 via-transparent to-sky-500/10"
      : "from-white/8 via-transparent to-transparent";

  return (
    <div
      className={`relative flex h-full flex-1 flex-col overflow-hidden ${
        isDark ? "bg-[#0F0F13]" : "bg-slate-50"
      }`}
    >
      <div className={`absolute inset-0 bg-gradient-to-b ${backgroundAccent}`} />
      <div
        className={`absolute inset-x-0 top-0 h-40 bg-gradient-to-b ${
          isDark ? "from-white/[0.03] to-transparent" : "from-white/80 to-transparent"
        }`}
      />
      <div
        className={`absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t ${
          isDark ? "from-[#0F0F13] via-[#0F0F13]/92 to-transparent" : "from-slate-50 via-slate-50/92 to-transparent"
        }`}
      />

      <SessionIndicator
        personaTitle={personaTitle}
        sessionState={sessionState}
        onOpenSettings={() => navigate("/settings")}
      />

      <VoiceStage
        sessionState={sessionState}
        statusMessage={statusMessage}
        recordingDurationLabel={recordingDurationLabel}
      />

      <HoldToTalkButton
        sessionState={sessionState}
        isPressed={isRecordButtonPressed}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerUp}
      />
    </div>
  );
}
