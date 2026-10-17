import sqlite3
import os
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler


RUTA_DB = os.path.join(os.path.dirname(__file__), '..', 'base_datos', 'edgemant.db')

VARIABLES_ML = [
    'nivel',
    'nivel_porcentaje',
    'voltaje',
    'voltaje_terminal',
    'amperaje',
    'caudal',
    'potencia',
    'carga',
    'altura',
    'factor_potencia',
    'caudal_total',
    'potencia_total',
    'corriente_total',
    'nivel_destino',
    'demanda',
    'posicion_valvula',
    'velocidad_rotacion',
    'horas_operacion',
]


def cargar_datos():
    if not os.path.exists(RUTA_DB):
        raise FileNotFoundError(f'Base de datos no encontrada: {RUTA_DB}')
    conn = sqlite3.connect(RUTA_DB)
    df = pd.read_sql_query('SELECT * FROM vista_telemetria_ml', conn)
    conn.close()
    return df


def seleccionar_variables(df):
    df = df.copy()
    disponibles = [c for c in VARIABLES_ML if c in df.columns]
    faltantes = [c for c in VARIABLES_ML if c not in df.columns]
    if faltantes:
        print(f'Advertencia: variables no disponibles en la VIEW: {faltantes}')
    if not disponibles:
        raise ValueError('No hay variables numericas disponibles para el modelo.')
    df = df[disponibles].copy()
    return df, disponibles


def limpiar_datos(df):
    df = df.copy()
    df = df.replace([np.inf, -np.inf], np.nan)
    nulos_antes = df.isnull().sum().sum()
    df = df.dropna()
    nulos_despues = df.isnull().sum().sum()
    if nulos_antes > 0:
        print(f'Registros con valores nulos eliminados: {nulos_antes}')
    return df


def normalizar(df):
    scaler = StandardScaler()
    X = scaler.fit_transform(df.values)
    return X, scaler, df.columns.tolist()


def preparar():
    df_raw = cargar_datos()
    print(f'Registros cargados desde VIEW: {len(df_raw)}')
    df_vars, columnas = seleccionar_variables(df_raw)
    df_clean = limpiar_datos(df_vars)
    X, scaler, nombres = normalizar(df_clean)
    print(f'Variables utilizadas: {nombres}')
    print(f'Datos preparados: {X.shape[0]} registros, {X.shape[1]} variables')
    return {
        'df_raw': df_raw,
        'df_clean': df_clean,
        'X': X,
        'scaler': scaler,
        'columnas': nombres,
    }
