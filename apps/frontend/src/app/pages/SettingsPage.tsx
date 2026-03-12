/// <reference types="vite/client" />
import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Smile, BookOpen, MessageCircle, ChevronRight, Check, Moon, Sun } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { TutorPersona, EnglishLevel, formatApiError } from "../../lib/api";
import { useNavigate } from "react-router";
import { cn } from "../../lib/utils";
import { toast } from "sonner";

const PERSONAS: { id: TutorPersona; title: string; desc: string; icon: React.ElementType; color: string }[] = [
  { id: "friendly_coach", title: "Дружелюбный коуч", desc: "Поддерживает и объясняет спокойно", icon: Smile, color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
  { id: "strict_teacher", title: "Строгий преподаватель", desc: "Больше фокуса на ошибках", icon: BookOpen, color: "text-rose-400 bg-rose-400/10 border-rose-400/20" },
  { id: "conversation_buddy", title: "Разговорный buddy", desc: "Естественный диалог и уверенность", icon: MessageCircle, color: "text-indigo-400 bg-indigo-400/10 border-indigo-400/20" },
];

const LEVELS: { id: EnglishLevel; label: string }[] = [
  { id: "beginner", label: "Начальный (A1)" },
  { id: "elementary", label: "Базовый (A2)" },
  { id: "intermediate", label: "Средний (B1+)" },
];

const VOICES: { id: "female" | "male"; label: string }[] = [
  { id: "female", label: "Женский голос" },
  { id: "male", label: "Мужской голос" },
];

export function SettingsPage() {
  const { saveSettings, settings, theme, toggleTheme, logout } = useAppContext();
  const navigate = useNavigate();
  const isDark = theme === "dark";

  const [persona, setPersona] = useState<TutorPersona>(settings?.persona || "friendly_coach");
  const [level, setLevel] = useState<EnglishLevel>(settings?.level || "elementary");
  const [voice, setVoice] = useState<"female" | "male">(
    (settings?.voice as "female" | "male") || "female",
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!settings) {
      return;
    }
    setPersona(settings.persona);
    setLevel(settings.level);
    setVoice((settings.voice as "female" | "male") || "female");
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveSettings({ persona, level, voice, ui_language: "ru" });
      toast.success("Настройки сохранены");
      navigate("/session");
    } catch (error) {
      const err = error as Error & { status?: number };
      if (err.status === 401) {
        logout();
        toast.error("Сессия истекла. Войдите снова.");
        return;
      }
      toast.error(formatApiError(error, "Не удалось сохранить настройки"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto hide-scrollbar pt-12 relative z-10">
      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mb-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className={cn("text-2xl font-semibold tracking-tight mb-2", isDark ? "text-white" : "text-slate-900")}>
              Настройка репетитора
            </h1>
            <p className={cn("text-[15px] leading-relaxed", isDark ? "text-zinc-400" : "text-slate-500")}>
              Подберите стиль общения перед стартом.
            </p>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition",
              isDark
                ? "border-white/[0.08] bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900",
            )}
            aria-label="Переключить тему"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </motion.div>

      <div className="space-y-10 flex-1">
        {/* Persona Selection */}
        <motion.section
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-4"
        >
          <h2 className={cn("text-[13px] font-medium uppercase tracking-wider mb-3 ml-1", isDark ? "text-zinc-500" : "text-slate-500")}>
            Персона
          </h2>
          <div className="grid gap-3">
            {PERSONAS.map((p) => {
              const Icon = p.icon;
              const isSelected = persona === p.id;
              
              return (
                <button
                  key={p.id}
                  onClick={() => setPersona(p.id)}
                  className={cn(
                    "flex items-start text-left p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden group",
                    isSelected 
                      ? "border-indigo-500/50 bg-indigo-500/5 shadow-[0_0_30px_-5px_rgba(99,102,241,0.2)]" 
                      : isDark
                      ? "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04]"
                      : "border-slate-200 bg-white/80 hover:bg-white"
                  )}
                >
                  {/* Subtle active indicator background */}
                  {isSelected && (
                    <motion.div 
                      layoutId="activePersonaBg"
                      className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent pointer-events-none"
                      initial={false}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  
                  <div className={cn("p-2.5 rounded-xl border shrink-0 transition-colors duration-300 relative z-10", p.color, isSelected ? "bg-opacity-20" : "")}>
                    <Icon className="w-5 h-5" strokeWidth={2} />
                  </div>
                  
                  <div className="ml-4 flex-1 relative z-10">
                    <h3 className={cn("font-medium text-[15px] transition-colors duration-300", isSelected ? (isDark ? "text-indigo-200" : "text-indigo-700") : isDark ? "text-zinc-200" : "text-slate-800")}>
                      {p.title}
                    </h3>
                    <p className={cn("text-[13px] mt-1 leading-snug", isDark ? "text-zinc-400" : "text-slate-500")}>{p.desc}</p>
                  </div>

                  <div className={cn("shrink-0 ml-4 self-center transition-all duration-300", isSelected ? "opacity-100 scale-100 text-indigo-400" : "opacity-0 scale-50")}>
                    <Check className="w-5 h-5" />
                  </div>
                </button>
              );
            })}
          </div>
        </motion.section>

        <motion.section
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-4"
        >
          <h2 className={cn("text-[13px] font-medium uppercase tracking-wider mb-3 ml-1", isDark ? "text-zinc-500" : "text-slate-500")}>
            Голос преподавателя
          </h2>
          <div className={cn("flex flex-col gap-2 p-1 rounded-2xl relative", isDark ? "bg-white/[0.02] border border-white/[0.08]" : "bg-white/80 border border-slate-200")}>
            {VOICES.map((v) => {
              const isSelected = voice === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => setVoice(v.id)}
                  className="relative px-4 py-3.5 text-left text-[15px] font-medium rounded-xl transition-colors duration-200 z-10 group"
                >
                  {isSelected && (
                    <motion.div
                      layoutId="activeVoice"
                      className={cn(
                        "absolute inset-0 rounded-xl shadow-sm",
                        isDark ? "bg-white/10 border border-white/10" : "bg-slate-100 border border-slate-200",
                      )}
                      initial={false}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <div className="relative z-10 flex items-center justify-between">
                    <span className={isSelected ? (isDark ? "text-white" : "text-slate-900") : isDark ? "text-zinc-400 group-hover:text-zinc-300 transition-colors" : "text-slate-500 group-hover:text-slate-700 transition-colors"}>
                      {v.label}
                    </span>
                    {isSelected && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.8)]" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </motion.section>

        {/* Level Selection */}
        <motion.section
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-4"
        >
          <h2 className={cn("text-[13px] font-medium uppercase tracking-wider mb-3 ml-1", isDark ? "text-zinc-500" : "text-slate-500")}>
            Уровень английского
          </h2>
          <div className={cn("flex flex-col gap-2 p-1 rounded-2xl relative", isDark ? "bg-white/[0.02] border border-white/[0.08]" : "bg-white/80 border border-slate-200")}>
            {LEVELS.map((l) => {
              const isSelected = level === l.id;
              return (
                <button
                  key={l.id}
                  onClick={() => setLevel(l.id)}
                  className="relative px-4 py-3.5 text-left text-[15px] font-medium rounded-xl transition-colors duration-200 z-10 group"
                >
                  {isSelected && (
                    <motion.div
                      layoutId="activeLevel"
                      className={cn(
                        "absolute inset-0 rounded-xl shadow-sm",
                        isDark ? "bg-white/10 border border-white/10" : "bg-slate-100 border border-slate-200",
                      )}
                      initial={false}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <div className="relative z-10 flex items-center justify-between">
                    <span className={isSelected ? (isDark ? "text-white" : "text-slate-900") : isDark ? "text-zinc-400 group-hover:text-zinc-300 transition-colors" : "text-slate-500 group-hover:text-slate-700 transition-colors"}>
                      {l.label}
                    </span>
                    {isSelected && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.8)]" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </motion.section>
      </div>

      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="mt-10 pb-8 pt-8"
      >
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={cn(
            "w-full font-semibold py-4 rounded-2xl active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2 group",
            isDark
              ? "bg-white text-[#0F0F13] hover:bg-zinc-200 shadow-xl shadow-white/10"
              : "bg-slate-900 text-white hover:bg-slate-800 shadow-xl shadow-slate-300/60",
          )}
        >
          {isSaving ? (
            <motion.div 
              className={cn(
                "w-5 h-5 border-2 border-t-transparent rounded-full",
                isDark ? "border-[#0F0F13]" : "border-white",
              )}
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
            />
          ) : (
            <>
          <span>Сохранить и продолжить</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </motion.div>
    </div>
  );
}
