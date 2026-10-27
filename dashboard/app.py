import os
import sys

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SERVICIOS_DIR = os.path.join(BASE_DIR, 'dashboard', 'servicios')
ML_DIR = os.path.join(BASE_DIR, 'ml')

for ruta in (SERVICIOS_DIR, ML_DIR):
    if ruta not in sys.path:
        sys.path.insert(0, ruta)

# Funciona tanto ejecutando el archivo directamente como importándolo
# como módulo (por ejemplo, desde un servidor WSGI o pruebas).
try:
    from .servicios.dashboard import obtener_dashboard, ejecutar_inferencia_y_guardar
except ImportError:
    try:
        from servicios.dashboard import obtener_dashboard, ejecutar_inferencia_y_guardar
    except Exception:
        from dashboard.servicios.dashboard import obtener_dashboard, ejecutar_inferencia_y_guardar


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/dashboard')
def api_dashboard():
    try:
        return jsonify(obtener_dashboard())
    except Exception as error:
        app.logger.exception('No se pudo cargar el dashboard')
        return jsonify({'ok': False, 'error': str(error)}), 500


@app.route('/api/inferir', methods=['POST'])
def api_inferir():
    try:
        guardados = ejecutar_inferencia_y_guardar()
        return jsonify({'ok': True, 'detecciones_guardadas': guardados})
    except Exception as error:
        app.logger.exception('Falló la inferencia')
        return jsonify({'ok': False, 'error': str(error)}), 500


if __name__ == '__main__':
    # Solo acceso local y sin depurador interactivo expuesto en la red.
    app.run(debug=False, host='127.0.0.1', port=5000)


@app.route("/api/asistente", methods=["POST"])
def api_asistente():
    try:
        data = request.get_json(silent=True) or {}
        pregunta = (data.get("pregunta") or "").strip()
        if not pregunta:
            return jsonify({"ok": False, "error": "Falta el campo pregunta."}), 400
        from dashboard.servicios.ollama import consultar_ollama
        resultado = consultar_ollama(pregunta)
        if not resultado.get("ok"):
            return jsonify(resultado), 503
        return jsonify(resultado)
    except Exception as error:
        app.logger.exception("Error en asistente")
        return jsonify({"ok": False, "error": str(error)}), 500

@app.route("/api/asistente/estado", methods=["GET"])
def api_asistente_estado():
    try:
        from dashboard.servicios.ollama import consultar_ollama
        resultado = consultar_ollama("estado")
        return jsonify(resultado)
    except Exception as error:
        return jsonify({"ok": False, "error": str(error), "conectado": False}), 500
