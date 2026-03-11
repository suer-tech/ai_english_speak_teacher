import asyncio
import json

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, WebSocket, status
from fastapi import WebSocketDisconnect
from fastapi.responses import StreamingResponse

from app.api.v1.deps import get_current_user_id_from_token
from app.schemas.session import (
    SessionCreateRequest,
    SessionCreateResponse,
    SpeechToTextResponse,
    TextToSpeechRequest,
    TextToSpeechResponse,
    TutorReplyRequest,
    TutorReplyResponse,
)
from app.services.sessions import SessionService


router = APIRouter()
session_service = SessionService()


class _QueueAudioStream:
    def __init__(self, queue: asyncio.Queue[bytes | None]) -> None:
        self._queue = queue

    def __aiter__(self) -> "_QueueAudioStream":
        return self

    async def __anext__(self) -> bytes:
        chunk = await self._queue.get()
        if chunk is None:
            raise StopAsyncIteration
        return chunk


@router.post("", response_model=SessionCreateResponse)
def create_session(payload: SessionCreateRequest):
    return session_service.create_session(payload)


@router.post("/respond", response_model=TutorReplyResponse)
async def respond(payload: TutorReplyRequest):
    return await session_service.respond(payload)


@router.post("/stt", response_model=SpeechToTextResponse)
async def speech_to_text(
    audio: UploadFile = File(...),
    language: str = Query(default="en-US"),
    sample_rate: int | None = Query(default=None),
):
    try:
        audio_bytes = await audio.read()
        content_type = audio.content_type or "audio/wav"
        if content_type.startswith("audio/x-pcm") and "rate=" not in content_type:
            normalized_rate = sample_rate or 48000
            content_type = f"audio/x-pcm;bit=16;rate={normalized_rate}"
        return await session_service.speech_to_text(
            audio_bytes,
            content_type=content_type,
            language=language,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc


@router.websocket("/stt/stream")
async def speech_to_text_stream(websocket: WebSocket):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Authentication required")
        return

    try:
        get_current_user_id_from_token(token)
    except HTTPException:
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Invalid authentication credentials",
        )
        return

    await websocket.accept()

    try:
        start_message = await websocket.receive_text()
        payload = json.loads(start_message)
    except (WebSocketDisconnect, json.JSONDecodeError):
        await websocket.close(code=status.WS_1003_UNSUPPORTED_DATA)
        return

    if payload.get("type") != "start":
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Expected start message")
        return

    language = payload.get("language") or "en-US"
    sample_rate = int(payload.get("sample_rate") or 48000)
    audio_queue: asyncio.Queue[bytes | None] = asyncio.Queue()
    audio_stream = _QueueAudioStream(audio_queue)
    stream_closed = False

    async def close_audio_stream() -> None:
        nonlocal stream_closed
        if stream_closed:
            return
        stream_closed = True
        await audio_queue.put(None)

    async def send_events() -> None:
        try:
            async for event in session_service.speech_to_text_stream(
                audio_stream,
                sample_rate=sample_rate,
                language=language,
            ):
                await websocket.send_json(
                    {
                        "type": event.event_type,
                        "transcript": event.transcript,
                    }
                )
        except Exception as exc:
            await websocket.send_json({"type": "error", "message": str(exc)})

    events_task = asyncio.create_task(send_events())
    await websocket.send_json({"type": "ready"})

    try:
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                break

            if message.get("bytes") is not None:
                await audio_queue.put(message["bytes"])
                continue

            text_data = message.get("text")
            if text_data is None:
                continue

            try:
                command = json.loads(text_data)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid WebSocket payload"})
                break

            if command.get("type") == "stop":
                await close_audio_stream()
                break
        await events_task
    except WebSocketDisconnect:
        if not events_task.done():
            await close_audio_stream()
    finally:
        if not events_task.done():
            await close_audio_stream()
            await events_task


@router.post("/tts", response_model=TextToSpeechResponse)
async def text_to_speech(payload: TextToSpeechRequest):
    try:
        return await session_service.text_to_speech(payload)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc


@router.post("/tts/stream")
async def text_to_speech_stream(payload: TextToSpeechRequest):
    try:
        result = await session_service.text_to_speech_stream(payload)
        return StreamingResponse(
            result.audio_stream,
            media_type=result.content_type,
            headers={
                "X-Speech-Voice": result.voice,
                "X-Speech-Sample-Rate": str(result.sample_rate),
                "Cache-Control": "no-store",
            },
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
