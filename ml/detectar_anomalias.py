import numpy as np
import pandas as pd


def calcular_umbral(errores, percentil=95):
    if percentil <= 0 or percentil >= 100:
        raise ValueError('El percentil debe estar entre 0 y 100 exclusivos.')
    umbral = float(np.percentile(errores, percentil))
    return umbral


def detectar(df_raw, errores, umbral):
    df = df_raw.copy().reset_index(drop=True)
    df['error_reconstruccion'] = errores
    df['umbral'] = umbral
    df['anomalia'] = (df['error_reconstruccion'] > df['umbral']).astype(int)
    return df
