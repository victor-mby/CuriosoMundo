import sqlite3
import csv
import os
import sys

DB_PATH = os.path.join(os.path.dirname(__file__), 'edgemant.db')


def inferir_motor_id(fila):
    return fila.get('Motor', 'M-01')


def importar_csv(ruta_csv, estacion_id='EB-01'):
    if not os.path.exists(DB_PATH):
        raise FileNotFoundError(f'Base de datos no encontrada: {DB_PATH}')

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Asegurar estación y motor existen
    cursor.execute('INSERT OR IGNORE INTO estaciones (id, nombre, linea, zona, operador) VALUES (?, ?, ?, ?, ?)',
                   ('EB-01', 'ESTACIÓN DE BOMBEO PRINCIPAL', 'Impulsión EB-01 → Red de distribución Norte', 'SECTOR NORTE', 'Sala de Control SCADA'))

    motores_por_id = {}
    cursor.execute('SELECT id FROM motores')
    for row in cursor.fetchall():
        motores_por_id[row[0]] = True

    with open(ruta_csv, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        registros = []
        for fila in reader:
            motor_id = inferir_motor_id(fila)
            if motor_id not in motores_por_id:
                cursor.execute(
                    'INSERT OR IGNORE INTO motores (id, estacion_id, descripcion) VALUES (?, ?, ?)',
                    (motor_id, estacion_id, f'Equipo {motor_id}')
                )
                motores_por_id[motor_id] = True

            registros.append((
                float(fila.get('Tiempo simulación (s)', 0) or 0),
                fila.get('Tiempo simulación', ''),
                int(float(fila.get('timestamp', 0) or 0)),
                fila.get('Fecha', ''),
                fila.get('Hora', ''),
                motor_id,
                float(fila.get('Nivel (m)', 0) or 0),
                float(fila.get('Nivel (%)', 0) or 0),
                float(fila.get('Voltaje (V)', 0) or 0),
                None,  # voltaje_terminal no está en CSV
                float(fila.get('Amperaje (A)', 0) or 0),
                None,  # corriente_nominal no está en CSV
                float(fila.get('Caudal (L/s)', 0) or 0),
                float(fila.get('Potencia (kW)', 0) or 0),
                None,  # potencia_nominal no está en CSV
                None,  # carga no está en CSV
                None,  # altura no está en CSV
                None,  # factor_potencia no está en CSV
                fila.get('Estado motor', ''),
                fila.get('Estado válvula', ''),
                None,  # posicion_valvula no está en CSV
                None,  # velocidad_rotacion no está en CSV
                None,  # horas_operacion no está en CSV
                float(fila.get('Caudal total (L/s)', 0) or 0),
                float(fila.get('Potencia total (kW)', 0) or 0),
                None,  # corriente_total no está en CSV
                float(fila.get('Nivel destino (m)', 0) or 0),
                float(fila.get('Demanda (L/s)', 0) or 0),
                None,  # nivel_tanque_maximo no está en CSV
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

    conn.commit()
    conn.close()
    print(f'Importados {len(registros)} registros desde {ruta_csv}')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Uso: python importar_csv.py <ruta_csv>')
        sys.exit(1)
    importar_csv(sys.argv[1])
