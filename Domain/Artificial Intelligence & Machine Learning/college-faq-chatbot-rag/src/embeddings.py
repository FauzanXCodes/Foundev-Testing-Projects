"""OpenRouter-compatible embedding model factory."""

from __future__ import annotations

from langchain_openai import OpenAIEmbeddings

from config.settings import Settings


def build_embeddings(settings: Settings) -> OpenAIEmbeddings:
    if not settings.openrouter_api_key:
        raise ValueError(
            "OPENROUTER_API_KEY is not set. Copy .env.example to .env and add your key."
        )

    return OpenAIEmbeddings(
        model=settings.embedding_model,
        openai_api_key=settings.openrouter_api_key,
        openai_api_base=settings.openrouter_base_url,
        default_headers=settings.openrouter_headers,
        check_embedding_ctx_length=False,
    )
