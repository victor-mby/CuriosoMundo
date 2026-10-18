import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'base_datos'))

from generar_datos_prueba import limpiar_datos_anteriores


class TestLimpiarDatosPrueba(unittest.TestCase):
    def test_limpia_registros_y_claves_idempotentes_antiguas(self):
        with tempfile.NamedTemporaryFile(suffix='.db') as archivo:
            conn = sqlite3.connect(archivo.name)
            try:
                conn.executescript("""
                    PRAGMA foreign_keys = ON;
                    CREATE TABLE estaciones (id TEXT PRIMARY KEY);
                    CREATE TABLE motores (
                        id TEXT PRIMARY KEY,
                        estacion_id TEXT NOT NULL REFERENCES estaciones(id)
                    );
                    CREATE TABLE registros_telemetria (
                        id INTEGER PRIMARY KEY,
                        motor_id TEXT NOT NULL REFERENCES motores(id)
                    );
                    CREATE TABLE eventos (id INTEGER PRIMARY KEY);
                    CREATE TABLE alarmas (id INTEGER PRIMARY KEY);
                    CREATE TABLE ingestas_csv (
                        clave_origen TEXT PRIMARY KEY,
                        registro_id INTEGER NOT NULL REFERENCES registros_telemetria(id)
                    );
                    CREATE TABLE ingestas_simulador (
                        clave_origen TEXT PRIMARY KEY,
                        registro_id INTEGER NOT NULL REFERENCES registros_telemetria(id)
                    );
                    CREATE TABLE detecciones_anomalias (
                        id INTEGER PRIMARY KEY,
                        registro_id INTEGER
                    );
                    INSERT INTO estaciones VALUES ('EB-01');
                    INSERT INTO motores VALUES ('M-01', 'EB-01');
                    INSERT INTO registros_telemetria VALUES (1, 'M-01');
                    INSERT INTO eventos VALUES (1);
                    INSERT INTO alarmas VALUES (1);
                    INSERT INTO ingestas_csv VALUES ('csv-1', 1);
                    INSERT INTO ingestas_simulador VALUES ('sim-1', 1);
                    INSERT INTO detecciones_anomalias VALUES (1, 1);
                """)

                limpiar_datos_anteriores(conn)

                for tabla in (
                    'ingestas_csv', 'ingestas_simulador',
                    'detecciones_anomalias', 'registros_telemetria',
                    'eventos', 'alarmas', 'motores', 'estaciones',
                ):
                    cantidad = conn.execute(
                        f'SELECT COUNT(*) FROM "{tabla}"'
                    ).fetchone()[0]
                    self.assertEqual(cantidad, 0, tabla)
            finally:
                conn.close()


if __name__ == '__main__':
    unittest.main()
