# API Draft

## Auth

### `POST /api/v1/auth/register`

Create a user account.

### `POST /api/v1/auth/login`

Return access token and basic user payload.

### `GET /api/v1/auth/me`

Return current user.

Note: the current scaffold expects a bearer token for protected settings routes. The frontend now implements register/login and stores the bearer token locally.

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

### Future

- `POST /api/v1/sessions/stt`
- `POST /api/v1/sessions/tts`
- `POST /api/v1/sessions/realtime-token`

### `POST /api/v1/sessions/stt`

Accepts uploaded audio file in multipart form-data and returns transcript from `SaluteSpeech`.

### `POST /api/v1/sessions/tts`

Accepts text payload and returns base64-encoded audio from `SaluteSpeech`.
