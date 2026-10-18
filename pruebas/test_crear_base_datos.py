import os
import sqlite3
import tempfile
import unittest

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'base_datos'))

import crear_base_datos


class TestCrearBaseDatos(unittest.TestCase):
    def setUp(self):
        self.directorio = tempfile.TemporaryDirectory()
        self.db_original = crear_base_datos.DB_PATH
        self.sql_original = crear_base_datos.SQL_PATH
        self.view_original = crear_base_datos.VIEW_PATH
        crear_base_datos.DB_PATH = os.path.join(self.directorio.name, 'edgemant.db')
        crear_base_datos.SQL_PATH = os.path.join(self.directorio.name, 'base_datos.sql')
        crear_base_datos.VIEW_PATH = os.path.join(self.directorio.name, 'view_ml.sql')
        with open(crear_base_datos.SQL_PATH, 'w', encoding='utf-8') as archivo:
            archivo.write(
                'CREATE TABLE IF NOT EXISTS muestras '
                '(id INTEGER PRIMARY KEY, valor TEXT);'
            )
        with open(crear_base_datos.VIEW_PATH, 'w', encoding='utf-8') as archivo:
            archivo.write(
                'CREATE VIEW IF NOT EXISTS vista_muestras AS SELECT * FROM muestras;'
            )

    def tearDown(self):
        crear_base_datos.DB_PATH = self.db_original
        crear_base_datos.SQL_PATH = self.sql_original
        crear_base_datos.VIEW_PATH = self.view_original
        self.directorio.cleanup()

    def test_conserva_datos_si_no_se_pide_reinicio(self):
        crear_base_datos.crear_base_datos()
        conn = sqlite3.connect(crear_base_datos.DB_PATH)
        try:
            conn.execute('INSERT INTO muestras (valor) VALUES (?)', ('telemetria',))
            conn.commit()
        finally:
            conn.close()

        crear_base_datos.crear_base_datos()

        with sqlite3.connect(crear_base_datos.DB_PATH) as conn:
            filas = conn.execute('SELECT valor FROM muestras').fetchall()
        self.assertEqual(filas, [('telemetria',)])

    def test_reinicia_solo_si_se_solicita_expresamente(self):
        crear_base_datos.crear_base_datos()
        conn = sqlite3.connect(crear_base_datos.DB_PATH)
        try:
            conn.execute('INSERT INTO muestras (valor) VALUES (?)', ('telemetria',))
            conn.commit()
        finally:
            conn.close()

        crear_base_datos.crear_base_datos(reiniciar=True)

        with sqlite3.connect(crear_base_datos.DB_PATH) as conn:
            cantidad = conn.execute('SELECT COUNT(*) FROM muestras').fetchone()[0]
        self.assertEqual(cantidad, 0)


if __name__ == '__main__':
    unittest.main()
