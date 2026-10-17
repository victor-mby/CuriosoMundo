# EdgeMant — integración local con el simulador

Esta carpeta contiene un receptor local y un puente para navegador. No modifica archivos dentro de `simulador/`. El puente lee los registros completos del simulador por `window.__sim.historial` y los envía a EdgeMant.

## Inicio

1. Desde la raíz del proyecto, ejecuta `python integracion/servidor_ingesta.py`.
2. Inicia el simulador con `python simulador/servidor.py` y abre `http://127.0.0.1:8080`.
3. Inicia la simulación. Abre F12 > Console, pega el contenido de `integracion/puente_consola.js` y pulsa Enter.
4. Verifica `http://127.0.0.1:8765/api/salud` y comprueba que aumente `muestras_ingestadas`.

El receptor crea el esquema solo si falta, no elimina la base existente y escucha únicamente en `127.0.0.1:8765`. La sincronización inicial procesa las muestras que sigan en memoria y luego consulta novedades cada 1,5 segundos. La tabla de ingesta deduplica por motor, timestamp y tiempo de simulación.

La primera versión captura telemetría de los 29 campos; no incorpora eventos ni alarmas y todavía no ejecuta inferencia automática ni actualiza el dashboard en vivo. Probarlo localmente sigue siendo necesario.

## Pruebas automatizadas de la ingesta

Desde la raíz del proyecto:

```bash
python -m unittest discover -s integracion/pruebas -v
```

Las pruebas cubren la inserción de los campos completos, la deduplicación de reintentos y el rechazo de muestras incompletas. Estas pruebas están añadidas al repositorio, pero aún deben ejecutarse en el equipo local para confirmar el resultado.
