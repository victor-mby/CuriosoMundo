import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'edgemant.db')
SQL_PATH = os.path.join(os.path.dirname(__file__), 'base_datos.sql')
VIEW_PATH = os.path.join(os.path.dirname(__file__), 'view_ml.sql')


def crear_base_datos():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    with open(SQL_PATH, 'r', encoding='utf-8') as f:
        cursor.executescript(f.read())

    with open(VIEW_PATH, 'r', encoding='utf-8') as f:
        cursor.executescript(f.read())

    conn.commit()
    conn.close()
    print(f'Base de datos creada: {DB_PATH}')


if __name__ == '__main__':
    crear_base_datos()
