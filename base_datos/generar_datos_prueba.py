import sqlite3
import os
import random
import math
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), 'edgemant.db')

random.seed(20260420)


def generar_datos_prueba():
    if not os.path.exists(DB_PATH):
        raise FileNotFoundError(f'Base de datos no encontrada: {DB_PATH}')

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute('DELETE FROM registros_telemetria')
    cursor.execute('DELETE FROM eventos')
    cursor.execute('DELETE FROM alarmas')
    cursor.execute('DELETE FROM motores')
    cursor.execute('DELETE FROM estaciones')

    cursor.execute(
        'INSERT INTO estaciones (id, nombre, linea, zona, operador) VALUES (?, ?, ?, ?, ?)',
        ('EB-01', 'ESTACIÓN DE BOMBEO PRINCIPAL', 'Impulsión EB-01 → Red de distribución Norte', 'SECTOR NORTE', 'Sala de Control SCADA')
    )

    motores = [
        ('M-01', 'Bomba de impulsión principal 1', 20, 220, 3, 0.88, 0.85, 78, 25),
        ('M-02', 'Bomba de impulsión principal 2', 50, 220, 3, 0.9, 0.86, 48.7, 80),
    ]
    for m in motores:
        cursor.execute(
            'INSERT INTO motores (id, estacion_id, descripcion, hp, voltaje_nominal, etapas, eficiencia, factor_potencia_nominal, altura_cierre, caudal_diseno) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (m[0], 'EB-01', m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8])
        )

    tiempo_inicio = datetime(2026, 4, 20, 8, 0, 0)
    duracion_segundos = 3600
    paso = 1.0
    muestras = int(duracion_segundos / paso)

    registros = []
    for i in range(muestras):
        t = i * paso
        ts = tiempo_inicio + timedelta(seconds=t)
        timestamp = int(ts.timestamp() * 1000)
        fecha = ts.strftime('%d/%m/%Y')
        hora = ts.strftime('%H:%M:%S')
        tiempo_sim = ts.strftime('%H:%M:%S')

        for motor_id in ['M-01', 'M-02']:
            if motor_id == 'M-01':
                voltaje = 220 + random.uniform(-1.5, 1.5) + random.uniform(-3, 3) * math.sin(t / 60)
                amperaje = max(0, 45 + random.uniform(-2, 2) + 5 * math.sin(t / 120))
                caudal = max(0, 22 + random.uniform(-1, 1) + 3 * math.sin(t / 90))
                potencia = caudal * 78 * 9810 / (0.88 * 0.85) / 1000
                carga = potencia / (20 * 0.7457) * 100
                altura = 22 + random.uniform(-0.5, 0.5)
                factor_potencia = 0.85 + random.uniform(-0.02, 0.02)
                estado_motor = 'OPERATIVO' if random.random() > 0.01 else 'ARRANCANDO'
                estado_valvula = 'ABIERTA' if random.random() > 0.01 else 'ABRIENDO'
                posicion_valvula = 100 if random.random() > 0.01 else random.uniform(80, 99)
                velocidad_rotacion = 100 if random.random() > 0.01 else random.uniform(90, 99)
                horas_operacion = t / 3600
                caudal_total = caudal if motor_id == 'M-01' else caudal + max(0, 55 + random.uniform(-1, 1))
                potencia_total = potencia if motor_id == 'M-01' else potencia + max(0, 30 + random.uniform(-1, 1))
            else:
                voltaje = 220 + random.uniform(-1.5, 1.5) + random.uniform(-3, 3) * math.sin(t / 60)
                amperaje = max(0, 85 + random.uniform(-3, 3) + 8 * math.sin(t / 120))
                caudal = max(0, 68 + random.uniform(-2, 2) + 5 * math.sin(t / 90))
                potencia = caudal * 48.7 * 9810 / (0.9 * 0.86) / 1000
                carga = potencia / (50 * 0.7457) * 100
                altura = 22 + random.uniform(-0.5, 0.5)
                factor_potencia = 0.86 + random.uniform(-0.02, 0.02)
                estado_motor = 'OPERATIVO' if random.random() > 0.01 else 'ARRANCANDO'
                estado_valvula = 'ABIERTA' if random.random() > 0.01 else 'ABRIENDO'
                posicion_valvula = 100 if random.random() > 0.01 else random.uniform(80, 99)
                velocidad_rotacion = 100 if random.random() > 0.01 else random.uniform(90, 99)
                horas_operacion = t / 3600
                caudal_total = max(0, 22 + random.uniform(-1, 1)) + caudal
                potencia_total = max(0, 12 + random.uniform(-0.5, 0.5)) + potencia

            registros.append((
                t, tiempo_sim, timestamp, fecha, hora, motor_id,
                4.2 + random.uniform(-0.5, 0.5) + 0.3 * math.sin(t / 300),
                (4.2 + random.uniform(-0.5, 0.5) + 0.3 * math.sin(t / 300)) / 8 * 100,
                voltaje, voltaje - abs(amperaje) * 0.02, amperaje,
                45 if motor_id == 'M-01' else 120,
                caudal, potencia,
                20 if motor_id == 'M-01' else 50,
                carga, altura, factor_potencia,
                estado_motor, estado_valvula, posicion_valvula, velocidad_rotacion, horas_operacion,
                caudal_total, potencia_total,
                caudal_total * 0.02 if motor_id == 'M-01' else caudal_total * 0.05,
                3.4 + random.uniform(-0.3, 0.3) + 0.2 * math.sin(t / 400),
                35 + random.uniform(-2, 2) + 3 * math.sin(t / 200),
                8.0,
            ))

    cursor.executemany('''
        INSERT INTO registros_telemetria (
            tiempo, tiempo_simulacion, timestamp, fecha, hora, motor_id,
            nivel, nivel_porcentaje, voltaje, voltaje_terminal, amperaje, corriente_nominal,
            caudal, potencia, potencia_nominal, carga, altura, factor_potencia,
            estado_motor, estado_valvula, posicion_valvula, velocidad_rotacion, horas_operacion,
            caudal_total, potencia_total, corriente_total, nivel_destino, demanda, nivel_tanque_maximo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', registros)

    eventos = [
        (0, hora, 'SISTEMA', 'ESTACIÓN', 'INFO', 'Simulación iniciada. Adquisición de datos activa.', ''),
        (0, hora, 'OPERACIÓN', 'M-01', 'INFO', 'Orden de arranque de M-01 (20 HP) aceptada.', ''),
        (5, hora, 'OPERACIÓN', 'M-01', 'INFO', 'M-01 en OPERATIVO (velocidad 100 %, 45.2 A).', ''),
    ]
    for e in eventos:
        cursor.execute(
            'INSERT INTO eventos (tiempo, hora, tipo, equipo, severidad, texto, estado) VALUES (?, ?, ?, ?, ?, ?, ?)',
            e
        )

    conn.commit()
    conn.close()
    print(f'Datos de prueba generados: {len(registros)} registros de telemetría')


if __name__ == '__main__':
    generar_datos_prueba()
