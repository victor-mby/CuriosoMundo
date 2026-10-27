from __future__ import annotations

import json
import os
import sqlite3
from typing import Any, Dict, Optional
from urllib import request
from urllib.error import URLError, HTTPError


OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen3:1.7b")
TIMEOUT = float(os.environ.get("OLLAMA_TIMEOUT", "30"))


def _base_dir() -> str:
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def obtener_contexto_estacion(limite: int = 20) -> Dict[str, Any]:
    db_path = os.path.join(_base_dir(), "base_datos", "edgemant.db")
    contexto: Dict[str, Any] = {
        "base_datos_existe": os.path.isfile(db_path),
        "registros_recientes": [],
        "motores": [],
        "detecciones_recientes": [],
        "estadisticas": {},
    }
    if not contexto["base_datos_existe"]:
        return contexto

    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        try:
            filas = conn.execute(
                "SELECT id, motor_id, tiempo, fecha, hora, nivel, voltaje, amperaje, caudal, potencia, estado_motor, estado_valvula FROM registros_telemetria ORDER BY tiempo DESC LIMIT ?",
                (limite,),
            ).fetchall()
            for f in filas:
                contexto["registros_recientes"].append(dict(f))

            motores = conn.execute("SELECT DISTINCT motor_id FROM registros_telemetria ORDER BY motor_id").fetchall()
            contexto["motores"] = [m[0] for m in motores]

            try:
                det = conn.execute(
                    "SELECT id, registro_id, motor_id, tiempo, fecha, hora, error_reconstruccion, umbral, severidad, tipo_interpretacion FROM detecciones_anomalias ORDER BY tiempo DESC, id DESC LIMIT 10"
                ).fetchall()
                for d in det:
                    contexto["detecciones_recientes"].append(dict(d))
            except Exception:
                pass

            total_reg = conn.execute("SELECT COUNT(*) FROM registros_telemetria").fetchone()[0]
            try:
                total_det = conn.execute("SELECT COUNT(*) FROM detecciones_anomalias").fetchone()[0]
            except Exception:
                total_det = 0
            contexto["estadisticas"] = {
                "total_registros": total_reg,
                "total_detecciones": total_det,
            }
        finally:
            conn.close()
    except Exception as e:
        contexto["error_contexto"] = str(e)

    return contexto


def _construir_prompt(pregunta: str, contexto: Dict[str, Any]) -> str:
    sistema = "Eres un asistente tecnico para EdgeMant, sistema de mantenimiento predictivo de bombas centrifugas. Debes interpretar UNICAMENTE los datos disponibles. No inventes lecturas. Si falta informacion, indicalo explicitamente. Distingue entre alarmas operativas y anomalias detectadas por el modelo. Explica posibles causas sin presentarlas como hechos confirmados. Recomienda que revisar primero. No modifiques bases de datos, umbrales, modelos ni equipos. No generes HTML, JavaScript ni codigo ejecutable. Responde en espanol, conciso y practico."
    ctx_json = json.dumps(contexto, ensure_ascii=False)
    prompt = f"{sistema}\n\nCONTEXTO DISPONIBLE (limitado):\n{ctx_json}\n\nPREGUNTA DEL USUARIO:\n{pregunta}\n\nRESPUESTA:"
    return prompt


def consultar_ollama(pregunta: str, contexto: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    if contexto is None:
        contexto = obtener_contexto_estacion()

    prompt = _construir_prompt(pregunta, contexto)

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.2,
        },
    }

    data = json.dumps(payload).encode("utf-8")
    url = f"{OLLAMA_HOST.rstrip('/')}/api/generate"

    req = request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")

    try:
        with request.urlopen(req, timeout=TIMEOUT) as resp:
            body = resp.read().decode("utf-8")
            parsed = json.loads(body)
            respuesta = parsed.get("response", "").strip()
            if not respuesta:
                return {"ok": False, "error": "Ollama devolvió una respuesta vacía.", "conectado": True}
            return {"ok": True, "respuesta": respuesta, "modelo": OLLAMA_MODEL, "conectado": True}
    except HTTPError as e:
        try:
            body_err = e.read().decode("utf-8")
        except Exception:
            body_err = str(e)
        return {"ok": False, "error": f"Error HTTP desde Ollama: {e.code} {e.reason}. {body_err}", "conectado": False}
    except URLError as e:
        return {"ok": False, "error": f"No se pudo conectar con Ollama en {OLLAMA_HOST}. Verifica que esté en ejecución y el modelo {OLLAMA_MODEL} esté descargado. {e.reason}", "conectado": False}
    except TimeoutError:
        return {"ok": False, "error": "La consulta a Ollama excedió el tiempo de espera.", "conectado": True}
    except Exception as e:
        return {"ok": False, "error": f"Error inesperado al consultar Ollama: {str(e)}", "conectado": False}
