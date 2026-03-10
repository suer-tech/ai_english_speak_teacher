# Roadmap

## Current Direction

Hybrid low-cost MVP:

- `SaluteSpeech` for STT/TTS
- `OpenRouter` for tutor intelligence
- pronunciation scoring postponed

## Milestone 1

- docs
- frontend shell
- backend shell
- auth and tutor settings
- initial frontend prototype with offline fallback
- SQLite local persistence instead of external database setup

## Milestone 2

- OpenRouter integration
- session response endpoint
- mobile speaking UI
- connect real auth flow from frontend to backend

Status: shipped in current build.

## Milestone 3

- SaluteSpeech integration
- streaming STT with upload fallback
- streaming tutor voice playback with legacy fallback

Status: shipped in current build.

## Milestone 4

- deployment hardening
- telemetry
- better error states
- AudioWorklet capture polish
- stronger VAD and input-device tuning
