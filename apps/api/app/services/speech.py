import base64
import time
import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass
from html import escape

import grpc
import httpx

from app.core.config import settings
from app.services.salute_proto import ensure_salute_proto_modules


@dataclass
class SpeechSynthesisResult:
    audio_base64: str
    content_type: str
    voice: str


@dataclass
class SpeechSynthesisStreamResult:
    audio_stream: AsyncIterator[bytes]
    content_type: str
    voice: str
    sample_rate: int


@dataclass
class SpeechRecognitionStreamEvent:
    event_type: str
    transcript: str
    is_final: bool


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

    async def transcribe_stream(
        self,
        audio_stream: AsyncIterator[bytes],
        *,
        sample_rate: int,
        language: str = "en-US",
    ) -> AsyncIterator[SpeechRecognitionStreamEvent]:
        token = await self._get_access_token()
        recognition_pb2, recognition_pb2_grpc = ensure_salute_proto_modules()
        credentials = grpc.composite_channel_credentials(
            grpc.ssl_channel_credentials(),
            grpc.access_token_call_credentials(token),
        )

        async def request_iterator() -> AsyncIterator[object]:
            options = recognition_pb2.RecognitionOptions(
                audio_encoding=recognition_pb2.RecognitionOptions.PCM_S16LE,
                sample_rate=sample_rate,
                language=language,
                hypotheses_count=1,
                enable_partial_results=True,
                enable_multi_utterance=False,
                channels_count=1,
            )
            yield recognition_pb2.RecognitionRequest(options=options)

            async for chunk in audio_stream:
                if chunk:
                    yield recognition_pb2.RecognitionRequest(audio_chunk=chunk)

        async with grpc.aio.secure_channel(
            settings.salute_speech_grpc_host,
            credentials,
        ) as channel:
            stub = recognition_pb2_grpc.SmartSpeechStub(channel)
            call = stub.Recognize(request_iterator())

            async for response in call:
                transcript = self._extract_streaming_transcript(response)
                if not transcript:
                    continue

                yield SpeechRecognitionStreamEvent(
                    event_type="final_transcript" if response.eou else "partial_transcript",
                    transcript=transcript,
                    is_final=bool(response.eou),
                )

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

    async def synthesize_stream(
        self,
        text: str,
        *,
        voice: str | None = None,
        language: str = "en",
    ) -> SpeechSynthesisStreamResult:
        token = await self._get_access_token()
        selected_voice = self._resolve_voice(voice=voice, language=language)
        sample_rate = self._resolve_sample_rate(selected_voice)
        endpoint = f"{settings.salute_speech_base_url}/text:synthesize"
        content_type = f"audio/x-pcm;bit=16;rate={sample_rate}"
        ssml = self._build_ssml(text=text, language=language)

        async def audio_stream() -> AsyncIterator[bytes]:
            async with httpx.AsyncClient(timeout=90, verify=False) as client:
                async with client.stream(
                    "POST",
                    endpoint,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/ssml",
                        "Accept": content_type,
                    },
                    params={
                        "voice": selected_voice,
                        "format": "pcm16",
                    },
                    content=ssml.encode("utf-8"),
                ) as response:
                    if response.is_error:
                        error_body = await response.aread()
                        raise ValueError(
                            f"SaluteSpeech TTS error {response.status_code}: {error_body.decode('utf-8', errors='replace')}"
                        )

                    async for chunk in response.aiter_bytes():
                        if chunk:
                            yield chunk

        return SpeechSynthesisStreamResult(
            audio_stream=audio_stream(),
            content_type=content_type,
            voice=selected_voice,
            sample_rate=sample_rate,
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

    def _extract_streaming_transcript(self, response: object) -> str:
        results = getattr(response, "results", None)
        if not results:
            return ""

        first_result = results[0]
        normalized_text = getattr(first_result, "normalized_text", "")
        if isinstance(normalized_text, str) and normalized_text.strip():
            return normalized_text.strip()

        text = getattr(first_result, "text", "")
        if isinstance(text, str) and text.strip():
            return text.strip()

        return ""

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

    def _resolve_sample_rate(self, voice: str) -> int:
        try:
            return int(voice.rsplit("_", 1)[1])
        except (IndexError, ValueError):
            return 24000
