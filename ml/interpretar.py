import numpy as np


def calcular_severidad(error, umbral):
    if error <= umbral:
        return 'NORMAL'
    elif error <= 1.5 * umbral:
        return 'ATENCION'
    else:
        return 'CRITICO'


def variables_desviadas(fila, columnas, scaler):
    desviaciones = {}
    idx = {c: i for i, c in enumerate(columnas)}
    mean = scaler.mean_
    scale = scaler.scale_
    for c in columnas:
        if c not in fila or c not in idx:
            continue
        valor = fila[c]
        if valor is None or (isinstance(valor, float) and np.isnan(valor)):
            continue
        i = idx[c]
        z = abs((valor - mean[i]) / scale[i])
        if z > 1.5:
            desviaciones[c] = {
                'valor': float(valor),
                'media': float(mean[i]),
                'desviacion': float(scale[i]),
                'z': float(z),
            }
    return desviaciones


def interpretar(desviaciones):
    if not desviaciones:
        return {
            'tipo': 'Sin interpretacion',
            'descripcion': 'No se detectaron desviaciones relevantes.',
            'variables': [],
        }

    vars_e = [v for v in desviaciones if v in ('voltaje', 'voltaje_terminal', 'amperaje', 'corriente_total', 'factor_potencia', 'potencia')]
    vars_h = [v for v in desviaciones if v in ('caudal', 'altura', 'nivel', 'nivel_destino', 'demanda')]
    vars_c = [v for v in desviaciones if v in ('carga', 'amperaje', 'potencia', 'corriente_total')]
    vars_f = [v for v in desviaciones if v in ('caudal', 'posicion_valvula', 'altura', 'demanda')]

    if vars_e and len(vars_e) >= len(desviaciones) * 0.5:
        return {
            'tipo': 'Posible comportamiento electrico anormal',
            'descripcion': 'Revisar alimentacion electrica, corriente, tension y factor de potencia.',
            'variables': vars_e,
        }
    if vars_h and len(vars_h) >= len(desviaciones) * 0.5:
        return {
            'tipo': 'Posible comportamiento hidraulico anormal',
            'descripcion': 'Revisar caudal, niveles, demanda y condiciones de impulsion.',
            'variables': vars_h,
        }
    if vars_c and len(vars_c) >= len(desviaciones) * 0.5:
        return {
            'tipo': 'Posible sobrecarga del sistema',
            'descripcion': 'Revisar corriente, potencia y carga del motor.',
            'variables': vars_c,
        }
    if vars_f and len(vars_f) >= len(desviaciones) * 0.5:
        return {
            'tipo': 'Posible restriccion o condicion anormal del flujo',
            'descripcion': 'Revisar valvula, caudal y condiciones hidraulicas.',
            'variables': vars_f,
        }

    todas = list(desviaciones.keys())
    return {
        'tipo': 'Comportamiento operativo fuera del patron normal',
        'descripcion': 'Se detectaron desviaciones multiples. Requiere inspeccion.',
        'variables': todas,
    }


def interpretar_fila(fila, columnas, scaler, umbral):
    error = float(fila['error_reconstruccion'])
    severidad = calcular_severidad(error, umbral)
    desviaciones = variables_desviadas(fila, columnas, scaler)
    interp = interpretar(desviaciones)
    return {
        'severidad': severidad,
        'tipo_interpretacion': interp['tipo'],
        'descripcion': interp['descripcion'],
        'variables_relevantes': interp['variables'],
        'desviaciones': desviaciones,
    }
