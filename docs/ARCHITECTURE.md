# Architecture

## High-Level Overview

The system is split into a mobile-first frontend and a Python backend.

### Frontend

- `Vite` + React app
- mobile-first UI
- auth screens
- tutor preferences screen
- speaking session screen
- hold-to-record microphone access
- Web Audio PCM capture for STT
- fixed mono `16 kHz PCM16` capture contract for STT upload
- mic constraints for `noiseSuppression`, `echoCancellation`, and `autoGainControl`
- lightweight client-side VAD for voice-state updates
- upload-based STT during recording completion
- local fallback state so the prototype remains usable before backend wiring is complete

### Backend

- `FastAPI`
- JWT auth
- SQLite persistence for local MVP
- provider services
- OpenRouter orchestration
- SaluteSpeech integration layer

## Service Boundaries

### Web App

Responsible for:

- authentication UX
- tutor setup UX
- session UI
- microphone permissions
- voice state and feedback presentation

### API App

Responsible for:

- user registration/login
- tutor settings persistence
- session lifecycle
- provider token/config management
- assembling tutor prompts
- formatting feedback payloads

## Provider Abstractions

### LLM Provider

`OpenRouterClient` should handle:

- chat completion requests
- tutor persona injection
- structured feedback response generation
- fallback response generation when API credentials are missing during local development

### Speech Provider

`SpeechProvider` should expose:

- speech-to-text interface
- text-to-speech interface
- future realtime/streaming hooks

Current speech delivery:

- STT uses REST upload (`audio/x-pcm;bit=16;rate=...`)
- TTS uses REST base64 audio responses

The initial implementation targets `SaluteSpeech`.

## Data Model

### users

- `id`
- `email`
- `password_hash`
- `created_at`

### tutor_settings

- `id`
- `user_id`
- `persona`
- `voice`
- `level`
- `ui_language`
- `created_at`
- `updated_at`

### session_messages

- `id`
- `user_id`
- `role`
- `text`
- `feedback_json`
- `created_at`

Note: session persistence is optional in very early MVP mode and can be partial.

## Local Development Defaults

- database file: `apps/api/speakai.db`
- schema is created automatically on API startup
