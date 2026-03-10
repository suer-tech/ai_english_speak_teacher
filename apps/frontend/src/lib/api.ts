export type TutorPersona = "friendly_coach" | "strict_teacher" | "conversation_buddy";
export type EnglishLevel = "beginner" | "elementary" | "intermediate";

export interface TutorSettings {
  persona: TutorPersona;
  level: EnglishLevel;
  voice: string;
  ui_language: "ru";
}

export interface TutorReply {
  corrected_text: string;
  key_feedback: string;
  pronunciation_tip?: string;
  tutor_reply: string;
}

export interface TextToSpeechResponse {
  audio_base64: string;
  content_type: string;
  voice: string;
}

export interface StreamingTextToSpeechResponse {
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  voice: string;
  sampleRate: number;
}

type SpeechToTextStreamEvent =
  | { type: "ready" }
  | { type: "partial_transcript"; transcript: string }
  | { type: "final_transcript"; transcript: string }
  | { type: "error"; message: string };

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

function buildWebSocketUrl(path: string, params: Record<string, string>) {
  const url = new URL(API_BASE_URL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname}${path}`;

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

type RequestOptions = Omit<RequestInit, "body" | "headers"> & {
  body?: unknown;
  token?: string | null;
};

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, token, ...rest } = options;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(rest.headers ?? {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let message = "Request failed";
    try {
      const payload = (await response.json()) as { detail?: string | Array<{ msg?: string }> };
      if (Array.isArray(payload?.detail) && payload.detail.length > 0) {
        const first = payload.detail[0];
        if (first?.msg) {
          message = first.msg;
        }
      } else if (typeof payload?.detail === "string") {
        message = payload.detail;
      }
    } catch {
      // ignore JSON parsing errors
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export function formatApiError(error: unknown, fallback: string) {
  const raw = error instanceof Error ? error.message : fallback;
  const normalized = raw?.toString?.() ?? fallback;

  const mappings: Array<[RegExp, string]> = [
    [/at least 8 characters/i, "Пароль должен быть не короче 8 символов."],
    [/not authenticated/i, "Нужна авторизация. Войдите снова."],
    [/salute_speech_api_key is not configured/i, "Не настроен ключ SaluteSpeech."],
    [/salutespeech/i, "Ошибка SaluteSpeech. Проверьте ключи и доступность сервиса."],
    [/openrouter/i, "Ошибка OpenRouter. Проверьте ключ и баланс."],
    [/there was an error parsing the body/i, "Ошибка формата запроса."],
    [/auth/i, "Ошибка авторизации."],
  ];

  for (const [pattern, friendly] of mappings) {
    if (pattern.test(normalized)) {
      return friendly;
    }
  }

  return normalized || fallback;
}

export class SpeechToTextStreamClient {
  private readonly socket: WebSocket;
  private readonly connectPromise: Promise<void>;
  private readonly finalTranscriptPromise: Promise<string>;
  private readonly resolveFinalTranscript: (value: string) => void;
  private readonly rejectFinalTranscript: (reason?: unknown) => void;
  private hasFinished = false;

  constructor({
    token,
    language,
    sampleRate,
  }: {
    token: string;
    language: string;
    sampleRate: number;
  }) {
    const socketUrl = buildWebSocketUrl("/sessions/stt/stream", {
      token,
    });

    this.socket = new WebSocket(socketUrl);
    this.socket.binaryType = "arraybuffer";

    this.connectPromise = new Promise<void>((resolve, reject) => {
      this.socket.onopen = () => {
        this.socket.send(
          JSON.stringify({
            type: "start",
            language,
            sample_rate: sampleRate,
          }),
        );
      };

      this.socket.onmessage = (event) => {
        let payload: SpeechToTextStreamEvent;
        try {
          payload = JSON.parse(String(event.data)) as SpeechToTextStreamEvent;
        } catch {
          return;
        }

        if (payload.type === "ready") {
          resolve();
          return;
        }

        if (payload.type === "final_transcript") {
          this.hasFinished = true;
          this.resolveFinalTranscript(payload.transcript);
          this.socket.close();
          return;
        }

        if (payload.type === "error") {
          const error = new Error(payload.message || "Streaming speech recognition failed");
          reject(error);
          this.rejectFinalTranscript(error);
          this.socket.close();
        }
      };

      this.socket.onerror = () => {
        const error = new Error("Streaming speech recognition failed");
        reject(error);
        this.rejectFinalTranscript(error);
      };

      this.socket.onclose = () => {
        if (!this.hasFinished) {
          this.rejectFinalTranscript(new Error("Streaming speech recognition interrupted"));
        }
      };
    });

    let resolveTranscript!: (value: string) => void;
    let rejectTranscript!: (reason?: unknown) => void;
    this.finalTranscriptPromise = new Promise<string>((resolve, reject) => {
      resolveTranscript = resolve;
      rejectTranscript = reject;
    });
    this.resolveFinalTranscript = resolveTranscript;
    this.rejectFinalTranscript = rejectTranscript;
    void this.finalTranscriptPromise.catch(() => undefined);
  }

  async connect() {
    await this.connectPromise;
  }

  sendAudioChunk(chunk: Uint8Array) {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(chunk);
    }
  }

  async finish() {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: "stop" }));
    }
    return this.finalTranscriptPromise;
  }

  close() {
    if (
      this.socket.readyState === WebSocket.OPEN ||
      this.socket.readyState === WebSocket.CONNECTING
    ) {
      this.socket.close();
    }
  }
}

export async function register(email: string, password: string) {
  return apiRequest<{ access_token: string }>("/auth/register", {
    method: "POST",
    body: { email, password },
  });
}

export async function login(email: string, password: string) {
  return apiRequest<{ access_token: string }>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export async function fetchTutorSettings(token: string) {
  return apiRequest<TutorSettings | null>("/settings/tutor", {
    method: "GET",
    token,
  });
}

export async function saveTutorSettings(token: string, settings: TutorSettings) {
  return apiRequest<TutorSettings>("/settings/tutor", {
    method: "PUT",
    token,
    body: settings,
  });
}

export async function speechToText(audio: Blob, language = "en-US", sampleRate?: number) {
  const formData = new FormData();
  formData.append("audio", audio, "speech.pcm");
  const query = new URLSearchParams({ language });
  if (sampleRate) {
    query.set("sample_rate", sampleRate.toString());
  }

  const response = await fetch(
    `${API_BASE_URL}/sessions/stt?${query.toString()}`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) {
    let message = "Speech recognition failed";
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload?.detail) {
        message = payload.detail;
      }
    } catch {
      // ignore JSON parsing errors
    }
    throw new Error(message);
  }

  const payload = (await response.json()) as { transcript: string };
  return payload.transcript;
}

export async function generateTutorReply(text: string, settings: TutorSettings) {
  return apiRequest<TutorReply>("/sessions/respond", {
    method: "POST",
    body: { text, settings },
  });
}

export async function textToSpeech(text: string, voice: string) {
  return apiRequest<TextToSpeechResponse>("/sessions/tts", {
    method: "POST",
    body: { text, voice, language: "en" },
  });
}

export async function textToSpeechStream(
  text: string,
  voice: string,
  signal?: AbortSignal,
): Promise<StreamingTextToSpeechResponse> {
  const response = await fetch(`${API_BASE_URL}/sessions/tts/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, voice, language: "en" }),
    signal,
  });

  if (!response.ok) {
    let message = "Streaming speech synthesis failed";
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload?.detail) {
        message = payload.detail;
      }
    } catch {
      // ignore JSON parsing errors
    }
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error("Browser does not support streaming audio responses");
  }

  return {
    stream: response.body,
    contentType: response.headers.get("Content-Type") ?? "audio/x-pcm;bit=16;rate=24000",
    voice: response.headers.get("X-Speech-Voice") ?? voice,
    sampleRate: Number(response.headers.get("X-Speech-Sample-Rate") ?? 24000),
  };
}
