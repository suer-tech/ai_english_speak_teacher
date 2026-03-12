import React from "react";
import { motion } from "motion/react";
import { Sparkles, Waves } from "lucide-react";
import { cn } from "../../../lib/utils";
import { useAppContext } from "../../context/AppContext";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { PlaybackVisualizer } from "./PlaybackVisualizer";
import type { SessionState } from "./types";

const stateCopy: Record<
  SessionState,
  {
    eyebrow: string;
    title: string;
    hint: string;
    orbClassName: string;
    glowClassName: string;
  }
> = {
  idle: {
    eyebrow: "Voice Session",
    title: "Готов к разговору",
    hint: "",
    orbClassName:
      "border-white/10 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.28),rgba(255,255,255,0.04)_38%,rgba(79,70,229,0.24)_72%,rgba(15,15,19,0.95)_100%)]",
    glowClassName: "bg-indigo-500/18",
  },
  recording: {
    eyebrow: "Listening",
    title: "Слушаю вас",
    hint: "Отпустите кнопку, чтобы сразу отправить запись.",
    orbClassName:
      "border-rose-300/25 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.24),rgba(251,113,133,0.22)_30%,rgba(190,24,93,0.38)_70%,rgba(15,15,19,0.96)_100%)]",
    glowClassName: "bg-rose-500/22",
  },
  processing: {
    eyebrow: "Thinking",
    title: "Формирую ответ",
    hint: "Сначала распознаю речь, затем подготавливаю аудиоответ.",
    orbClassName:
      "border-amber-200/20 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.18),rgba(251,191,36,0.18)_28%,rgba(99,102,241,0.28)_64%,rgba(15,15,19,0.96)_100%)]",
    glowClassName: "bg-violet-500/18",
  },
  buffering: {
    eyebrow: "Preparing Audio",
    title: "Готовлю голосовой ответ",
    hint: "Начинаю подкачивать аудио, чтобы ответ зазвучал быстрее.",
    orbClassName:
      "border-sky-200/20 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.18),rgba(125,211,252,0.18)_28%,rgba(59,130,246,0.28)_64%,rgba(15,15,19,0.96)_100%)]",
    glowClassName: "bg-sky-500/18",
  },
  playing: {
    eyebrow: "Speaking",
    title: "AI отвечает голосом",
    hint: "Дождитесь окончания воспроизведения, затем можно говорить снова.",
    orbClassName:
      "border-indigo-200/25 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.22),rgba(129,140,248,0.24)_26%,rgba(59,130,246,0.26)_50%,rgba(15,15,19,0.96)_100%)]",
    glowClassName: "bg-indigo-500/24",
  },
};

interface VoiceStageProps {
  sessionState: SessionState;
  statusMessage: string;
  recordingDurationLabel: string;
}

export function VoiceStage({
  sessionState,
  statusMessage,
  recordingDurationLabel,
}: VoiceStageProps) {
  const { theme } = useAppContext();
  const isDark = theme === "dark";
  const isMobile = useIsMobile();
  const copy = stateCopy[sessionState];

  const bgGradient =
    sessionState === "recording"
      ? "radial-gradient(circle at 50% 45%, rgba(251, 113, 133, 0.22), transparent 54%)"
      : sessionState === "processing"
      ? "radial-gradient(circle at 50% 45%, rgba(129, 140, 248, 0.18), transparent 56%)"
      : sessionState === "buffering"
      ? "radial-gradient(circle at 50% 45%, rgba(125, 211, 252, 0.18), transparent 56%)"
      : sessionState === "playing"
      ? "radial-gradient(circle at 50% 45%, rgba(59, 130, 246, 0.2), transparent 56%)"
      : "radial-gradient(circle at 50% 45%, rgba(255, 255, 255, 0.06), transparent 60%)";

  return (
    <section className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-8">
      {isMobile ? (
        <div className="absolute inset-0 opacity-80" style={{ background: bgGradient }} />
      ) : (
        <motion.div
          className="absolute inset-0 opacity-80"
          animate={{ background: bgGradient }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        />
      )}

      {isMobile ? (
        <div
          className={cn(
            "absolute h-72 w-72 rounded-full blur-xl",
            isDark ? copy.glowClassName : "bg-indigo-300/25",
          )}
        />
      ) : (
        <motion.div
          className={cn(
            "absolute h-72 w-72 rounded-full blur-3xl",
            isDark ? copy.glowClassName : "bg-indigo-300/25",
          )}
          animate={{
            scale:
              sessionState === "idle"
                ? [1, 1.08, 1]
                : sessionState === "recording"
                ? [1, 1.2, 1.02]
                : sessionState === "processing" || sessionState === "buffering"
                ? [1, 1.1, 1]
                : [1, 1.16, 1.02],
            opacity:
              sessionState === "recording"
                ? [0.5, 0.95, 0.55]
                : sessionState === "playing"
                ? [0.45, 0.9, 0.5]
                : [0.32, 0.62, 0.32],
          }}
          transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
        />
      )}

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center text-center">
        <div className="relative flex h-[19rem] w-[19rem] items-center justify-center">
          {isMobile ? (
            <>
              <div className="absolute inset-0 rounded-full border border-white/8" />
              <div className="absolute inset-6 rounded-full border border-white/12" />
            </>
          ) : (
            <>
              <motion.div
                className="absolute inset-0 rounded-full border border-white/8"
                animate={{
                  scale:
                    sessionState === "recording"
                      ? [0.95, 1.12, 1.2]
                      : sessionState === "processing" || sessionState === "buffering"
                      ? [0.98, 1.08, 1.16]
                      : sessionState === "playing"
                      ? [0.96, 1.1, 1.18]
                      : [0.98, 1.04, 1.1],
                  opacity:
                    sessionState === "idle"
                      ? [0.18, 0.3, 0.18]
                      : sessionState === "recording"
                      ? [0.22, 0.5, 0]
                      : sessionState === "processing" || sessionState === "buffering"
                      ? [0.18, 0.36, 0.1]
                      : [0.22, 0.4, 0.1],
                }}
                transition={{ repeat: Infinity, duration: 2.2, ease: "easeOut" }}
              />
              <motion.div
                className="absolute inset-6 rounded-full border border-white/12"
                animate={{
                  rotate:
                    sessionState === "processing"
                      ? 360
                      : sessionState === "buffering"
                      ? 240
                      : sessionState === "playing"
                      ? -360
                      : 0,
                  scale:
                    sessionState === "idle"
                      ? [1, 1.02, 1]
                      : sessionState === "recording"
                      ? [0.98, 1.06, 1]
                      : sessionState === "buffering"
                      ? [0.99, 1.05, 1]
                      : sessionState === "playing"
                      ? [0.98, 1.04, 1]
                      : [1, 1.03, 1],
                }}
                transition={{
                  rotate: { repeat: Infinity, duration: 10, ease: "linear" },
                  scale: { repeat: Infinity, duration: 2.2, ease: "easeInOut" },
                }}
              />
            </>
          )}

          {isMobile ? (
            <div
              className={cn(
                "relative flex h-56 w-56 items-center justify-center rounded-full border",
                isDark
                  ? `shadow-[0_24px_80px_rgba(0,0,0,0.4)] ${copy.orbClassName}`
                  : "border-slate-200 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.95),rgba(255,255,255,0.78)_38%,rgba(191,219,254,0.75)_72%,rgba(226,232,240,0.92)_100%)] shadow-[0_24px_80px_rgba(148,163,184,0.28)]",
              )}
            >
            {sessionState === "playing" ? (
              <div className="flex flex-col items-center justify-center">
                <PlaybackVisualizer />
              </div>
            ) : sessionState === "processing" || sessionState === "buffering" ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex gap-2" aria-hidden="true">
                  {[0, 1, 2].map((index) => (
                    <motion.span
                      key={index}
                      className={cn(
                        "h-3 w-3 rounded-full",
                        sessionState === "buffering" ? "bg-sky-200/90" : "bg-white/80",
                      )}
                      animate={{ y: [0, -8, 0], opacity: [0.35, 1, 0.35] }}
                      transition={{
                        repeat: Infinity,
                        duration: 0.75,
                        delay: index * 0.14,
                        ease: "easeInOut",
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                {sessionState === "recording" ? (
                  isMobile ? (
                    <div className="relative flex h-24 w-24 items-center justify-center">
                      {[0, 1, 2].map((index) => (
                        <span
                          key={index}
                          className={cn(
                            "absolute rounded-full",
                            isDark ? "border border-white/12" : "border border-slate-300/80",
                          )}
                          style={{
                            width: 56 + index * 26,
                            height: 56 + index * 26,
                          }}
                        />
                      ))}
                      <div
                        className={cn(
                          "h-4 w-4 rounded-full",
                          isDark
                            ? "bg-white shadow-[0_0_16px_rgba(255,255,255,0.35)]"
                            : "bg-indigo-500 shadow-[0_0_16px_rgba(99,102,241,0.28)]",
                        )}
                      />
                    </div>
                  ) : (
                    <motion.div
                      animate={{ scale: [1, 1.06, 1], opacity: [0.75, 1, 0.82] }}
                      transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                      className="relative flex h-24 w-24 items-center justify-center"
                    >
                      {[0, 1, 2].map((index) => (
                        <motion.span
                          key={index}
                          className={cn(
                            "absolute rounded-full",
                            isDark ? "border border-white/12" : "border border-slate-300/80",
                          )}
                          style={{
                            width: 56 + index * 26,
                            height: 56 + index * 26,
                          }}
                          animate={{
                            scale: [0.84, 1.04, 1.16],
                            opacity: [0.18, 0.34, 0],
                          }}
                          transition={{
                            repeat: Infinity,
                            duration: 1.5,
                            delay: index * 0.18,
                            ease: "easeOut",
                          }}
                        />
                      ))}
                      <motion.div
                        className={cn(
                          "h-4 w-4 rounded-full",
                          isDark
                            ? "bg-white shadow-[0_0_16px_rgba(255,255,255,0.35)]"
                            : "bg-indigo-500 shadow-[0_0_16px_rgba(99,102,241,0.28)]",
                        )}
                        animate={{ scale: [0.95, 1.08, 0.95], opacity: [0.72, 1, 0.78] }}
                        transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
                      />
                    </motion.div>
                  )
                ) : (
                  isMobile ? (
                    <div className="flex items-center justify-center">
                      <Waves
                        className={cn("h-10 w-10", isDark ? "text-white" : "text-indigo-600")}
                        strokeWidth={2.25}
                      />
                    </div>
                  ) : (
                    <motion.div
                      animate={{ scale: [1, 1.04, 1], opacity: [0.75, 0.95, 0.75] }}
                      transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
                      className="flex items-center justify-center"
                    >
                      <Waves
                        className={cn("h-10 w-10", isDark ? "text-white" : "text-indigo-600")}
                        strokeWidth={2.25}
                      />
                    </motion.div>
                  )
                )}

                {sessionState === "recording" ? (
                  isMobile ? (
                    <div
                      className={cn(
                        "rounded-full px-4 py-1.5 text-sm font-medium",
                        isDark
                          ? "border border-white/15 bg-white/10 text-white"
                          : "border border-slate-200 bg-white/80 text-slate-800",
                      )}
                    >
                      {recordingDurationLabel}
                    </div>
                  ) : (
                    <motion.div
                      className={cn(
                        "rounded-full px-4 py-1.5 text-sm font-medium",
                        isDark
                          ? "border border-white/15 bg-white/10 text-white"
                          : "border border-slate-200 bg-white/80 text-slate-800",
                      )}
                      animate={{ scale: [1, 1.04, 1], opacity: [0.7, 1, 0.8] }}
                      transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
                    >
                      {recordingDurationLabel}
                    </motion.div>
                  )
                ) : null}
              </div>
            )}
          </div>
          ) : (
          <motion.div
            className={cn(
              "relative flex h-56 w-56 items-center justify-center rounded-full border backdrop-blur-2xl",
              isDark
                ? `shadow-[0_24px_80px_rgba(0,0,0,0.4)] ${copy.orbClassName}`
                : "border-slate-200 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.95),rgba(255,255,255,0.78)_38%,rgba(191,219,254,0.75)_72%,rgba(226,232,240,0.92)_100%)] shadow-[0_24px_80px_rgba(148,163,184,0.28)]",
            )}
            animate={{
              scale:
                sessionState === "idle"
                  ? [1, 1.03, 1]
                  : sessionState === "recording"
                  ? [1, 1.06, 0.99]
                  : sessionState === "processing" || sessionState === "buffering"
                  ? [1, 1.04, 1]
                  : [1, 1.05, 1],
            }}
            transition={{ repeat: Infinity, duration: 2.1, ease: "easeInOut" }}
          >
            {sessionState === "playing" ? (
              <div className="flex flex-col items-center justify-center">
                <PlaybackVisualizer />
              </div>
            ) : sessionState === "processing" || sessionState === "buffering" ? (
              <div className="flex flex-col items-center gap-6">
                <Sparkles
                  className={cn(
                    "h-8 w-8",
                    sessionState === "buffering"
                      ? isDark
                        ? "text-sky-100"
                        : "text-sky-500"
                      : isDark
                      ? "text-amber-100"
                      : "text-amber-500",
                  )}
                />
                <div className="flex gap-2" aria-hidden="true">
                  {[0, 1, 2].map((index) => (
                    <motion.span
                      key={index}
                      className={cn(
                        "h-3 w-3 rounded-full",
                        sessionState === "buffering" ? "bg-sky-200/90" : "bg-white/80",
                      )}
                      animate={{ y: [0, -8, 0], opacity: [0.35, 1, 0.35] }}
                      transition={{
                        repeat: Infinity,
                        duration: 0.75,
                        delay: index * 0.14,
                        ease: "easeInOut",
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                {sessionState === "recording" ? (
                  <motion.div
                    animate={{ scale: [1, 1.06, 1], opacity: [0.75, 1, 0.82] }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                    className="relative flex h-24 w-24 items-center justify-center"
                  >
                    {[0, 1, 2].map((index) => (
                      <motion.span
                        key={index}
                        className={cn(
                          "absolute rounded-full",
                          isDark ? "border border-white/12" : "border border-slate-300/80",
                        )}
                        style={{
                          width: 56 + index * 26,
                          height: 56 + index * 26,
                        }}
                        animate={{
                          scale: [0.84, 1.04, 1.16],
                          opacity: [0.18, 0.34, 0],
                        }}
                        transition={{
                          repeat: Infinity,
                          duration: 1.5,
                          delay: index * 0.18,
                          ease: "easeOut",
                        }}
                      />
                    ))}

                    <motion.div
                      className={cn(
                        "h-4 w-4 rounded-full",
                        isDark
                          ? "bg-white shadow-[0_0_16px_rgba(255,255,255,0.35)]"
                          : "bg-indigo-500 shadow-[0_0_16px_rgba(99,102,241,0.28)]",
                      )}
                      animate={{ scale: [0.95, 1.08, 0.95], opacity: [0.72, 1, 0.78] }}
                      transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    animate={{ scale: [1, 1.04, 1], opacity: [0.75, 0.95, 0.75] }}
                    transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
                    className="flex items-center justify-center"
                  >
                    <Waves
                      className={cn("h-10 w-10", isDark ? "text-white" : "text-indigo-600")}
                      strokeWidth={2.25}
                    />
                  </motion.div>
                )}

                {sessionState === "recording" ? (
                  <motion.div
                    className={cn(
                      "rounded-full px-4 py-1.5 text-sm font-medium",
                      isDark
                        ? "border border-white/15 bg-white/10 text-white"
                        : "border border-slate-200 bg-white/80 text-slate-800",
                    )}
                    animate={{ scale: [1, 1.04, 1], opacity: [0.7, 1, 0.8] }}
                    transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
                  >
                    {recordingDurationLabel}
                  </motion.div>
                ) : null}
              </div>
            )}
          </motion.div>
          )}
        </div>

        <div className="mt-6 max-w-xs space-y-3">
          <p className={cn("text-[11px] uppercase tracking-[0.32em]", isDark ? "text-zinc-500" : "text-slate-500")}>
            {copy.eyebrow}
          </p>
          <h1 className={cn("text-[2rem] font-semibold leading-tight", isDark ? "text-white" : "text-slate-900")}>
            {copy.title}
          </h1>
        </div>
      </div>
    </section>
  );
}
