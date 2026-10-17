import os
import torch
import json


RUTA_MODELOS = os.path.join(os.path.dirname(__file__), 'modelos')


def guardar(modelo, scaler, columnas, umbral, ruta=None):
    if ruta is None:
        ruta = RUTA_MODELOS
    os.makedirs(ruta, exist_ok=True)
    torch.save(modelo.state_dict(), os.path.join(ruta, 'autoencoder.pth'))
    with open(os.path.join(ruta, 'columnas.json'), 'w', encoding='utf-8') as f:
        json.dump(columnas, f, ensure_ascii=False, indent=2)
    with open(os.path.join(ruta, 'umbral.txt'), 'w', encoding='utf-8') as f:
        f.write(f'{umbral}\n')
    with open(os.path.join(ruta, 'scaler.json'), 'w', encoding='utf-8') as f:
        json.dump({
            'mean': scaler.mean_.tolist(),
            'scale': scaler.scale_.tolist(),
        }, f, ensure_ascii=False, indent=2)
    print(f'Modelo guardado en: {ruta}')
