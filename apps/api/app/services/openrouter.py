from textwrap import dedent

import httpx

from app.core.config import settings
from app.schemas.session import TutorReplyRequest, TutorReplyResponse


class OpenRouterClient:
    def __init__(self) -> None:
        self.base_url = "https://openrouter.ai/api/v1/chat/completions"

    async def generate_tutor_reply(
        self, payload: TutorReplyRequest
    ) -> TutorReplyResponse:
        if not settings.openrouter_api_key:
            return self._fallback_reply(payload)

        system_prompt = dedent(
            f"""
            You are an English speaking tutor inside a language learning app.
            Always answer in a structured JSON-like way internally, but return only clean final fields.
            The learner UI language is Russian.
            Persona: {payload.settings.persona}
            Level: {payload.settings.level}

            Goals:
            - encourage speaking confidence
            - correct only the most important issue
            - provide a short pronunciation hint when possible
            - reply as a tutor so the conversation continues
            """
        ).strip()

        user_prompt = dedent(
            f"""
            Learner message: {payload.text}

            Return:
            - corrected_text
            - key_feedback
            - pronunciation_tip
            - tutor_reply
            """
        ).strip()

        request_body = {
            "model": settings.openrouter_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": "tutor_feedback",
                    "strict": True,
                    "schema": {
                        "type": "object",
                        "properties": {
                            "corrected_text": {"type": "string"},
                            "key_feedback": {"type": "string"},
                            "pronunciation_tip": {"type": "string"},
                            "tutor_reply": {"type": "string"},
                        },
                        "required": [
                            "corrected_text",
                            "key_feedback",
                            "pronunciation_tip",
                            "tutor_reply",
                        ],
                        "additionalProperties": False,
                    },
                },
            },
        }

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                self.base_url,
                headers={
                    "Authorization": f"Bearer {settings.openrouter_api_key}",
                    "Content-Type": "application/json",
                },
                json=request_body,
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]

        import json

        parsed = json.loads(content)
        return TutorReplyResponse(**parsed)

    def _fallback_reply(self, payload: TutorReplyRequest) -> TutorReplyResponse:
        text = payload.text.strip()
        corrected_text = (
            "Hello, I want to practice English for travel and daily conversations."
            if text
            else "Hello, I want to practice my English."
        )
        return TutorReplyResponse(
            corrected_text=corrected_text,
            key_feedback=(
                "Исправляем только главную ошибку: после 'want' в этом контексте нужен 'to'."
            ),
            pronunciation_tip=(
                "Скажи 'practice' медленнее и четко выдели первый слог: PRAC-tice."
            ),
            tutor_reply=(
                "Nice start. Tell me where you want to travel and what situations in English worry you most."
            ),
        )
