import sqlite3
import os
import json
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.preprocessing import StandardScaler


RUTA_DB = os.path.join(os.path.dirname(__file__), '..', 'base_datos', 'edgemant.db')
RUTA_MODELOS = os.path.join(os.path.dirname(__file__), 'modelos')


class Autoencoder(nn.Module):
    def __init__(self, input_dim, bottleneck_dim=8):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, max(bottleneck_dim * 2, input_dim // 2)),
            nn.ReLU(),
            nn.Linear(max(bottleneck_dim * 2, input_dim // 2), bottleneck_dim),
            nn.ReLU(),
        )
        self.decoder = nn.Sequential(
            nn.Linear(bottleneck_dim, max(bottleneck_dim * 2, input_dim // 2)),
            nn.ReLU(),
            nn.Linear(max(bottleneck_dim * 2, input_dim // 2), input_dim),
        )

    def forward(self, x):
        z = self.encoder(x)
        return self.decoder(z)


def cargar_modelo():
    ruta_columnas = os.path.join(RUTA_MODELOS, 'columnas.json')
    ruta_scaler = os.path.join(RUTA_MODELOS, 'scaler.json')
    ruta_umbral = os.path.join(RUTA_MODELOS, 'umbral.txt')
    ruta_pesos = os.path.join(RUTA_MODELOS, 'autoencoder.pth')

    with open(ruta_columnas, 'r', encoding='utf-8') as f:
        columnas = json.load(f)
    with open(ruta_scaler, 'r', encoding='utf-8') as f:
        scaler_data = json.load(f)
    with open(ruta_umbral, 'r', encoding='utf-8') as f:
        umbral = float(f.read().strip())

    scaler = StandardScaler()
    scaler.mean_ = np.array(scaler_data['mean'])
    scaler.scale_ = np.array(scaler_data['scale'])
    scaler.n_features_in_ = len(columnas)

    input_dim = len(columnas)
    bottleneck_dim = max(4, input_dim // 3)
    modelo = Autoencoder(input_dim, bottleneck_dim)
    modelo.load_state_dict(torch.load(ruta_pesos, map_location='cpu'))
    modelo.eval()

    return modelo, scaler, columnas, umbral


def leer_view():
    conn = sqlite3.connect(RUTA_DB)
    df = pd.read_sql_query('SELECT * FROM vista_telemetria_ml', conn)
    conn.close()
    return df


def preparar_datos(df, columnas):
    df = df.copy()
    disponibles = [c for c in columnas if c in df.columns]
    if not disponibles:
        raise ValueError('No hay variables disponibles para el modelo.')
    df = df[disponibles].copy()
    df = df.replace([np.inf, -np.inf], np.nan)
    df = df.dropna()
    return df


def normalizar(df, scaler):
    X = scaler.transform(df.values)
    return X


def calcular_error_reconstruccion(modelo, X):
    modelo.eval()
    X_tensor = torch.tensor(X, dtype=torch.float32)
    with torch.no_grad():
        reconstruido = modelo(X_tensor).numpy()
    errores = np.mean((X - reconstruido) ** 2, axis=1)
    return errores, reconstruido


def inferir():
    modelo, scaler, columnas, umbral = cargar_modelo()
    df_raw = leer_view()
    df_clean = preparar_datos(df_raw, columnas)
    X = normalizar(df_clean, scaler)
    errores, reconstruido = calcular_error_reconstruccion(modelo, X)

    df_resultado = df_clean.reset_index(drop=True)
    df_resultado['error_reconstruccion'] = errores
    df_resultado['umbral'] = umbral
    df_resultado['anomalia'] = (df_resultado['error_reconstruccion'] > df_resultado['umbral']).astype(int)

    columnas_id = [c for c in ('id', 'motor_id', 'tiempo', 'fecha', 'hora') if c in df_raw.columns]
    if columnas_id:
        df_id = df_raw[columnas_id].reset_index(drop=True)
        df_id = df_id.loc[df_clean.index].reset_index(drop=True)
        for col in columnas_id:
            df_resultado[col] = df_id[col].values

    return df_resultado, df_raw
