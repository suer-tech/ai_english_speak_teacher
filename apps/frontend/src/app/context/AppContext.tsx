import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import {
  TutorSettings,
  fetchTutorSettings,
  saveTutorSettings,
} from "../../lib/api";

interface AppContextType {
  token: string | null;
  settings: TutorSettings | null;
  theme: "dark" | "light";
  isBootstrapping: boolean;
  login: (token: string) => void;
  logout: () => void;
  saveSettings: (settings: TutorSettings) => Promise<void>;
  toggleTheme: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("access_token");
  });
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const savedTheme = localStorage.getItem("app_theme");
    return savedTheme === "light" ? "light" : "dark";
  });

  const [settings, setSettings] = useState<TutorSettings | null>(() => {
    const saved = localStorage.getItem("tutor_settings");
    return saved ? JSON.parse(saved) : null;
  });
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const login = (newToken: string) => {
    setToken(newToken);
    localStorage.setItem("access_token", newToken);
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem("access_token");
    localStorage.removeItem("tutor_settings");
    setSettings(null);
  };

  const toggleTheme = () => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      localStorage.setItem("app_theme", next);
      return next;
    });
  };

  const saveSettings = async (newSettings: TutorSettings) => {
    if (token) {
      const saved = await saveTutorSettings(token, newSettings);
      setSettings(saved);
      localStorage.setItem("tutor_settings", JSON.stringify(saved));
      return;
    }

    setSettings(newSettings);
    localStorage.setItem("tutor_settings", JSON.stringify(newSettings));
  };

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (!token) {
        setIsBootstrapping(false);
        return;
      }

      try {
        const remote = await fetchTutorSettings(token);
        if (cancelled) {
          return;
        }
        if (remote) {
          setSettings(remote);
          localStorage.setItem("tutor_settings", JSON.stringify(remote));
        }
      } catch {
        // Keep local settings if backend is unavailable.
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    };

    setIsBootstrapping(true);
    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <AppContext.Provider
      value={{ token, settings, theme, isBootstrapping, login, logout, saveSettings, toggleTheme }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
}
