import { Outlet, Navigate, useLocation } from "react-router";
import { useAppContext } from "../context/AppContext";
import { Toaster } from "sonner";
import { ErrorBoundary } from "./ErrorBoundary";

export function RootLayout() {
  const { token, settings, isBootstrapping, theme } = useAppContext();
  const location = useLocation();
  const isDark = theme === "dark";

  // Basic routing logic based on state
  if (isBootstrapping) {
    return (
      <div
        className={`min-h-screen w-full font-sans flex items-center justify-center ${
          isDark ? "bg-[#0F0F13] text-zinc-100" : "bg-slate-100 text-slate-900"
        }`}
      >
        <div className={`text-sm ${isDark ? "text-zinc-400" : "text-slate-500"}`}>Загрузка...</div>
      </div>
    );
  }

  if (!token && location.pathname !== "/") {
    return <Navigate to="/" replace />;
  }

  if (token && !settings && location.pathname !== "/settings") {
    return <Navigate to="/settings" replace />;
  }

  if (token && settings && location.pathname === "/") {
    return <Navigate to="/session" replace />;
  }

  return (
    <div
      className={`min-h-screen w-full font-sans selection:bg-indigo-500/30 overflow-hidden relative flex flex-col items-center justify-center ${
        isDark ? "bg-[#0F0F13] text-zinc-100" : "bg-slate-100 text-slate-900"
      }`}
    >
      {/* Abstract Background Elements */}
      <div
        className={`absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] rounded-full blur-[120px] mix-blend-screen pointer-events-none ${
          isDark ? "bg-indigo-600/10" : "bg-indigo-300/25"
        }`}
      />
      <div
        className={`absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full blur-[120px] mix-blend-screen pointer-events-none ${
          isDark ? "bg-fuchsia-600/10" : "bg-fuchsia-300/20"
        }`}
      />
      
      <div
        className={`w-full max-w-md h-full min-h-[100dvh] flex flex-col relative z-10 backdrop-blur-3xl shadow-2xl overflow-y-auto hide-scrollbar ${
          isDark
            ? "sm:border-x sm:border-white/[0.04] bg-[#0F0F13]/50"
            : "sm:border-x sm:border-slate-200/80 bg-white/75"
        }`}
      >
        <div key={location.pathname} className="flex h-full flex-1 flex-col">
          <ErrorBoundary fallbackMessage="Если страница не загрузилась, попробуйте обновить или вернуться назад.">
            <Outlet />
          </ErrorBoundary>
        </div>
      </div>

      <Toaster 
        theme={isDark ? "dark" : "light"} 
        position="top-center" 
        toastOptions={{
          style: {
            background: isDark ? "rgba(24, 24, 27, 0.8)" : "rgba(255, 255, 255, 0.9)",
            backdropFilter: "blur(12px)",
            border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(148, 163, 184, 0.25)",
            color: isDark ? "#fff" : "#0f172a"
          }
        }}
      />
    </div>
  );
}
