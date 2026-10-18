import json
import os
import sqlite3

import numpy as np
import pandas as pd
import torch
from sklearn.preprocessing import StandardScaler

# Reutiliza la misma arquitectura que se emplea durante el entrenamiento.
from autoencoder import Autoencoder


RUTA_DB = os.path.join(os.path.dirname(__file__), '..', 'base_datos', 'edgemant.db')
RUTA_MODELOS = os.path.join(os.path.dirname(__file__), 'modelos')


def cargar_modelo():
    ruta_columnas = os.path.join(RUTA_MODELOS, 'columnas.json')
    ruta_scaler = os.path.join(RUTA_MODELOS, 'scaler.json')
    ruta_umbral = os.path.join(RUTA_MODELOS, 'umbral.txt')
    ruta_pesos = os.path.join(RUTA_MODELOS, 'autoencoder.pth')

    rutas_requeridas = (ruta_columnas, ruta_scaler, ruta_umbral, ruta_pesos)
    faltantes = [ruta for ruta in rutas_requeridas if not os.path.isfile(ruta)]
    if faltantes:
        nombres = ', '.join(os.path.basename(ruta) for ruta in faltantes)
        raise FileNotFoundError(
            f'Faltan archivos del modelo en {RUTA_MODELOS}: {nombres}. '
            'Entrena el modelo antes de ejecutar la inferencia.'
        )

    with open(ruta_columnas, 'r', encoding='utf-8') as f:
        columnas = json.load(f)
    with open(ruta_scaler, 'r', encoding='utf-8') as f:
        scaler_data = json.load(f)
    with open(ruta_umbral, 'r', encoding='utf-8') as f:
        texto_umbral = f.read().strip()

    if not isinstance(columnas, list) or not columnas:
        raise ValueError('columnas.json debe contener una lista de variables no vacía.')
    if 'mean' not in scaler_data or 'scale' not in scaler_data:
        raise ValueError('scaler.json debe contener las claves mean y scale.')
    if len(scaler_data['mean']) != len(columnas) or len(scaler_data['scale']) != len(columnas):
        raise ValueError(
            'El scaler guardado no coincide con la cantidad de variables de columnas.json. '
            'Vuelve a entrenar el modelo para generar archivos compatibles.'
        )

    try:
        umbral = float(texto_umbral)
    except ValueError:
        raise ValueError('umbral.txt no contiene un número válido.') from None
    if not np.isfinite(umbral) or umbral < 0:
        raise ValueError('El umbral guardado debe ser un número finito no negativo.')

    scaler = StandardScaler()
    scaler.mean_ = np.asarray(scaler_data['mean'], dtype=float)
    scaler.scale_ = np.asarray(scaler_data['scale'], dtype=float)
    scaler.var_ = np.asarray(scaler_data.get('var', np.square(scaler.scale_)), dtype=float)
    scaler.n_features_in_ = len(columnas)

    input_dim = len(columnas)
    bottleneck_dim = max(4, input_dim // 3)
    modelo = Autoencoder(input_dim, bottleneck_dim)
    state_dict = torch.load(ruta_pesos, map_location='cpu', weights_only=True)
    modelo.load_state_dict(state_dict)
    modelo.eval()

    return modelo, scaler, columnas, umbral


def leer_view():
    if not os.path.isfile(RUTA_DB):
        raise FileNotFoundError(
            f'No se encontró la base de datos: {RUTA_DB}. '
            'Ejecuta primero base_datos/crear_base_datos.py.'
        )

    with sqlite3.connect(RUTA_DB) as conn:
        df = pd.read_sql_query('SELECT * FROM vista_telemetria_ml', conn)
    return df


def preparar_datos(df, columnas):
    if df.empty:
        raise ValueError('La vista vista_telemetria_ml no contiene registros para analizar.')

    faltantes = [columna for columna in columnas if columna not in df.columns]
    if faltantes:
        raise ValueError(
            'La vista de telemetría no contiene todas las variables del modelo: '
            + ', '.join(faltantes)
            + '. Revisa la vista SQL y vuelve a entrenar solo si cambió el esquema.'
        )

    # No se inventan valores para variables que el simulador no exportó.
    datos = df.loc[:, columnas].copy()
    datos = datos.replace([np.inf, -np.inf], np.nan)
    validos = datos.notna().all(axis=1)
    datos = datos.loc[validos]

    if datos.empty:
        raise ValueError(
            'No hay registros completos para las variables del modelo. '
            'El CSV exportado por el simulador puede omitir variables; usa la captura '
            'de telemetría completa o importa registros que contengan todas las variables.'
        )

    return datos


def normalizar(df, scaler):
    return scaler.transform(df.values)


def calcular_error_reconstruccion(modelo, X):
    modelo.eval()
    X_tensor = torch.tensor(X, dtype=torch.float32)
    with torch.no_grad():
        reconstruido = modelo(X_tensor).cpu().numpy()
    errores = np.mean((X - reconstruido) ** 2, axis=1)
    return errores, reconstruido


def inferir():
    modelo, scaler, columnas, umbral = cargar_modelo()
    df_raw = leer_view()
    df_clean = preparar_datos(df_raw, columnas)
    X = normalizar(df_clean, scaler)
    errores, _ = calcular_error_reconstruccion(modelo, X)

    # Mantener la correspondencia exacta entre cada predicción y su registro original.
    indices_validos = df_clean.index
    df_resultado = df_raw.loc[indices_validos, ['id', 'motor_id', 'tiempo', 'fecha', 'hora']].copy()
    df_resultado = df_resultado.reset_index(drop=True)
    df_resultado['error_reconstruccion'] = errores
    df_resultado['umbral'] = umbral
    df_resultado['anomalia'] = (df_resultado['error_reconstruccion'] > umbral).astype(int)

    return df_resultado, df_raw
