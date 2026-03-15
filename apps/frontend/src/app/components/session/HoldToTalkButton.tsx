import { memo, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Mic } from "lucide-react";
import { cn } from "../../../lib/utils";
import { useIsMobile } from "../../../hooks/useIsMobile";
import type { SessionState } from "./types";

interface HoldToTalkButtonProps {
  sessionState: SessionState;
  isPressed: boolean;
  onPointerDown: () => Promise<void> | void;
  onPointerUp: () => Promise<void> | void;
  onPointerCancel: () => Promise<void> | void;
  onPointerLeave?: () => Promise<void> | void;
}

const helperText: Record<SessionState, string> = {
  idle: "Нажми и говори",
  recording: "Нажми и говори",
  processing: "AI думает",
  buffering: "AI готовит голос",
  playing: "AI отвечает",
};

export const HoldToTalkButton = memo(function HoldToTalkButton({
  sessionState,
  isPressed,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  onPointerLeave,
}: HoldToTalkButtonProps) {
  const isMobile = useIsMobile();
  const isBusy =
    sessionState === "processing" || sessionState === "buffering" || sessionState === "playing";
  const showPressedState = isPressed || sessionState === "recording";

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (isBusy) return;
    void onPointerDown();
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    void onPointerUp();
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    void onPointerCancel();
  };

  return (
    <div className="relative z-10 flex flex-col items-center px-6 pb-6 pt-6">
      <div className="relative flex h-24 items-center justify-center">
        {!isMobile && (
          <AnimatePresence>
            {showPressedState ? (
              <>
                <motion.div
                  initial={{ opacity: 0.4, scale: 1 }}
                  animate={{ opacity: 0, scale: 2 }}
                  exit={{ opacity: 0 }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut" }}
                  className="absolute h-20 w-20 rounded-full bg-rose-500"
                />
                <motion.div
                  initial={{ opacity: 0.5, scale: 1 }}
                  animate={{ opacity: 0, scale: 2.5 }}
                  exit={{ opacity: 0 }}
                  transition={{ repeat: Infinity, duration: 1.5, delay: 0.4, ease: "easeOut" }}
                  className="absolute h-20 w-20 rounded-full bg-rose-500/50"
                />
              </>
            ) : null}
          </AnimatePresence>
        )}

        <motion.button
          type="button"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onPointerLeave={() => void onPointerLeave?.()}
          onContextMenu={(event) => event.preventDefault()}
          disabled={isBusy}
          aria-label={helperText[sessionState]}
          animate={{
            scale: showPressedState ? 1 : 1,
            y: sessionState === "playing" ? 72 : 0,
            opacity: sessionState === "playing" ? 0 : 1,
            backgroundColor:
              showPressedState
                ? "#f43f5e"
                : "#ffffff",
          }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className={cn(
            "relative z-10 flex h-20 w-20 select-none touch-none items-center justify-center rounded-full shadow-2xl outline-none",
            showPressedState
              ? "shadow-[0_0_40px_rgba(244,63,94,0.42)]"
              : "shadow-black/50",
            isBusy ? "cursor-default" : "cursor-pointer",
          )}
          style={{ WebkitTapHighlightColor: "transparent", touchAction: "none" }}
        >
          <AnimatePresence mode="wait">
            {showPressedState ? (
              <motion.span
                key="stop-core"
                initial={{ opacity: 0, scale: 0.65, borderRadius: 14 }}
                animate={{ opacity: 1, scale: 1, borderRadius: 6 }}
                exit={{ opacity: 0, scale: 0.65, borderRadius: 14 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                className="block h-8 w-8 rounded-md bg-white shadow-[0_2px_12px_rgba(255,255,255,0.25)]"
              >
              </motion.span>
            ) : (
              <motion.span
                key="mic"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
              >
                <Mic
                  className="h-8 w-8 text-[#0F0F13]"
                  strokeWidth={2.5}
                />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      <motion.p
        animate={{
          opacity: sessionState === "idle" ? 1 : 0,
        }}
        className="mt-4 whitespace-nowrap text-[12px] font-medium uppercase tracking-widest text-zinc-400"
      >
        {helperText.idle}
      </motion.p>
    </div>
  );
});
