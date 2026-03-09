import base64
import time
import uuid
from dataclasses import dataclass
from html import escape

import httpx

from app.core.config import settings


@dataclass
class SpeechSynthesisResult:
    audio_base64: str
    content_type: str
    voice: str


class SaluteSpeechClient:
    def __init__(self) -> None:
        self.provider_name = "salute_speech"
        self._access_token: str | None = None
        self._expires_at: float = 0

    async def transcribe(
        self,
        audio_bytes: bytes,
        *,
        content_type: str = "audio/wav",
        language: str = "en-US",
    ) -> str:
        token = await self._get_access_token()
        endpoint = f"{settings.salute_speech_base_url}/speech:recognize"

        async with httpx.AsyncClient(timeout=90, verify=False) as client:
            response = await client.post(
                endpoint,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": content_type,
                },
                params={"language": language},
                content=audio_bytes,
            )
            response.raise_for_status()
            payload = response.json()

        return self._extract_transcript(payload)

    async def synthesize(
        self,
        text: str,
        *,
        voice: str | None = None,
        language: str = "en",
    ) -> SpeechSynthesisResult:
        token = await self._get_access_token()
        selected_voice = self._resolve_voice(voice=voice, language=language)
        endpoint = f"{settings.salute_speech_base_url}/text:synthesize"
        content_type = "audio/ogg; codecs=opus"
        ssml = self._build_ssml(text=text, language=language)

        async with httpx.AsyncClient(timeout=90, verify=False) as client:
            response = await client.post(
                endpoint,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/ssml",
                    "Accept": content_type,
                },
                params={
                    "voice": selected_voice,
                    "format": "opus",
                },
                content=ssml.encode("utf-8"),
            )
            if response.is_error:
                raise ValueError(
                    f"SaluteSpeech TTS error {response.status_code}: {response.text}"
                )

        return SpeechSynthesisResult(
            audio_base64=base64.b64encode(response.content).decode("ascii"),
            content_type=content_type,
            voice=selected_voice,
        )

    async def _get_access_token(self) -> str:
        if not settings.salute_speech_api_key:
            raise ValueError("SALUTE_SPEECH_API_KEY is not configured")

        if self._access_token and time.time() < self._expires_at - 60:
            return self._access_token

        async with httpx.AsyncClient(timeout=30, verify=False) as client:
            response = await client.post(
                settings.salute_speech_auth_url,
                headers={
                    "Authorization": f"Basic {settings.salute_speech_api_key}",
                    "RqUID": str(uuid.uuid4()),
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data={"scope": settings.salute_speech_scope},
            )
            if response.is_error:
                raise ValueError(
                    f"SaluteSpeech auth error {response.status_code}: {response.text}"
                )
            payload = response.json()

        self._access_token = payload["access_token"]
        expires_at = payload.get("expires_at")
        if isinstance(expires_at, (int, float)):
            self._expires_at = float(expires_at) / 1000
        else:
            self._expires_at = time.time() + 1800

        return self._access_token

    def _extract_transcript(self, payload: dict) -> str:
        result = payload.get("result")
        if isinstance(result, str):
            return result
        if isinstance(result, list) and result:
            if isinstance(result[0], str):
                return result[0]
            if isinstance(result[0], dict):
                for key in ("text", "transcript", "normalized_text"):
                    value = result[0].get(key)
                    if isinstance(value, str) and value.strip():
                        return value

        for key in ("text", "transcript", "normalized_text"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value

        raise ValueError(f"Unexpected STT response payload: {payload}")

    def _build_ssml(self, *, text: str, language: str) -> str:
        return f'<speak version="1.0" xml:lang="{language}">{escape(text)}</speak>'

    def _resolve_voice(self, *, voice: str | None, language: str) -> str:
        if voice and "_" in voice:
            return voice

        if language == "en":
            return "Kin_24000"
        if language == "ru":
            return "Nec_24000"

        return settings.salute_speech_default_voice
