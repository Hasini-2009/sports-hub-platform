import json
import logging
from typing import AsyncGenerator
from fastapi import APIRouter, status
from fastapi.responses import StreamingResponse
import httpx

from app.config import settings
from app.schemas import InjuryQueryRequest, InjuryHealthResponse
from app.services.injury_ai.rag import rag_service

logger = logging.getLogger(__name__)

injury_router = APIRouter(prefix="/injury", tags=["Injury AI Assistant"])


async def stream_ollama_or_fallback(payload: InjuryQueryRequest) -> AsyncGenerator[str, None]:
    # 1. Retrieve top 4 chunks from persistent ChromaDB
    chunks = rag_service.query_corpus(payload.question, top_k=4)
    sources = list({c["source"] for c in chunks}) if chunks else ["general_sports_medicine"]
    context_text = "\n\n".join([f"--- Source: {c['source']} ---\n{c['text']}" for c in chunks])

    system_prompt = (
        "You are the Sports Hub Clinical Assistant. Provide helpful, evidence-based sports injury "
        "prevention, first-aid, and recovery advice based on the provided clinical context.\n"
        "SAFETY MANDATE: You are an informational AI assistant, NOT a doctor. You do NOT provide "
        "medical diagnoses or prescribe prescription medication. Always advise consulting a qualified "
        "sports doctor or physiotherapist if pain is severe, persistent, accompanied by swelling, "
        "joint instability, or red flags (e.g., concussion symptoms, inability to bear weight)."
    )

    user_prompt = f"Context:\n{context_text}\n\nUser Question: {payload.question}"
    if payload.sport:
        user_prompt += f"\nSport: {payload.sport}"
    if payload.history:
        user_prompt += f"\nInjury History: {payload.history}"

    ollama_success = False

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            ollama_req = {
                "model": settings.OLLAMA_MODEL,
                "prompt": f"{system_prompt}\n\n{user_prompt}",
                "stream": True
            }
            async with client.stream("POST", f"{settings.OLLAMA_URL}/api/generate", json=ollama_req) as response:
                if response.status_code == 200:
                    ollama_success = True
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        try:
                            parsed = json.loads(line)
                            token = parsed.get("response", "")
                            if token:
                                yield json.dumps({"token": token}) + "\n"
                            if parsed.get("done", False):
                                break
                        except json.JSONDecodeError:
                            continue
    except Exception as e:
        logger.info(f"Ollama stream unreachable or error: {e}. Switching to clinical retrieval fallback.")
        ollama_success = False

    if not ollama_success:
        # Fallback: Clearly labelled retrieval-only answer built from top ChromaDB chunks
        header = (
            "[Retrieval-Only Knowledge Base Response (Ollama Offline)]\n\n"
            "⚠️ Safety Notice: This is evidence-based clinical guidance retrieved from verified sports medicine literature. "
            "It does not substitute for professional medical diagnosis. If symptoms are severe or worsening, see a physician.\n\n"
        )
        yield json.dumps({"token": header}) + "\n"

        if chunks:
            yield json.dumps({"token": "### Relevant Clinical Guidance:\n\n"}) + "\n"
            for i, c in enumerate(chunks, 1):
                clean_chunk = c["text"].replace("\r\n", "\n")
                section = f"**{i}. From {c['source']}:**\n{clean_chunk}\n\n"
                yield json.dumps({"token": section}) + "\n"
        else:
            yield json.dumps({"token": "No specific local clinical protocols matched your exact query. Please rest the affected area, follow the PEACE & LOVE protocol, and consult a qualified healthcare professional."}) + "\n"

    # Final NDJSON payload indicating completion and bibliography sources
    yield json.dumps({"done": True, "sources": sources}) + "\n"


@injury_router.post("/query")
async def query_injury_assistant(payload: InjuryQueryRequest):
    return StreamingResponse(
        stream_ollama_or_fallback(payload),
        media_type="application/x-ndjson"
    )


@injury_router.get("/health", response_model=InjuryHealthResponse)
def get_injury_health():
    health = rag_service.check_health()
    return InjuryHealthResponse(
        status=health["status"],
        ollama_reachable=health["ollama_reachable"],
        chromadb_reachable=health["chromadb_reachable"],
        model=health["model"]
    )

