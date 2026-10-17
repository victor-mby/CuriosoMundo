import sys
import os
import importlib.util

BASE_DATOS_DIR = os.path.join(os.path.dirname(__file__), '..', 'base_datos')
ML_DIR = os.path.join(os.path.dirname(__file__), '..', 'ml')


def cargar_modulo(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


def main():
    print('=== EdgeMant - Prueba Etapa 1 ===')
    print()

    print('Paso 1: Crear base de datos...')
    crear = cargar_modulo('crear_base_datos', os.path.join(BASE_DATOS_DIR, 'crear_base_datos.py'))
    crear.crear_base_datos()
    print()

    print('Paso 2: Generar datos de prueba...')
    generar = cargar_modulo('generar_datos_prueba', os.path.join(BASE_DATOS_DIR, 'generar_datos_prueba.py'))
    generar.generar_datos_prueba()
    print()

    print('Paso 3: Leer VIEW desde Python...')
    leer = cargar_modulo('leer_view', os.path.join(ML_DIR, 'leer_view.py'))
    df = leer.leer_vista_ml()
    print()

    if len(df) > 0:
        print('OK: Flujo BASE DE DATOS -> VIEW -> PYTHON -> DATAFRAME funcionando.')
    else:
        print('ERROR: No se cargaron datos.')


if __name__ == '__main__':
    main()
