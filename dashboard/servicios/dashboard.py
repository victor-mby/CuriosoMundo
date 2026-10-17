import sys
import os
import importlib.util

ML_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'ml')
sys.path.insert(0, ML_DIR)

from inferir import inferir, cargar_modelo
from interpretar import interpretar_fila
from servicio_historial import guardar_deteccion, obtener_historial, obtener_estadisticas
import sqlite3


def ejecutar_inferencia_y_guardar():
    df_resultado, df_raw = inferir()
    modelo, scaler, columnas, umbral = cargar_modelo()
    guardados = 0
    for _, fila in df_resultado.iterrows():
        if fila['anomalia'] == 1:
            interp = interpretar_fila(fila, columnas, scaler, umbral)
            deteccion = {
                'id': int(fila['id']),
                'motor_id': str(fila.get('motor_id', '')),
                'tiempo': float(fila['tiempo']),
                'fecha': str(fila.get('fecha', '')),
                'hora': str(fila.get('hora', '')),
                'error_reconstruccion': float(fila['error_reconstruccion']),
                'umbral': float(umbral),
                'severidad': interp['severidad'],
                'tipo_interpretacion': interp['tipo_interpretacion'],
                'descripcion': interp['descripcion'],
                'variables_relevantes': interp['variables_relevantes'],
            }
            guardar_deteccion(deteccion)
            guardados += 1
    return guardados


def obtener_dashboard():
    estadisticas = obtener_estadisticas()
    historial = obtener_historial(50)
    conn = sqlite3.connect(os.path.join(os.path.dirname(__file__), '..', '..', 'base_datos', 'edgemant.db'))
    cursor = conn.cursor()
    cursor.execute('SELECT DISTINCT motor_id FROM registros_telemetria ORDER BY motor_id')
    motores = [f[0] for f in cursor.fetchall()]
    conn.close()
    return {
        'estadisticas': estadisticas,
        'historial': historial,
        'motores': motores,
    }
