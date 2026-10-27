# Integración del simulador con EdgeMant

## Estado actual

La integración por captura en vivo está implementada como un adaptador externo, sin editar los archivos de `simulador/`:

- `integracion/puente_consola.js` lee las muestras de `window.__sim.historial` desde la consola del navegador.
- `integracion/servidor_ingesta.py` recibe lotes JSON en `127.0.0.1:8765`, valida los 29 campos, guarda en SQLite y evita duplicados mediante una clave de origen.
- `base_datos/base_datos.sql` define el esquema principal y `base_datos/view_ml.sql` la vista de variables para el modelo.
- El dashboard ejecuta la inferencia bajo demanda y conserva el historial de detecciones.
- El asistente local consulta Ollama; no controla bombas ni sustituye la verificación del operador.

**Importante:** la integración está implementada en el código, pero no se debe considerar validada de extremo a extremo hasta ejecutarla en el equipo local con el simulador y la base de datos reales. No se han comprobado aquí todos los escenarios de red, reinicio ni carga prolongada.

## Flujo previsto

```text
Simulador (navegador)
  -> puente de consola
  -> receptor local HTTP
  -> SQLite (registros_telemetria)
  -> vista_telemetria_ml
  -> Autoencoder e inferencia
  -> historial de detecciones
  -> dashboard y asistente local Ollama
```

Las alarmas operativas generadas por el simulador y las anomalías del modelo son conceptos diferentes. No deben mezclarse ni presentarse como equivalentes.

## Arranque

Desde la raíz del repositorio, abre terminales separadas:

1. `py integracion/servidor_ingesta.py`
2. `py simulador/servidor.py 8081`; abre `http://127.0.0.1:8081/index.html`, inicia la simulación y ejecuta el contenido de `integracion/puente_consola.js` en DevTools > Console.
3. `py dashboard/app.py`; abre `http://127.0.0.1:5000`.

El puente está configurado para enviar al puerto `8765`. El receptor solo escucha en loopback. Si el navegador bloquea la petición, revisa la consola y la lista de orígenes permitidos en `integracion/servidor_ingesta.py`; no desactives la protección del navegador como solución.

## Contrato de ingestión

- Rechazar muestras incompletas o con campos numéricos no finitos.
- No reemplazar variables ausentes por cero.
- No borrar ni reiniciar la base de datos al iniciar el receptor.
- Deduplicar los reintentos sin duplicar filas.
- Mantener la base de datos y sus archivos WAL/SHM.
- No entrenar el modelo ni modificar su umbral automáticamente al recibir telemetría.
- Una anomalía del Autoencoder es una señal para investigar, no una confirmación de avería física.

## Validación pendiente

Desde la raíz, ejecutar por separado:

```powershell
py -m unittest discover -s integracion/pruebas -v
py -m unittest discover -s dashboard/pruebas -v
py -m unittest discover -s base_datos/pruebas -v
```

Antes de ejecutar pruebas de etapa en `pruebas/`, revisar su contenido y confirmar que trabajan con una base temporal: algunos scripts de integración pueden generar datos. No borrar la base operativa para resolver un fallo.

Validación manual mínima:

1. Comprobar `/api/salud` del receptor y del dashboard.
2. Capturar varias muestras y confirmar que aumenta el conteo de registros.
3. Forzar un reenvío del mismo lote y verificar que no aparecen duplicados.
4. Ejecutar inferencia y verificar que el historial no duplica la misma detección.
5. Detener y reiniciar los servicios, confirmando que la telemetría ya almacenada persiste.
6. Probar el asistente con Ollama disponible y no disponible.
7. Comparar la salida del modelo con datos reales antes de confiar en la severidad sugerida.
