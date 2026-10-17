import os
from flask import Flask, render_template, jsonify

app = Flask(__name__)

sys_path = os.path.join(os.path.dirname(__file__), 'servicios')
import sys
sys.path.insert(0, sys_path)

from dashboard import obtener_dashboard, ejecutar_inferencia_y_guardar


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/dashboard')
def api_dashboard():
    datos = obtener_dashboard()
    return jsonify(datos)


@app.route('/api/inferir', methods=['POST'])
def api_inferir():
    guardados = ejecutar_inferencia_y_guardar()
    return jsonify({'ok': True, 'detecciones_guardadas': guardados})


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
