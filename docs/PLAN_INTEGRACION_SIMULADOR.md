# Plan de integración de EdgeMant con el simulador

## Decisión técnica inicial

Mantener el simulador intacto y crear un adaptador independiente fuera de `simulador/`. En la primera versión, EdgeMant debe soportar el CSV exportado actualmente y reportar qué columnas no vienen disponibles. No se deben inventar valores para variables ausentes ni confundirlos con cero.

Para obtener las 29 variables internas sin editar el simulador, se requiere elegir y probar un mecanismo externo compatible con el despliegue del navegador. `window.__sim` existe dentro de la página, pero no es accesible directamente desde un proceso Python independiente. Un puente browser-to-local-service requeriría una integración del lado navegador; otra alternativa no invasiva es conservar la exportación CSV y aceptar temporalmente que solo contiene 16 columnas. No se debe afirmar que la captura en vivo ya está implementada.

## Contrato de ingestión propuesto

- Importar únicamente campos realmente presentes en el archivo.
- Aceptar encabezados exactos del exportador, incluidos acentos.
- Convertir vacíos a NULL, no a cero.
- Rechazar filas con fecha numérica o campos esenciales mal formados, con un reporte claro.
- Registrar cantidad total, aceptada, inválida y duplicada.
- Identificar cada registro por una clave de origen estable; no reutilizar el id autoincremental de SQLite como identificador de origen.
- Evitar duplicados al volver a importar el mismo archivo.
- No iniciar ni borrar la base de datos de forma automática durante la captura.

## Criterios de aceptación

1. El simulador funciona sin cambios en sus archivos.
2. Una exportación real puede importarse con los encabezados exactos existentes.
3. Reimportar el mismo archivo no duplica registros.
4. La aplicación indica los campos que no se encuentran disponibles.
5. El modelo no elimina silenciosamente todos los registros por campos ausentes; devuelve un diagnóstico de calidad de datos.
6. La inferencia repetida no duplica el historial de una misma detección.
7. Las pruebas de extremo a extremo documentan las limitaciones: los datos CSV no son una conexión en vivo.
