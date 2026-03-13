import base64
import json
import logging
import struct
import time
import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass
from html import escape
from pathlib import Path

import grpc
import httpx

from app.core.config import settings
from app.services.salute_proto import ensure_salute_proto_modules

logger = logging.getLogger(__name__)


def _pcm16_to_wav(pcm_data: bytes, sample_rate: int) -> bytes:
    """Wrap raw PCM 16-bit mono into a WAV file."""
    num_samples = len(pcm_data) // 2
    data_size = num_samples * 2
    header_size = 44
    file_size = header_size + data_size

    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        file_size - 8,
        b"WAVE",
        b"fmt ",
        16,
        1,
        1,
        sample_rate,
        sample_rate * 2,
        2,
        16,
        b"data",
        data_size,
    )
    return header + pcm_data


def resolve_tts_voice(voice: str | None) -> str:
    """Map internal voice (female/male) to provider-specific voice from env."""
    if voice == "female":
        return settings.tts_voice_female
    if voice == "male":
        return settings.tts_voice_male
    return settings.tts_voice_female


@dataclass
class SpeechSynthesisResult:
    audio_base64: str
    content_type: str
    voice: str


@dataclass
class AudioRespondResult:
    audio_base64: str
    content_type: str
    voice: str
    assistant_text: str
    user_transcript: str


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


class _RecognitionRequestIterator:
    def __init__(
        self,
        *,
        recognition_pb2: object,
        audio_stream: AsyncIterator[bytes],
        sample_rate: int,
        language: str,
    ) -> None:
        self._recognition_pb2 = recognition_pb2
        self._audio_stream = audio_stream
        self._sample_rate = sample_rate
        self._language = language
        self._sent_options = False

    def __aiter__(self) -> "_RecognitionRequestIterator":
        return self

    async def __anext__(self) -> object:
        if not self._sent_options:
            self._sent_options = True
            options = self._recognition_pb2.RecognitionOptions(
                audio_encoding=self._recognition_pb2.RecognitionOptions.PCM_S16LE,
                sample_rate=self._sample_rate,
                language=self._language,
                hypotheses_count=1,
                enable_partial_results=True,
                enable_multi_utterance=False,
                channels_count=1,
            )
            return self._recognition_pb2.RecognitionRequest(options=options)

        while True:
            chunk = await anext(self._audio_stream)
            if chunk:
                return self._recognition_pb2.RecognitionRequest(audio_chunk=chunk)


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
            grpc.ssl_channel_credentials(
                root_certificates=self._load_grpc_root_certificates()
            ),
            grpc.access_token_call_credentials(token),
        )
        request_iterator = _RecognitionRequestIterator(
            recognition_pb2=recognition_pb2,
            audio_stream=audio_stream,
            sample_rate=sample_rate,
            language=language,
        )

        async with grpc.aio.secure_channel(
            settings.salute_speech_grpc_host,
            credentials,
        ) as channel:
            stub = recognition_pb2_grpc.SmartSpeechStub(channel)
            call = stub.Recognize(request_iterator)

            async for response in call:
                transcript = self._extract_streaming_transcript(response)
                if not transcript:
                    continue

                yield SpeechRecognitionStreamEvent(
                    event_type="final_transcript" if response.eou else "partial_transcript",
                    transcript=transcript,
                    is_final=bool(response.eou),
                )

    def _load_grpc_root_certificates(self) -> bytes | None:
        cert_path = settings.salute_speech_grpc_ca_cert_path.strip()
        if not cert_path:
            return None

        pem_path = Path(cert_path).expanduser()
        if not pem_path.is_absolute():
            pem_path = Path.cwd() / pem_path

        try:
            return pem_path.read_bytes()
        except OSError as exc:
            raise ValueError(
                f"Unable to read SALUTE_SPEECH_GRPC_CA_CERT_PATH at {pem_path}"
            ) from exc

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
        return resolve_tts_voice(voice)

    def _resolve_sample_rate(self, voice: str) -> int:
        try:
            return int(voice.rsplit("_", 1)[1])
        except (IndexError, ValueError):
            return 24000


class GPTAudioMiniClient:
    """TTS via OpenRouter GPT Audio Mini (openai/gpt-audio-mini)."""

    def __init__(self) -> None:
        self.provider_name = "gpt_audio_mini"
        self._base_url = "https://openrouter.ai/api/v1/chat/completions"
        self._sample_rate = 24000

    async def synthesize(
        self,
        text: str,
        *,
        voice: str | None = None,
        language: str = "en",
    ) -> SpeechSynthesisResult:
        provider_voice = resolve_tts_voice(voice)
        pcm_b64 = await self._request_audio(text, provider_voice)
        wav_bytes = _pcm16_to_wav(base64.b64decode(pcm_b64), self._sample_rate)
        return SpeechSynthesisResult(
            audio_base64=base64.b64encode(wav_bytes).decode("ascii"),
            content_type="audio/wav",
            voice=provider_voice,
        )

    async def audio_respond(
        self,
        pcm_bytes: bytes,
        *,
        sample_rate: int = 16000,
        persona: str = "friendly_coach",
        level: str = "elementary",
        voice: str | None = None,
        user_text: str = "",
        history: list[dict] | None = None,
    ) -> AudioRespondResult:
        """Send user audio to GPT Audio Mini with conversation history, get spoken response."""
        provider_voice = resolve_tts_voice(voice)
        wav_bytes = _pcm16_to_wav(pcm_bytes, sample_rate)
        audio_b64 = base64.b64encode(wav_bytes).decode("ascii")

        persona_hint = "Supportive and encouraging, explain calmly."

        system_prompt = (
            f"You are an experienced English teacher at level {level}. "
            "Listen to the learner's speech and respond in spoken English only. "
            f"Persona: {persona_hint} "
            "Ask open-ended questions. Use vocabulary at the learner's level. "
            "Respond naturally as if in a voice conversation."
        )

        history_messages = (history or [])[-6:]
        user_content: list[dict] = [
            {"type": "text", "text": user_text or "Listen to the learner and respond in spoken English."},
            {"type": "input_audio", "input_audio": {"data": audio_b64, "format": "wav"}},
        ]

        messages: list[dict] = [
            {"role": "system", "content": system_prompt},
            *history_messages,
            {"role": "user", "content": user_content},
        ]

        payload = {
            "model": "openai/gpt-audio-mini",
            "messages": messages,
            "modalities": ["text", "audio"],
            "audio": {"voice": provider_voice, "format": "pcm16"},
            "stream": True,
        }

        if not settings.openrouter_api_key:
            raise ValueError("OPENROUTER_API_KEY is not configured for TTS")

        chunks_b64: list[str] = []
        transcript_parts: list[str] = []
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST",
                self._base_url,
                headers={
                    "Authorization": f"Bearer {settings.openrouter_api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            ) as response:
                if response.is_error:
                    body = await response.aread()
                    err_msg = f"GPT Audio Mini audio-respond error {response.status_code}: {body.decode('utf-8', errors='replace')}"
                    logger.error(err_msg)
                    raise ValueError(err_msg)
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line[6:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        obj = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    choices = obj.get("choices") or []
                    if not choices:
                        continue
                    delta = choices[0].get("delta", {})
                    content = delta.get("content")
                    if content:
                        transcript_parts.append(content)
                    audio = delta.get("audio", {})
                    if audio.get("data"):
                        chunks_b64.append(audio["data"])
                    if audio.get("transcript"):
                        transcript_parts.append(audio["transcript"])

        full_b64 = "".join(chunks_b64)
        if not full_b64:
            raise ValueError("GPT Audio Mini returned no audio for audio-respond.")
        pcm_out = base64.b64decode(full_b64)
        wav_out = _pcm16_to_wav(pcm_out, self._sample_rate)
        assistant_text = "".join(transcript_parts).strip()
        return AudioRespondResult(
            audio_base64=base64.b64encode(wav_out).decode("ascii"),
            content_type="audio/wav",
            voice=provider_voice,
            assistant_text=assistant_text,
            user_transcript=user_text,
        )

    async def synthesize_stream(
        self,
        text: str,
        *,
        voice: str | None = None,
        language: str = "en",
    ) -> SpeechSynthesisStreamResult:
        provider_voice = resolve_tts_voice(voice)
        content_type = f"audio/x-pcm;bit=16;rate={self._sample_rate}"

        async def audio_stream() -> AsyncIterator[bytes]:
            async for chunk in self._stream_audio(text, provider_voice):
                yield chunk

        return SpeechSynthesisStreamResult(
            audio_stream=audio_stream(),
            content_type=content_type,
            voice=provider_voice,
            sample_rate=self._sample_rate,
        )

    async def _request_audio(self, text: str, voice: str) -> str:
        if not settings.openrouter_api_key:
            raise ValueError("OPENROUTER_API_KEY is not configured for TTS")

        payload = {
            "model": "openai/gpt-audio-mini",
            "messages": [{"role": "user", "content": text}],
            "modalities": ["text", "audio"],
            "audio": {"voice": voice, "format": "pcm16"},
            "stream": True,
        }

        chunks_b64: list[str] = []
        async with httpx.AsyncClient(timeout=90) as client:
            async with client.stream(
                "POST",
                self._base_url,
                headers={
                    "Authorization": f"Bearer {settings.openrouter_api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            ) as response:
                if response.is_error:
                    body = await response.aread()
                    err_msg = f"GPT Audio Mini TTS error {response.status_code}: {body.decode('utf-8', errors='replace')}"
                    logger.error(err_msg)
                    raise ValueError(err_msg)
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line[6:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        obj = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    choices = obj.get("choices") or []
                    if not choices:
                        err = obj.get("error", {})
                        if err:
                            logger.warning("OpenRouter chunk error: %s", err)
                        continue
                    delta = choices[0].get("delta", {})
                    audio = delta.get("audio", {})
                    if audio.get("data"):
                        chunks_b64.append(audio["data"])

        full_b64 = "".join(chunks_b64)
        if not full_b64:
            raise ValueError(
                "GPT Audio Mini returned no audio. Check model supports modalities=['text','audio'] and format."
            )
        return full_b64

    async def _stream_audio(
        self, text: str, voice: str
    ) -> AsyncIterator[bytes]:
        if not settings.openrouter_api_key:
            raise ValueError("OPENROUTER_API_KEY is not configured for TTS")

        payload = {
            "model": "openai/gpt-audio-mini",
            "messages": [{"role": "user", "content": text}],
            "modalities": ["text", "audio"],
            "audio": {"voice": voice, "format": "pcm16"},
            "stream": True,
        }

        async with httpx.AsyncClient(timeout=90) as client:
            async with client.stream(
                "POST",
                self._base_url,
                headers={
                    "Authorization": f"Bearer {settings.openrouter_api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            ) as response:
                if response.is_error:
                    body = await response.aread()
                    raise ValueError(
                        f"GPT Audio Mini TTS error {response.status_code}: {body.decode('utf-8', errors='replace')}"
                    )
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line[6:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        obj = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    delta = (obj.get("choices") or [{}])[0].get("delta", {})
                    audio = delta.get("audio", {})
                    if audio.get("data"):
                        yield base64.b64decode(audio["data"])


def get_tts_client() -> SaluteSpeechClient | GPTAudioMiniClient:
    """Return TTS client based on TTS_PROVIDER env."""
    if settings.tts_provider.strip().lower() == "gpt_audio_mini":
        return GPTAudioMiniClient()
    return SaluteSpeechClient()


def is_direct_audio_mode() -> bool:
    """True when TTS_PROVIDER=gpt_audio_mini (audio-to-audio without STT)."""
    return settings.tts_provider.strip().lower() == "gpt_audio_mini"
