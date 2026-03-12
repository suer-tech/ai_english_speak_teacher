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
    get_tts_client,
)


class SessionService:
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
