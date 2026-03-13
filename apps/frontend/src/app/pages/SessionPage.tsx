import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAppContext } from "../context/AppContext";
import {
  TutorSettings,
  audioRespond,
  createSession,
  formatApiError,
  fetchSessionConfig,
  generateTutorReply,
  speechToText,
  textToSpeech,
} from "../../lib/api";
import {
  PcmCaptureSession,
  TARGET_SAMPLE_RATE,
} from "../../lib/audio/pcmCapture";
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
  const { settings, theme } = useAppContext();
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
  const isPointerHeldRef = useRef(false);
  const [useDirectAudio, setUseDirectAudio] = useState(false);
  const [directAudioSessionId, setDirectAudioSessionId] = useState<string | null>(null);

  const activeSettings: TutorSettings = settings ?? {
    persona: "friendly_coach",
    level: "elementary",
    voice: "female",
    ui_language: "ru",
  };
  const personaTitle = personaTitles[activeSettings.persona] ?? "AI Tutor";

  useEffect(() => {
    if (sessionState !== "recording" || recordingStartedAt === null) {
      setRecordingDurationMs(0);
      return;
    }

    let timeoutId: number | null = null;
    let intervalId: number | null = null;

    const syncDuration = () => {
      setRecordingDurationMs(Date.now() - recordingStartedAt);
    };

    const startInterval = () => {
      syncDuration();
      intervalId = window.setInterval(syncDuration, 1000);
    };

    syncDuration();
    timeoutId = window.setTimeout(() => {
      startInterval();
    }, 1000 - ((Date.now() - recordingStartedAt) % 1000));

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [recordingStartedAt, sessionState]);

  const clearRecordingSession = () => {
    audioPcmChunksRef.current = [];
    setRecordingStartedAt(null);
    setRecordingDurationMs(0);
  };

  const cleanupAudioPlayback = () => {
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

  const buildPcmBlob = () => {
    const chunks = audioPcmChunksRef.current;
    if (!chunks.length) {
      return null;
    }

    return new Blob(chunks as BlobPart[], {
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

  const playLegacyTts = async (text: string, voice?: string) => {
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

  const playTutorReply = async (text: string, voice?: string) => {
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

      const pcmCapture = new PcmCaptureSession({
        onPcmChunk: (chunk) => {
          if (!isPointerHeldRef.current) {
            return;
          }

          audioPcmChunksRef.current.push(chunk);
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
    setStatusMessage(useDirectAudio ? "Формирую голосовой ответ..." : "Завершаю распознавание речи...");

    try {
      const audioBlob = await finalizeRecording();
      if (!audioBlob || audioBlob.size === 0) {
        setSessionState("idle");
        setStatusMessage("Не удалось записать аудио. Попробуйте еще раз.");
        return;
      }

      if (useDirectAudio) {
        if (!directAudioSessionId) {
          setSessionState("idle");
          setStatusMessage("Сессия не создана. Обновите страницу.");
          return;
        }
        setStatusMessage("AI слушает и отвечает...");
        const tts = await audioRespond(
          audioBlob,
          directAudioSessionId,
          activeSettings,
          TARGET_SAMPLE_RATE,
        );
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
      } else {
        const recognizedText = (await speechToText(audioBlob, "en-US", TARGET_SAMPLE_RATE)).trim();
        if (!recognizedText) {
          setSessionState("idle");
          setStatusMessage("Не удалось распознать речь. Попробуйте еще раз.");
          return;
        }
        setStatusMessage("Формирую ответ...");
        const reply = await generateTutorReply(recognizedText, activeSettings);
        await playTutorReply(reply.tutor_reply, activeSettings.voice);
      }
    } catch (error) {
      clearRecordingSession();
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
    setSessionState("idle");
    setStatusMessage("Запись отменена. Удерживайте кнопку, чтобы попробовать еще раз.");
  };

  useEffect(() => {
    fetchSessionConfig().then(async (config) => {
      setUseDirectAudio(config.use_direct_audio);
      if (config.use_direct_audio) {
        try {
          const session = await createSession();
          setDirectAudioSessionId(session.session_id);
        } catch {
          setDirectAudioSessionId(null);
        }
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      cleanupAudioPlayback();
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
