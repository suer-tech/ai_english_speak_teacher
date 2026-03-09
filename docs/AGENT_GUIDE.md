# Agent Guide

## Product Mission

SpeakAI is a mobile-first speaking coach for English learners. The experience should feel like talking to a supportive AI tutor, not filling out language exercises.

The product must optimize for:

- low-friction voice conversation
- quick, understandable feedback in Russian
- supportive correction instead of harsh interruption
- fast MVP delivery with minimal fixed cost

## Chosen MVP Stack

- Frontend: `Next.js`
- Backend: `FastAPI`
- Database: `SQLite` for MVP, swappable later
- Tutor brain: `OpenRouter`
- Speech layer: `SaluteSpeech`
- Auth: custom JWT auth in backend

## Primary User Flows

### 1. Onboarding

- User signs up or logs in
- User chooses tutor persona:
  - friendly coach
  - strict teacher
  - conversation buddy
- User chooses tutor voice
- User chooses English level

### 2. Speaking Session

- User opens the speaking screen
- User grants microphone access
- User starts speaking
- App shows transcript and session state
- Backend requests tutor reply from OpenRouter
- App plays tutor response through speech synthesis provider
- App shows compact Russian feedback

### 3. Session Feedback

Each turn should prefer a compact structure:

- what the user said
- better/natural version
- one key correction
- one pronunciation hint when possible
- tutor reply

## MVP Engineering Principles

- Keep fixed monthly costs near zero
- Prefer provider abstraction so speech/LLM vendors can be swapped later
- Keep realtime-ready interfaces even if the first implementation is turn-based
- Build mobile-first from the first screen
- Keep docs current after every meaningful change

## Implementation Phases

### Phase 1

- monorepo structure
- frontend shell
- backend shell
- auth scaffold
- tutor settings scaffold
- docs scaffold

### Phase 2

- connect frontend to backend
- session creation
- tutor settings persistence
- OpenRouter integration

### Phase 3

- SaluteSpeech integration
- speaking loop
- transcript and feedback UI

### Phase 4

- session polish
- error handling
- deployment docs

## Definition of Done For Current Iteration

- Project structure exists
- Product docs exist
- Frontend app runs
- Backend code scaffold exists
- Basic auth/settings/session API shape is defined
- Frontend uses graceful local fallbacks while backend is offline

## Current Implementation Snapshot

- `apps/web` contains a mobile-first landing/session screen
- tutor settings are persisted locally in browser storage for prototype continuity
- `apps/api` contains auth, tutor settings, and tutor response route scaffolds
- frontend supports register/login against backend and stores bearer token locally
- `OpenRouterClient` includes a fallback path when API keys are not configured
- `SaluteSpeechClient` now implements token exchange plus sync STT/TTS endpoints

## Documentation Update Rule

After any change affecting scope, architecture, API, data model, or UX:

1. Update this guide if the change affects the source of truth.
2. Update supporting docs.
3. Mention the doc update in the final summary.
