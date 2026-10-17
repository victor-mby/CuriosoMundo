import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'edgemant.db')


def crear_tabla_detecciones():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS detecciones_anomalias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            registro_id INTEGER,
            motor_id TEXT NOT NULL,
            tiempo REAL NOT NULL,
            fecha TEXT,
            hora TEXT,
            error_reconstruccion REAL NOT NULL,
            umbral REAL NOT NULL,
            severidad TEXT NOT NULL,
            tipo_interpretacion TEXT NOT NULL,
            descripcion TEXT NOT NULL,
            variables_relevantes TEXT NOT NULL
        )
    ''')
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_detecciones_motor_tiempo
        ON detecciones_anomalias(motor_id, tiempo)
    ''')
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_detecciones_tiempo
        ON detecciones_anomalias(tiempo)
    ''')
    conn.commit()
    conn.close()
    print('Tabla detecciones_anomalias creada/verificada.')


if __name__ == '__main__':
    crear_tabla_detecciones()
