import { useState } from "react";
import { motion } from "motion/react";
import { Lock, Mail, ChevronRight, Wand2 } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import { login as apiLogin, register as apiRegister, formatApiError } from "../../lib/api";

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, theme } = useAppContext();
  const isDark = theme === "dark";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Заполните все поля");
      return;
    }

    if (password.length < 8) {
      toast.error("Пароль должен быть не короче 8 символов.");
      return;
    }

    setLoading(true);
    try {
      const payload = isLogin
        ? await apiLogin(email, password)
        : await apiRegister(email, password);
      login(payload.access_token);
      toast.success(isLogin ? "С возвращением!" : "Аккаунт создан");
    } catch (error) {
      toast.error(formatApiError(error, "Ошибка авторизации"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center px-6 py-12 pb-24 h-full relative z-10">
      <div
        className={cn(
          "absolute top-0 inset-x-0 h-40 bg-gradient-to-b pointer-events-none",
          isDark ? "from-[#0F0F13] to-transparent" : "from-white/80 to-transparent",
        )}
      />
      
      <div className="max-w-sm mx-auto w-full relative">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-10"
        >
          <div
            className={cn(
              "inline-flex items-center justify-center p-3 rounded-2xl mb-6 backdrop-blur-md",
              isDark
                ? "bg-white/[0.03] border border-white/[0.08] shadow-xl shadow-black/50"
                : "bg-white/80 border border-slate-200 shadow-xl shadow-slate-200/60",
            )}
          >
            <Wand2 className={cn("w-8 h-8 drop-shadow-md", isDark ? "text-indigo-400" : "text-indigo-600")} />
          </div>
          <h1 className={cn("text-3xl font-semibold tracking-tight", isDark ? "text-white/90" : "text-slate-900")}>
            {isLogin ? "С возвращением" : "Создать аккаунт"}
          </h1>
          <p className={cn("mt-2 text-sm max-w-[260px] mx-auto leading-relaxed", isDark ? "text-zinc-400" : "text-slate-500")}>
            {isLogin
              ? "Продолжим практику английского"
              : "Начните говорить по‑английски увереннее уже сегодня"}
          </p>
        </motion.div>

        {/* Auth Toggle */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "p-1 rounded-xl flex items-center mb-8 relative",
            isDark ? "bg-white/[0.02] border border-white/[0.05]" : "bg-white/80 border border-slate-200",
          )}
        >
          <div className="flex-1 flex relative">
            <motion.div
              layoutId="activeTab"
              className={cn(
                "absolute inset-0 rounded-lg shadow-sm backdrop-blur-md",
                isDark ? "bg-white/10 border border-white/10" : "bg-slate-100 border border-slate-200",
              )}
              initial={false}
              animate={{ 
                x: isLogin ? 0 : "100%", 
                width: "50%" 
              }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
            <button
              onClick={() => setIsLogin(true)}
              className={cn(
                "relative z-10 flex-1 py-2 text-sm font-medium transition-colors duration-200 text-center",
                isLogin ? (isDark ? "text-white" : "text-slate-900") : isDark ? "text-zinc-400 hover:text-zinc-200" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Войти
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={cn(
                "relative z-10 flex-1 py-2 text-sm font-medium transition-colors duration-200 text-center",
                !isLogin ? (isDark ? "text-white" : "text-slate-900") : isDark ? "text-zinc-400 hover:text-zinc-200" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Регистрация
            </button>
          </div>
        </motion.div>

        <motion.form 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          onSubmit={handleSubmit} 
          className="space-y-4"
        >
          <div className="space-y-4">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Mail className={cn("h-4 w-4 group-focus-within:text-indigo-400 transition-colors duration-300", isDark ? "text-zinc-500" : "text-slate-400")} />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={cn(
                  "w-full rounded-xl pl-10 pr-4 py-3.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-300",
                  isDark
                    ? "bg-white/[0.03] border border-white/[0.08] text-white placeholder:text-zinc-500"
                    : "bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400",
                )}
                placeholder="Email"
              />
            </div>
            
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className={cn("h-4 w-4 group-focus-within:text-indigo-400 transition-colors duration-300", isDark ? "text-zinc-500" : "text-slate-400")} />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn(
                  "w-full rounded-xl pl-10 pr-4 py-3.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-300",
                  isDark
                    ? "bg-white/[0.03] border border-white/[0.08] text-white placeholder:text-zinc-500"
                    : "bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400",
                )}
                placeholder="Пароль"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={cn(
              "w-full mt-6 font-semibold py-3.5 rounded-xl active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2 group relative overflow-hidden",
              isDark ? "bg-white text-[#0F0F13] hover:bg-zinc-200" : "bg-slate-900 text-white hover:bg-slate-800",
            )}
          >
            {loading ? (
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
                <span>{isLogin ? "Войти" : "Создать аккаунт"}</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
            {!loading && (
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 pointer-events-none" />
            )}
          </button>
        </motion.form>
      </div>
    </div>
  );
}
