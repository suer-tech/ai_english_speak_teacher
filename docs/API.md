# API Draft

## Auth

### `POST /api/v1/auth/register`

Create a user account.

### `POST /api/v1/auth/login`

Return access token and basic user payload.

### `GET /api/v1/auth/me`

Return current user.

Note: protected settings routes require a bearer token; the frontend stores it locally after login/register.

## Tutor Settings

### `GET /api/v1/settings/tutor`

Return saved tutor settings for current user.

### `PUT /api/v1/settings/tutor`

Create or update tutor settings.

## Sessions

### `POST /api/v1/sessions`

Create a speaking session.

### `POST /api/v1/sessions/respond`

Accept user text and return:

- tutor reply
- corrected phrase
- key feedback
- optional pronunciation note

Current implementation:

- uses `OpenRouter` when API key is configured
- returns deterministic fallback tutor feedback when API key is missing

### `POST /api/v1/sessions/stt`

Accepts uploaded audio file in multipart form-data and returns transcript from `SaluteSpeech`.

Notes:

- preferred content type: `audio/x-pcm;bit=16;rate=...`
- optional query param: `sample_rate` (used to fill rate when missing)
- kept as a compatibility fallback when streaming STT is unavailable

### `POST /api/v1/sessions/tts`

Accepts text payload and returns base64-encoded audio from `SaluteSpeech`.

### `POST /api/v1/sessions/tts/stream`

Accepts the same text payload as `/tts` and streams binary PCM audio from `SaluteSpeech`.

Notes:

- response content type: `audio/x-pcm;bit=16;rate=...`
- response includes `X-Speech-Voice` and `X-Speech-Sample-Rate` headers
- intended as the primary low-latency playback path
- `/tts` remains as a compatibility fallback during migration

### `WS /api/v1/sessions/stt/stream`

Streams PCM audio chunks to the backend over WebSocket and bridges them to SaluteSpeech gRPC streaming recognition.

Client flow:

- connect with `token` query param
- send JSON `{ "type": "start", "language": "en-US", "sample_rate": 16000 }`
- send binary mono `PCM16 16 kHz` chunks while recording
- send JSON `{ "type": "stop" }` to finalize the turn

Server events:

- `ready`
- `partial_transcript`
- `final_transcript`
- `error`

### Future

- `POST /api/v1/sessions/realtime-token`
