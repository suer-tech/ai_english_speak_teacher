# Architecture

## High-Level Overview

The system is split into a mobile-first frontend and a Python backend.

### Frontend

- `Next.js` app router
- mobile-first UI
- auth screens
- tutor preferences screen
- speaking session screen
- browser microphone access
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
- transcript and feedback presentation

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
