import sys
import os
import importlib.util

ML_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'ml')
sys.path.insert(0, ML_DIR)

from inferir import inferir, leer_view, preparar_datos, normalizar, calcular_error_reconstruccion, cargar_modelo
from interpretar import interpretar_fila


def obtener_resultados_completos():
    df_resultado, df_raw = inferir()
    modelo, scaler, columnas, umbral = cargar_modelo()
    resultados = []
    for _, fila in df_resultado.iterrows():
        if fila['anomalia'] == 1:
            interp = interpretar_fila(fila, columnas, scaler, umbral)
            resultados.append({
                'id': int(fila['id']),
                'motor_id': str(fila.get('motor_id', '')),
                'tiempo': float(fila['tiempo']),
                'fecha': str(fila.get('fecha', '')),
                'hora': str(fila.get('hora', '')),
                'error_reconstruccion': float(fila['error_reconstruccion']),
                'umbral': float(umbral),
                'severidad': interp['severidad'],
                'tipo_interpretacion': interp['tipo_interpretacion'],
                'descripcion': interp['descripcion'],
                'variables_relevantes': interp['variables_relevantes'],
            })
    resumen = {
        'total_registros': int(len(df_resultado)),
        'total_anomalias': int(df_resultado['anomalia'].sum()),
        'total_normales': int((df_resultado['anomalia'] == 0).sum()),
        'umbral': float(umbral),
        'ultima_deteccion': resultados[-1] if resultados else None,
    }
    return {
        'resumen': resumen,
        'anomalias': resultados,
        'df': df_resultado,
    }
