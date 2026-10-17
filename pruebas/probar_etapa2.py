import sys
import os
import importlib.util
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ML_DIR = os.path.join(os.path.dirname(__file__), '..', 'ml')
BASE_DATOS_DIR = os.path.join(os.path.dirname(__file__), '..', 'base_datos')

sys.path.insert(0, ML_DIR)


def cargar_modulo(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


def main():
    print('========================================')
    print('EDGEMANT - PRUEBA ETAPA 2')
    print('========================================')
    print()

    preparar = cargar_modulo('preparar_datos', os.path.join(ML_DIR, 'preparar_datos.py'))
    entrenar = cargar_modulo('entrenar_modelo', os.path.join(ML_DIR, 'entrenar_modelo.py'))

    df_resultado, modelo, datos = entrenar.main()
    normales = int((df_resultado['anomalia'] == 0).sum())
    anomalias = int((df_resultado['anomalia'] == 1).sum())

    print('----------------------------------------')
    print(f'Registros cargados: {len(datos["df_raw"])}')
    print(f'Variables utilizadas:')
    for v in datos['columnas']:
        print(f'  - {v}')
    print('Datos preparados: OK')
    print('Autoencoder entrenado: OK')
    print('Error de reconstruccion: OK')
    print(f'Umbral: {df_resultado["umbral"].iloc[0]:.6f}')
    print(f'Registros normales: {normales}')
    print(f'Posibles anomalias: {anomalias}')
    print('ETAPA 2: OK')
    print('========================================')

    salida_grafico = os.path.join(BASE_DATOS_DIR, 'resultado_etapa2.png')
    plt.figure(figsize=(10, 5))
    plt.hist(df_resultado['error_reconstruccion'], bins=80, alpha=0.7, label='Error de reconstruccion')
    plt.axvline(df_resultado['umbral'].iloc[0], color='red', linestyle='--', label='Umbral')
    plt.title('Distribucion del error de reconstruccion')
    plt.xlabel('Error')
    plt.ylabel('Frecuencia')
    plt.legend()
    plt.tight_layout()
    plt.savefig(salida_grafico)
    plt.close()
    print(f'Grafico guardado en: {salida_grafico}')


if __name__ == '__main__':
    main()
