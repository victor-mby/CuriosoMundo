# EdgeMant — auditoría inicial de integración con el simulador

Fecha: 2026-10-16
Rama: `auditoria/integracion-simulador`

## Objetivo

EdgeMant debe consumir los datos generados por el simulador de estación de bombeo, conservarlos en SQLite, analizarlos con el flujo de Machine Learning existente y mostrar resultados en el dashboard. El simulador se considera componente protegido: esta auditoría no propone modificar sus archivos.

## Hallazgos confirmados en el código revisado

### 1. El simulador tiene una API interna de eventos, pero no se observa integración con EdgeMant

- `simulador/src/simulacion/simulador.js` crea registros en `capturar(dt)`, los añade al historial en memoria y emite el evento `muestra`.
- `simulador/src/ui/app.js` instancia el simulador y expone la instancia únicamente como `window.__sim`.
- No se observó en esos archivos una petición HTTP hacia EdgeMant ni una exportación automática de cada registro a SQLite.
- La interfaz del simulador ejecuta por separado el ciclo de simulación.

### 2. La exportación CSV pierde campos generados internamente

`capturar()` construye un objeto con 29 campos por motor. Sin embargo, `simulador/src/simulacion/historial.js` define una lista `COLUMNAS` con solo 16 campos para el CSV. No incluye, entre otros, `timestamp`, `voltaje_terminal`, `corriente_nominal`, `potencia_nominal`, `carga`, `altura`, `factor_potencia`, `posicion_valvula`, `velocidad_rotacion`, `horas_operacion`, `corriente_total` y `nivel_tanque_maximo`.

La solución no debe alterar el simulador. Primero se debe evaluar una captura complementaria y no invasiva, o consumir los registros desde un mecanismo de lectura que ya esté disponible.

### 3. El importador CSV no coincide plenamente con los encabezados exportados

En `base_datos/importar_csv.py`, se consultan encabezados como `Motor`, `Tiempo simulación (s)`, `timestamp`, `Nivel (m)`, `Fecha` y `Voltaje (V)`. El exportador observado produce los encabezados derivados de `COLUMNAS`: `Fecha`, `Hora`, `Tiempo simulación`, `Motor`, etc. Algunos encabezados consultados por el importador no existen en el CSV actual; varios campos ausentes terminan como valores predeterminados o `NULL`.

### 4. La preparación de ML descarta filas incompletas

`ml/preparar_datos.py` selecciona 18 variables. Después sustituye infinitos por nulos y hace `dropna()`. Como los campos que no llegan por CSV quedan vacíos, los registros de producción podrían eliminarse masivamente del entrenamiento/inferencia. Es necesario medir completitud de datos y distinguir datos no disponibles de ceros verdaderos.

### 5. La inferencia y el historial necesitan controles de idempotencia

`dashboard/servicios/dashboard.py` procesa cada anomalía y la inserta en `detecciones_anomalias`. El esquema revisado no define una restricción única que impida guardar repetidamente la misma detección del mismo registro cada vez que se ejecuta la inferencia. Se debe diseñar una clave idempotente antes de usar inferencia recurrente.

### 6. El reinicio de base de datos es destructivo

`base_datos/crear_base_datos.py` elimina `edgemant.db` si existe y la vuelve a crear. Debe indicarse claramente como comando de reinicio/desarrollo y no ejecutarse automáticamente en la integración en vivo.

### 7. Riesgo de seguridad en el servidor del dashboard

`dashboard/app.py` inicia Flask con `debug=True` y `host='0.0.0.0'`. Es aceptable solo para desarrollo controlado; no debe tratarse como configuración de producción.

## Arquitectura objetivo (sin modificar el simulador)

1. Simulador ejecuta su lógica sin cambios.
2. Un adaptador externo captura las muestras mediante un mecanismo compatible con el navegador/servidor local, sin editar los archivos del simulador.
3. El adaptador valida el esquema, marca procedencia y evita duplicados.
4. EdgeMant guarda la telemetría original en SQLite.
5. La vista SQL y la preparación ML consumen solo variables válidas y registran explícitamente las faltantes.
6. El modelo produce resultados inferidos y el dashboard los muestra con historial idempotente.

## Próximos pasos propuestos

1. Confirmar el mecanismo de integración no invasivo más viable con la estructura del simulador: puente de datos local independiente o exportación manual validada como paso intermedio.
2. Escribir pruebas del esquema y del importador a partir del CSV real generado.
3. Diseñar captura incremental con un identificador/clave estable de muestra, evitando duplicados.
4. Añadir métricas de calidad de datos (filas leídas, filas aceptadas, nulos por variable, duplicados).
5. Solo después conectar el flujo continuo a ML y dashboard.

## Alcance y límites de esta auditoría

Esta es una revisión estática del código fuente y la documentación del repositorio. No se ejecutó localmente el simulador ni el dashboard y, por tanto, no se afirma que el flujo completo esté probado en ejecución. No se modificaron archivos del simulador ni se cambió el comportamiento de la rama `main`.
