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

Backend `.env` values are described in `apps/api/.env`.

Important:

- `SALUTE_SPEECH_API_KEY` must be set for real STT/TTS calls
- `SALUTE_SPEECH_AUTH_URL`, `SALUTE_SPEECH_SCOPE`, `SALUTE_SPEECH_DEFAULT_VOICE`, and `SALUTE_SPEECH_GRPC_HOST` are configurable
- `OPENROUTER_API_KEY` — for LLM and/or GPT Audio Mini
- `TTS_PROVIDER=gpt_audio_mini` — enable direct audio-to-audio mode (GPT Audio Mini with conversation history)

Frontend:

- `VITE_API_BASE_URL`

Recommended local value:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

## Development Notes

- Start with text-session integration before audio transport
- Keep `SaluteSpeech` behind a provider interface
- Frontend capture now assumes a browser with `AudioWorklet` support
- Frontend normalizes microphone input to mono `16 kHz PCM16` before STT streaming/fallback upload
- Update this file if provider onboarding changes

## Local Run

Project URLs:

- frontend: `http://127.0.0.1:3000`
- api: `http://127.0.0.1:8000`

Helper scripts:

- `scripts/start-local.ps1`
- `scripts/start-server.ps1`
- `scripts/stop-local.ps1`
