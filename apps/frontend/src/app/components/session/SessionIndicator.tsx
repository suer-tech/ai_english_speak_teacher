import React, { memo } from "react";
import { Settings2 } from "lucide-react";
import { cn } from "../../../lib/utils";
import { useAppContext } from "../../context/AppContext";
import { useIsMobile } from "../../../hooks/useIsMobile";
import type { SessionState } from "./types";

interface SessionIndicatorProps {
  personaTitle: string;
  sessionState: SessionState;
  onOpenSettings: () => void;
}

export const SessionIndicator = memo(function SessionIndicator({
  personaTitle: _personaTitle,
  sessionState: _sessionState,
  onOpenSettings,
}: SessionIndicatorProps) {
  const { theme } = useAppContext();
  const isDark = theme === "dark";
  const isMobile = useIsMobile();

  return (
    <header className="relative z-10 flex items-center justify-between px-6 pt-6">
      <p
        className={cn(
          "text-[11px] font-medium uppercase tracking-[0.26em]",
          isDark ? "text-zinc-500" : "text-slate-500",
        )}
      >
        AI Voice
      </p>

      <button
        type="button"
        onClick={onOpenSettings}
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full transition",
          !isMobile && "backdrop-blur-xl",
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
});
