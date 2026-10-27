"""Aplicación web local de EdgeMant."""
from __future__ import annotations

import os
import sys
from pathlib import Path

from flask import Flask, jsonify, render_template, request

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024
app.config["JSON_AS_ASCII"] = False

try:
    from .servicios.dashboard import obtener_dashboard, ejecutar_inferencia_y_guardar
except ImportError:
    from dashboard.servicios.dashboard import obtener_dashboard, ejecutar_inferencia_y_guardar


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/salud")
def api_salud():
    return jsonify({"ok": True, "servicio": "EdgeMant"})


@app.get("/api/dashboard")
def api_dashboard():
    try:
        return jsonify({"ok": True, **obtener_dashboard()})
    except Exception:
        app.logger.exception("No se pudo cargar el dashboard")
        return jsonify({"ok": False, "error": "No se pudo cargar el dashboard. Revisa la base de datos y los archivos del modelo."}), 500


@app.post("/api/inferir")
def api_inferir():
    try:
        guardados = ejecutar_inferencia_y_guardar()
        return jsonify({"ok": True, "detecciones_guardadas": guardados})
    except Exception:
        app.logger.exception("Falló la inferencia")
        return jsonify({"ok": False, "error": "La inferencia falló. Revisa el registro del servidor y la configuración del modelo."}), 500


@app.get("/api/asistente/estado")
def api_asistente_estado():
    try:
        from .servicios.ollama import estado_ollama
        return jsonify(estado_ollama())
    except Exception:
        app.logger.exception("No se pudo consultar el estado de Ollama")
        return jsonify({"ok": False, "conectado": False, "error": "No se pudo comprobar Ollama."}), 500


@app.post("/api/asistente")
def api_asistente():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"ok": False, "error": "Envía una solicitud JSON válida."}), 400

    pregunta = data.get("pregunta")
    if not isinstance(pregunta, str):
        return jsonify({"ok": False, "error": "El campo 'pregunta' debe ser texto."}), 400

    pregunta = pregunta.strip()
    if not pregunta:
        return jsonify({"ok": False, "error": "Escribe una pregunta."}), 400
    if len(pregunta) > 1000:
        return jsonify({"ok": False, "error": "La pregunta no puede superar los 1000 caracteres."}), 413

    try:
        from .servicios.ollama import consultar_ollama
        resultado = consultar_ollama(pregunta)
        if not resultado.get("ok"):
            return jsonify(resultado), 503
        return jsonify(resultado)
    except Exception:
        app.logger.exception("Error en el asistente")
        return jsonify({"ok": False, "error": "Ocurrió un error interno al consultar el asistente."}), 500


if __name__ == "__main__":
    host = os.environ.get("EDGEMANT_HOST", "127.0.0.1")
    port = int(os.environ.get("EDGEMANT_DASHBOARD_PORT", "5000"))
    app.run(debug=False, host=host, port=port)
