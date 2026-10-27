# EdgeMant

Sistema local de apoyo al mantenimiento predictivo de bombas centrífugas. El proyecto incluye un simulador, receptor de telemetría, almacenamiento SQLite, análisis de anomalías y dashboard Flask con un asistente local basado en Ollama. Las respuestas del asistente se transmiten al chat en fragmentos mientras el modelo las genera.

## Requisitos

- Python compatible con las dependencias de `requirements.txt`.
- Ollama instalado localmente.
- Modelo local `qwen3:1.7b` descargado.
- Navegador moderno.

## Instalación

Desde la raíz del repositorio, crea un entorno virtual si todavía no tienes uno:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
py -m pip install -r requirements.txt
```

Descarga el modelo de IA una sola vez:

```powershell
ollama pull qwen3:1.7b
ollama run qwen3:1.7b
```

Cuando compruebes que responde, escribe `/bye` para salir. Mantén Ollama ejecutándose en segundo plano para utilizar el asistente.

## Inicio del sistema

Abre tres terminales PowerShell en la raíz del proyecto.

**Terminal 1 — receptor de telemetría**

```powershell
py integracion/servidor_ingesta.py
```

El receptor escucha en `127.0.0.1:8765` y crea las tablas que falten sin borrar la base de datos existente.

**Terminal 2 — simulador**

```powershell
py simulador/servidor.py 8081
```

Abre `http://127.0.0.1:8081/index.html`, inicia la simulación y sigue las instrucciones de `integracion/README.md` para activar el puente desde las herramientas de desarrollador del navegador. El puerto 8081 evita el conflicto habitual con servicios que ocupan el 8080.

**Terminal 3 — dashboard**

```powershell
py dashboard/app.py
```

Abre `http://127.0.0.1:5000`. La conexión con Ollama se indica en la parte superior del dashboard.

## Comprobaciones

- Salud del dashboard: `http://127.0.0.1:5000/api/salud`
- Estado del modelo local: `http://127.0.0.1:5000/api/asistente/estado`
- Salud del receptor: `http://127.0.0.1:8765/api/salud`

Desde la raíz del proyecto, ejecuta primero las pruebas unitarias que usan una base temporal o mocks:

```powershell
py -m unittest discover -s integracion/pruebas -v
py -m unittest discover -s dashboard/pruebas -v
```

Después revisa individualmente los tests de `base_datos/pruebas` y los scripts de `pruebas/` antes de ejecutarlos: algunos scripts de etapa generan datos y podrían modificar la base configurada. No ejecutes scripts de generación contra datos operativos ni borres la base de datos para resolver un fallo. La ejecución local completa aún está pendiente de confirmación.

## Configuración opcional de Ollama

Por defecto, EdgeMant usa el servicio local `http://127.0.0.1:11434` y el modelo `qwen3:1.7b`. Se pueden configurar `OLLAMA_HOST`, `OLLAMA_MODEL` y `OLLAMA_TIMEOUT` mediante variables de entorno. No configures una dirección externa sin autorización de seguridad.

## Límites y seguridad

- Una anomalía detectada por el algoritmo no demuestra por sí sola una avería física.
- El asistente interpreta datos existentes; no controla bombas, válvulas ni equipos.
- Las respuestas de la IA deben contrastarse con mediciones y procedimientos técnicos.
- La integración actual no incorpora todavía RAG ni consulta automática de manuales.
- No se ha verificado en este cambio la ejecución local de todas las pruebas; deben ejecutarse en el equipo de desarrollo.
