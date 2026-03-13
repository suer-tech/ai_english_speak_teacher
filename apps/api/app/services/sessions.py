import asyncio
import uuid
from collections.abc import AsyncIterator

from app.schemas.session import (
    SessionCreateRequest,
    SessionCreateResponse,
    SpeechToTextResponse,
    TextToSpeechRequest,
    TextToSpeechResponse,
    TutorReplyRequest,
    TutorReplyResponse,
)
from app.services.openrouter import OpenRouterClient
from app.services.speech import (
    SaluteSpeechClient,
    SpeechRecognitionStreamEvent,
    SpeechSynthesisStreamResult,
    _pcm16_to_wav,
    get_tts_client,
    is_direct_audio_mode,
)


def _trim_history(messages: list[dict], max_user: int = 3, max_assistant: int = 3) -> list[dict]:
    """Keep last max_user user messages and max_assistant assistant messages."""
    user_count = 0
    assistant_count = 0
    result: list[dict] = []
    for msg in reversed(messages):
        role = msg.get("role")
        if role == "user" and user_count < max_user:
            result.insert(0, msg)
            user_count += 1
        elif role == "assistant" and assistant_count < max_assistant:
            result.insert(0, msg)
            assistant_count += 1
        if user_count >= max_user and assistant_count >= max_assistant:
            break
    return result


class SessionService:
    _audio_history: dict[str, list[dict]] = {}

    def __init__(self) -> None:
        self.openrouter_client = OpenRouterClient()
        self.stt_client = SaluteSpeechClient()

    @property
    def tts_client(self):
        return get_tts_client()

    def create_session(self, payload: SessionCreateRequest) -> SessionCreateResponse:
        return SessionCreateResponse(
            session_id=str(uuid.uuid4()),
            mode=payload.mode,
            status="created",
        )

    async def respond(self, payload: TutorReplyRequest) -> TutorReplyResponse:
        return await self.openrouter_client.generate_tutor_reply(payload)

    async def speech_to_text(
        self,
        audio_bytes: bytes,
        *,
        content_type: str,
        language: str = "en-US",
    ) -> SpeechToTextResponse:
        transcript = await self.stt_client.transcribe(
            audio_bytes,
            content_type=content_type,
            language=language,
        )
        return SpeechToTextResponse(transcript=transcript)

    async def speech_to_text_stream(
        self,
        audio_stream: AsyncIterator[bytes],
        *,
        sample_rate: int,
        language: str = "en-US",
    ) -> AsyncIterator[SpeechRecognitionStreamEvent]:
        async for event in self.stt_client.transcribe_stream(
            audio_stream,
            sample_rate=sample_rate,
            language=language,
        ):
            yield event

    async def text_to_speech(self, payload: TextToSpeechRequest) -> TextToSpeechResponse:
        result = await self.tts_client.synthesize(
            payload.text,
            voice=payload.voice,
            language=payload.language,
        )
        return TextToSpeechResponse(
            audio_base64=result.audio_base64,
            content_type=result.content_type,
            voice=result.voice,
        )

    async def text_to_speech_stream(
        self,
        payload: TextToSpeechRequest,
    ) -> SpeechSynthesisStreamResult:
        return await self.tts_client.synthesize_stream(
            payload.text,
            voice=payload.voice,
            language=payload.language,
        )

    async def audio_respond(
        self,
        audio_bytes: bytes,
        *,
        session_id: str,
        sample_rate: int = 16000,
        persona: str = "friendly_coach",
        level: str = "elementary",
        voice: str = "female",
    ) -> TextToSpeechResponse:
        """Direct audio-to-audio via GPT Audio Mini with conversation history.
        SaluteSpeech (transcription) and GPT Audio (response) run in parallel.
        """
        if not is_direct_audio_mode():
            raise ValueError("audio_respond requires TTS_PROVIDER=gpt_audio_mini")
        client = get_tts_client()
        if not hasattr(client, "audio_respond"):
            raise ValueError("TTS client does not support audio_respond")

        wav_bytes = _pcm16_to_wav(audio_bytes, sample_rate)
        history = SessionService._audio_history.get(session_id, [])

        transcribe_task = self.stt_client.transcribe(
            wav_bytes,
            content_type="audio/wav",
            language="en-US",
        )
        respond_task = client.audio_respond(
            audio_bytes,
            sample_rate=sample_rate,
            persona=persona,
            level=level,
            voice=voice,
            user_text="Listen to the learner and respond in spoken English.",
            history=history,
        )

        results = await asyncio.gather(transcribe_task, respond_task, return_exceptions=True)

        user_text = ""
        if isinstance(results[0], Exception):
            pass
        else:
            user_text = (results[0] or "").strip()

        if isinstance(results[1], Exception):
            raise results[1]

        result = results[1]

        history.append({"role": "user", "content": user_text or "[audio]"})
        history.append({"role": "assistant", "content": result.assistant_text})
        SessionService._audio_history[session_id] = _trim_history(history)

        return TextToSpeechResponse(
            audio_base64=result.audio_base64,
            content_type=result.content_type,
            voice=result.voice,
            provider="gpt_audio_mini",
            assistant_text=result.assistant_text,
            user_transcript=user_text,
        )
