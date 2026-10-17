import sqlite3
import pandas as pd
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'base_datos', 'edgemant.db')


def leer_vista_ml():
    if not os.path.exists(DB_PATH):
        raise FileNotFoundError(f'Base de datos no encontrada: {DB_PATH}')

    conn = sqlite3.connect(DB_PATH)
    query = 'SELECT * FROM vista_telemetria_ml'
    df = pd.read_sql_query(query, conn)
    conn.close()

    print(f'Registros cargados desde VIEW: {len(df)}')
    print(f'Columnas disponibles: {list(df.columns)}')
    print('\nTipos de datos:')
    print(df.dtypes)
    print('\nPrimeras filas:')
    print(df.head())
    print('\nEstadísticas descriptivas:')
    print(df.describe())

    return df


if __name__ == '__main__':
    df = leer_vista_ml()
