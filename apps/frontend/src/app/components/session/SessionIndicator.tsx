import { motion } from "motion/react";
import { Settings2, Sparkles } from "lucide-react";
import { cn } from "../../../lib/utils";
import { useAppContext } from "../../context/AppContext";
import type { SessionState } from "./types";

const statusLabels: Record<SessionState, string> = {
  idle: "Готов",
  recording: "Слушаю",
  processing: "Думаю",
  buffering: "Готовлю звук",
  playing: "Говорю",
};

const statusDotClasses: Record<SessionState, string> = {
  idle: "bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.65)]",
  recording: "bg-rose-400 shadow-[0_0_14px_rgba(251,113,133,0.7)]",
  processing: "bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.65)]",
  buffering: "bg-sky-300 shadow-[0_0_14px_rgba(125,211,252,0.68)]",
  playing: "bg-indigo-400 shadow-[0_0_14px_rgba(129,140,248,0.75)]",
};

interface SessionIndicatorProps {
  personaTitle: string;
  sessionState: SessionState;
  onOpenSettings: () => void;
}

export function SessionIndicator({
  personaTitle,
  sessionState,
  onOpenSettings,
}: SessionIndicatorProps) {
  const { theme } = useAppContext();
  const isDark = theme === "dark";

  return (
    <header className="relative z-10 flex items-center justify-between px-6 pt-6">
      <div
        className={cn(
          "flex items-center gap-3 rounded-full px-4 py-3 backdrop-blur-xl",
          isDark ? "border border-white/10 bg-white/[0.04]" : "border border-slate-200 bg-white/75",
        )}
      >
        <div
          className={cn(
            "relative flex h-11 w-11 items-center justify-center rounded-full",
            isDark ? "border border-white/10 bg-white/[0.06]" : "border border-slate-200 bg-slate-100/90",
          )}
        >
          <motion.div
            className={cn(
              "absolute inset-1 rounded-full blur-md",
              isDark ? "bg-indigo-400/20" : "bg-indigo-300/40",
            )}
            animate={{
              scale:
                sessionState === "idle"
                  ? [1, 1.08, 1]
                  : sessionState === "recording"
                  ? [1, 1.18, 1]
                  : sessionState === "processing"
                  ? [1, 1.12, 1]
                  : [1, 1.22, 1],
            }}
            transition={{ repeat: Infinity, duration: 2.6, ease: "easeInOut" }}
          />
          <Sparkles className={cn("relative z-10 h-5 w-5", isDark ? "text-indigo-300" : "text-indigo-600")} />
        </div>

        <div>
          <p className={cn("text-[11px] uppercase tracking-[0.26em]", isDark ? "text-zinc-500" : "text-slate-500")}>
            AI Voice
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className={cn("text-sm font-medium", isDark ? "text-white" : "text-slate-900")}>
              {personaTitle}
            </span>
            <span className={cn("h-2.5 w-2.5 rounded-full", statusDotClasses[sessionState])} />
            <span className={cn("text-xs", isDark ? "text-zinc-400" : "text-slate-500")}>
              {statusLabels[sessionState]}
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenSettings}
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full backdrop-blur-xl transition",
          isDark
            ? "border border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
            : "border border-slate-200 bg-white/75 text-slate-500 hover:bg-white hover:text-slate-900",
        )}
        aria-label="Открыть настройки"
      >
        <Settings2 className="h-5 w-5" />
      </button>
    </header>
  );
}
