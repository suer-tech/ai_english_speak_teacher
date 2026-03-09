# SpeakAI MVP

Mobile-first web app for spoken English practice with an AI tutor.

## Goal

Build an MVP that helps users practice conversational English through live-ish voice interaction:

- `SaluteSpeech` for speech-to-text and text-to-speech
- `OpenRouter` for tutor intelligence and feedback generation
- `FastAPI` backend for auth, settings, session orchestration, and provider integration
- `Next.js` frontend for a mobile-first speaking experience
- `SQLite` for users and tutor settings during MVP

## Current MVP Scope

- User registration and login
- Tutor selection with saved preferences
- Speaking session screen optimized for mobile
- Browser audio capture UX
- Backend session APIs
- OpenRouter-powered tutor response generation
- SaluteSpeech provider interface stubs ready for integration
- Russian UI and Russian learning feedback

## Current Status

- `apps/web` is scaffolded and builds successfully
- `apps/api` contains the FastAPI project skeleton and provider abstractions
- frontend currently falls back to local demo responses if backend is unavailable
- frontend now supports real register/login and token persistence
- backend includes real `SaluteSpeech` wiring for token exchange, STT, and TTS

## Not In MVP Yet

- Full pronunciation scoring by phoneme
- Progress analytics
- Billing/subscriptions
- Teacher memory across many sessions
- Admin panel

## Project Structure

- `apps/web` - Next.js frontend
- `apps/api` - FastAPI backend
- `docs` - product, architecture, and implementation docs

## Working Agreement

`docs/AGENT_GUIDE.md` is the project source of truth for implementation goals.

After each meaningful product or architecture change:

1. Update the relevant code.
2. Update `docs/AGENT_GUIDE.md`.
3. Update any detailed doc that changed (`docs/ARCHITECTURE.md`, `docs/API.md`, `docs/ROADMAP.md`).

If code and docs conflict, docs must be corrected in the same change.

## Quick Start

### Frontend

```bash
cd apps/web
npm install
npm run dev
```

### Backend

Install Python 3.11+ first, then:

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

To enable `SaluteSpeech`, fill `SALUTE_SPEECH_API_KEY` in `apps/api/.env`.

### Start Both Locally

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-local.ps1
```

Stop them with:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-local.ps1
```
