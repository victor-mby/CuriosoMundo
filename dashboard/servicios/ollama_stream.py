"""Streaming real de respuestas desde Ollama hacia el dashboard."""
from __future__ import annotations

import json
from typing import Any, Iterator
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .ollama import (
    MAX_QUESTION_LENGTH,
    OLLAMA_HOST,
    OLLAMA_MODEL,
    TIMEOUT,
    _construir_prompt,
    estado_ollama,
    obtener_contexto_estacion,
)


def iterar_respuesta(pregunta: str) -> Iterator[dict[str, Any]]:
    """Emite fragmentos reales de Ollama como eventos JSON."""
    if not isinstance(pregunta, str) or not pregunta.strip():
        yield {"error": "Escribe una pregunta válida."}
        return
    pregunta = pregunta.strip()
    if len(pregunta) > MAX_QUESTION_LENGTH:
        yield {"error": "La pregunta supera el límite permitido."}
        return

    estado = estado_ollama()
    if not estado.get("conectado"):
        yield {"error": estado.get("error", "Ollama no está disponible."), "conectado": False}
        return
    if not estado.get("modelo_disponible"):
        yield {
            "error": f"El modelo {OLLAMA_MODEL} no está descargado. Ejecuta: ollama pull {OLLAMA_MODEL}",
            "conectado": True,
        }
        return

    contexto = obtener_contexto_estacion()
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": _construir_prompt(pregunta, contexto),
        "stream": True,
        "options": {"temperature": 0.2, "num_predict": 500},
    }
    req = Request(
        f"{OLLAMA_HOST}/api/generate",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json", "Accept": "application/x-ndjson"},
        method="POST",
    )
    try:
        with urlopen(req, timeout=TIMEOUT) as response:
            for linea in response:
                if not linea.strip():
                    continue
                try:
                    parte = json.loads(linea.decode("utf-8"))
                except (UnicodeDecodeError, json.JSONDecodeError):
                    yield {"error": "Ollama devolvió un fragmento no válido."}
                    return
                texto = parte.get("response")
                if isinstance(texto, str) and texto:
                    yield {"token": texto}
                if parte.get("error"):
                    yield {"error": "Ollama informó un error durante la generación."}
                    return
                if parte.get("done"):
                    yield {"done": True, "modelo": OLLAMA_MODEL}
                    return
        yield {"done": True, "modelo": OLLAMA_MODEL}
    except HTTPError as error:
        mensaje = (
            f"El modelo {OLLAMA_MODEL} no está disponible. Ejecuta: ollama pull {OLLAMA_MODEL}"
            if error.code == 404 else f"Ollama respondió con un error HTTP {error.code}."
        )
        yield {"error": mensaje, "conectado": error.code != 404}
    except (URLError, TimeoutError, OSError):
        yield {"error": "Se perdió la conexión con Ollama. Comprueba que siga ejecutándose.", "conectado": False}
