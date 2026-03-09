"use client";

import { useEffect, useState } from "react";

type Persona = "friendly_coach" | "strict_teacher" | "conversation_buddy";
type Level = "beginner" | "elementary" | "intermediate";

type TutorSettings = {
  persona: Persona;
  voice: string;
  level: Level;
  ui_language: "ru";
};

type FeedbackPayload = {
  corrected_text: string;
  key_feedback: string;
  pronunciation_tip?: string;
  tutor_reply: string;
};

const personaCards: Array<{
  id: Persona;
  title: string;
  subtitle: string;
}> = [
  {
    id: "friendly_coach",
    title: "Дружелюбный коуч",
    subtitle: "Поддерживает, объясняет спокойно и помогает не бояться говорить.",
  },
  {
    id: "strict_teacher",
    title: "Строгий преподаватель",
    subtitle: "Исправляет точнее и чаще обращает внимание на ошибки.",
  },
  {
    id: "conversation_buddy",
    title: "Разговорный buddy",
    subtitle: "Делает упор на естественный диалог и уверенность в речи.",
  },
];

const levelOptions: Array<{ id: Level; label: string }> = [
  { id: "beginner", label: "Beginner" },
  { id: "elementary", label: "Elementary" },
  { id: "intermediate", label: "Intermediate" },
];

const initialSettings: TutorSettings = {
  persona: "friendly_coach",
  voice: "Kin_24000",
  level: "beginner",
  ui_language: "ru",
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export default function Home() {
  const [email, setEmail] = useState("demo@speakai.app");
  const [password, setPassword] = useState("demo12345");
  const [accessToken, setAccessToken] = useState("");
  const [settings, setSettings] = useState<TutorSettings>(initialSettings);
  const [spokenText, setSpokenText] = useState(
    "Hello, I want practice English for travel and daily conversations.",
  );
  const [feedback, setFeedback] = useState<FeedbackPayload | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    "MVP-экран готов для подключения к backend API.",
  );

  useEffect(() => {
    const storedToken = window.localStorage.getItem("speakai.accessToken");
    const stored = window.localStorage.getItem("speakai.tutorSettings");
    if (storedToken) {
      setAccessToken(storedToken);
      setStatusMessage("Токен найден. Можно загрузить настройки и продолжить.");
    }
    if (!stored) {
      return;
    }

    try {
      setSettings(JSON.parse(stored) as TutorSettings);
    } catch {
      window.localStorage.removeItem("speakai.tutorSettings");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("speakai.tutorSettings", JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (accessToken) {
      window.localStorage.setItem("speakai.accessToken", accessToken);
      return;
    }

    window.localStorage.removeItem("speakai.accessToken");
  }, [accessToken]);

  async function authenticate(mode: "register" | "login") {
    setIsSubmitting(true);
    setStatusMessage(mode === "register" ? "Создаем аккаунт..." : "Входим в аккаунт...");

    try {
      const response = await fetch(`${apiBaseUrl}/auth/${mode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const payload = (await response.json()) as
        | { access_token: string }
        | { detail?: string };

      if (!response.ok || !("access_token" in payload)) {
        const message = "detail" in payload ? payload.detail : undefined;
        throw new Error(message ?? "Auth error");
      }

      setAccessToken(payload.access_token);
      setStatusMessage("Авторизация успешна. Теперь можно сохранять настройки на сервер.");
      await loadSettings(payload.access_token);
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? `Auth не выполнен: ${error.message}`
          : "Auth не выполнен. Проверь backend.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function loadSettings(token = accessToken) {
    if (!token) {
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/settings/tutor`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as TutorSettings | null;
      if (payload) {
        setSettings(payload);
      }
    } catch {
      // Keep local settings if backend is unavailable.
    }
  }

  async function saveSettings() {
    if (!accessToken) {
      setStatusMessage("Сначала зарегистрируйся или войди, чтобы сохранить настройки на сервер.");
      return;
    }

    setIsSubmitting(true);
    setStatusMessage("Сохраняем настройки репетитора...");

    try {
      const response = await fetch(`${apiBaseUrl}/settings/tutor`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error("Не удалось сохранить настройки на сервере.");
      }

      setStatusMessage("Настройки сохранены. Можно начинать speaking-сессию.");
    } catch {
      setStatusMessage(
        "Backend пока не подключен. Настройки сохранены локально для прототипа.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function requestTutorReply() {
    setIsSubmitting(true);
    setStatusMessage("Репетитор анализирует реплику...");

    try {
      const response = await fetch(`${apiBaseUrl}/sessions/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: spokenText,
          settings,
        }),
      });

      if (!response.ok) {
        throw new Error("Tutor API error");
      }

      const payload = (await response.json()) as FeedbackPayload;
      setFeedback(payload);
      setStatusMessage("Ответ получен. Можно продолжать разговор.");
    } catch {
      setFeedback({
        corrected_text: "Hello, I want to practice English for travel and daily conversations.",
        key_feedback:
          "После want нужен инфинитив: say 'want to practice', а не 'want practice'.",
        pronunciation_tip:
          "Обрати внимание на связку звуков в 'want to' и четко произнеси 'practice'.",
        tutor_reply:
          "Great start. Tell me about a trip you would like to take and why it is interesting for you.",
      });
      setStatusMessage(
        "Пока показываю локальный ответ-заглушку. Когда backend будет запущен, здесь появится живой tutor loop.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function playTutorVoice() {
    if (!feedback?.tutor_reply) {
      setStatusMessage("Сначала получи ответ репетитора.");
      return;
    }

    setIsPlayingVoice(true);
    setStatusMessage("Запрашиваем озвучку у SaluteSpeech...");

    try {
      const response = await fetch(`${apiBaseUrl}/sessions/tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: feedback.tutor_reply,
          voice: settings.voice,
          language: "en",
        }),
      });

      const payload = (await response.json()) as
        | {
            audio_base64: string;
            content_type: string;
          }
        | { detail?: string };

      if (!response.ok || !("audio_base64" in payload)) {
        const message = "detail" in payload ? payload.detail : undefined;
        throw new Error(message ?? "TTS error");
      }

      const binaryString = window.atob(payload.audio_base64);
      const bytes = Uint8Array.from(binaryString, (char) => char.charCodeAt(0));
      const blob = new Blob([bytes], { type: payload.content_type });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
      setStatusMessage("Озвучка воспроизводится.");
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? `Озвучка не получена: ${error.message}`
          : "Озвучка не получена.",
      );
    } finally {
      setIsPlayingVoice(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="eyebrow">SpeakAI MVP</span>
          <h1>Разговорный английский с ИИ-репетитором</h1>
          <p>
            Mobile-first MVP для живых speaking-сессий. Пользователь говорит по-английски,
            получает понятную обратную связь на русском и продолжает диалог без лишнего стресса.
          </p>
        </div>
        <div className="hero-badge">
          <span>Low-cost stack</span>
          <strong>SaluteSpeech + OpenRouter</strong>
        </div>
      </section>

      <section className="grid">
        <article className="panel">
          <div className="panel-header">
            <span className="panel-step">01</span>
            <h2>Аккаунт</h2>
          </div>

          <label className="field">
            <span>Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder="you@example.com"
            />
          </label>

          <label className="field">
            <span>Пароль</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder="Минимум 8 символов"
            />
          </label>

          <div className="auth-actions">
            <button
              className="primary-button"
              disabled={isSubmitting}
              onClick={() => authenticate("register")}
              type="button"
            >
              Регистрация
            </button>
            <button
              className="secondary-button"
              disabled={isSubmitting}
              onClick={() => authenticate("login")}
              type="button"
            >
              Войти
            </button>
          </div>

          <p className="hint">
            {accessToken
              ? "Сессия авторизации активна. Настройки можно сохранять в backend."
              : "Используй backend auth, чтобы сохранять настройки между сессиями."}
          </p>
        </article>

        <article className="panel">
          <div className="panel-header">
            <span className="panel-step">02</span>
            <h2>Репетитор</h2>
          </div>

          <div className="persona-list">
            {personaCards.map((persona) => (
              <button
                key={persona.id}
                className={`persona-card ${
                  settings.persona === persona.id ? "persona-card-active" : ""
                }`}
                onClick={() => setSettings((current) => ({ ...current, persona: persona.id }))}
                type="button"
              >
                <strong>{persona.title}</strong>
                <span>{persona.subtitle}</span>
              </button>
            ))}
          </div>

          <div className="split-fields">
            <label className="field">
              <span>Уровень</span>
              <select
                value={settings.level}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    level: event.target.value as Level,
                  }))
                }
              >
                {levelOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Голос</span>
              <input
                value={settings.voice}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    voice: event.target.value,
                  }))
                }
                type="text"
                placeholder="Kin_24000"
              />
            </label>
          </div>

          <button className="primary-button" disabled={isSubmitting} onClick={saveSettings} type="button">
            Сохранить настройки
          </button>
        </article>
      </section>

      <section className="panel session-panel">
        <div className="panel-header">
          <span className="panel-step">03</span>
          <h2>Speaking-сессия</h2>
        </div>

        <div className="session-banner">
          <div>
            <strong>Realtime-ready UX</strong>
            <p>
              На этом шаге мы закладываем интерфейс, в который позже встраиваем потоковый STT/TTS
              от `SaluteSpeech`.
            </p>
          </div>
          <button className="secondary-button" type="button">
            Подключить микрофон
          </button>
        </div>

        <label className="field">
          <span>Что сказал пользователь</span>
          <textarea
            value={spokenText}
            onChange={(event) => setSpokenText(event.target.value)}
            rows={5}
          />
        </label>

        <div className="session-actions">
          <button className="primary-button" disabled={isSubmitting} onClick={requestTutorReply} type="button">
            Получить ответ репетитора
          </button>
          <button
            className="secondary-button"
            disabled={isPlayingVoice || !feedback?.tutor_reply}
            onClick={playTutorVoice}
            type="button"
          >
            Озвучить ответ
          </button>
        </div>

        <p className="status">{statusMessage}</p>

        <div className="feedback-grid">
          <article className="feedback-card">
            <span className="feedback-label">Better version</span>
            <p>{feedback?.corrected_text ?? "Здесь появится улучшенная версия фразы."}</p>
          </article>

          <article className="feedback-card">
            <span className="feedback-label">Ключевая правка</span>
            <p>{feedback?.key_feedback ?? "Здесь появится главная правка по реплике."}</p>
          </article>

          <article className="feedback-card">
            <span className="feedback-label">Pronunciation tip</span>
            <p>{feedback?.pronunciation_tip ?? "Здесь будет короткая подсказка по произношению."}</p>
          </article>

          <article className="feedback-card accent-card">
            <span className="feedback-label">Tutor reply</span>
            <p>{feedback?.tutor_reply ?? "Здесь появится ответ ИИ-репетитора."}</p>
          </article>
        </div>
      </section>
    </main>
  );
}
