import sqlite3
import os
import json

DB_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'base_datos', 'edgemant.db')


def guardar_deteccion(deteccion):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO detecciones_anomalias (
            registro_id, motor_id, tiempo, fecha, hora,
            error_reconstruccion, umbral, severidad,
            tipo_interpretacion, descripcion, variables_relevantes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        deteccion['id'],
        deteccion['motor_id'],
        deteccion['tiempo'],
        deteccion['fecha'],
        deteccion['hora'],
        deteccion['error_reconstruccion'],
        deteccion['umbral'],
        deteccion['severidad'],
        deteccion['tipo_interpretacion'],
        deteccion['descripcion'],
        json.dumps(deteccion['variables_relevantes'], ensure_ascii=False),
    ))
    conn.commit()
    conn.close()


def obtener_historial(limit=100):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, registro_id, motor_id, tiempo, fecha, hora,
               error_reconstruccion, umbral, severidad,
               tipo_interpretacion, descripcion, variables_relevantes
        FROM detecciones_anomalias
        ORDER BY tiempo DESC
        LIMIT ?
    ''', (limit,))
    filas = cursor.fetchall()
    conn.close()
    return [
        {
            'id': f[0],
            'registro_id': f[1],
            'motor_id': f[2],
            'tiempo': f[3],
            'fecha': f[4],
            'hora': f[5],
            'error_reconstruccion': f[6],
            'umbral': f[7],
            'severidad': f[8],
            'tipo_interpretacion': f[9],
            'descripcion': f[10],
            'variables_relevantes': json.loads(f[11]),
        }
        for f in filas
    ]


def obtener_estadisticas():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM detecciones_anomalias')
    total = cursor.fetchone()[0]
    cursor.execute('SELECT severidad, COUNT(*) FROM detecciones_anomalias GROUP BY severidad')
    filas = cursor.fetchall()
    conn.close()
    por_severidad = {f[0]: f[1] for f in filas}
    return {'total': total, 'por_severidad': por_severidad}
