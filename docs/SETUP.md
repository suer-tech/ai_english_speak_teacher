# Setup

## Accounts To Create

### Required for the selected MVP

- `OpenRouter`
  - create account
  - generate API key
  - fund a small pay-as-you-go balance

- `Sber Developers`
  - create account
  - enable `GigaChat` only if you want later comparison tests
  - enable `SaluteSpeech` for STT/TTS integration
  - obtain access credentials for speech APIs

### Required locally

- Python 3.11+
- Node.js 24+ or a compatible LTS version

No external database is required for the current MVP iteration because the backend uses local `SQLite`.

## Environment Variables

Backend `.env` values are described in `apps/api/.env.example`.

Important:

- `SALUTE_SPEECH_API_KEY` must be set for real STT/TTS calls
- `SALUTE_SPEECH_AUTH_URL`, `SALUTE_SPEECH_SCOPE`, and `SALUTE_SPEECH_DEFAULT_VOICE` are now configurable

Frontend:

- `NEXT_PUBLIC_API_BASE_URL`

Recommended local value:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
```

## Development Notes

- Start with text-session integration before audio transport
- Keep `SaluteSpeech` behind a provider interface
- Update this file if provider onboarding changes

## Local Run

Project URLs:

- frontend: `http://127.0.0.1:3000`
- api: `http://127.0.0.1:8000`

Helper scripts:

- `scripts/start-local.ps1`
- `scripts/stop-local.ps1`
