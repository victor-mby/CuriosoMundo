-- Vista de telemetría para Machine Learning
-- Fuente: simulador/src/simulacion/simulador.js
-- Variables seleccionadas para análisis de anomalías con Autoencoder

-- Variables objetivo para el modelo:
-- - Variables hidráulicas: nivel, caudal, altura, nivel_destino, demanda
-- - Variables eléctricas: voltaje, voltaje_terminal, amperaje, corriente_total, factor_potencia
-- - Variables de operación: carga, potencia, caudal_total, potencia_total
-- - Variables de estado: estado_motor, estado_valvula (requieren codificación en Python)
-- - Variables complementarias: posicion_valvula, velocidad_rotacion, horas_operacion

-- NO incluir en entrenamiento automático sin procesamiento:
-- - motor_id: identificador categórico
-- - tiempo, timestamp, fecha, hora: índices temporales
-- - potencia_nominal, corriente_nominal, nivel_tanque_maximo: valores de placa/constantes

CREATE VIEW IF NOT EXISTS vista_telemetria_ml AS
SELECT
    id,
    tiempo,
    timestamp,
    fecha,
    hora,
    motor_id,
    nivel,
    nivel_porcentaje,
    voltaje,
    voltaje_terminal,
    amperaje,
    caudal,
    potencia,
    carga,
    altura,
    factor_potencia,
    caudal_total,
    potencia_total,
    corriente_total,
    nivel_destino,
    demanda,
    estado_motor,
    estado_valvula,
    posicion_valvula,
    velocidad_rotacion,
    horas_operacion
FROM registros_telemetria
ORDER BY motor_id, tiempo;
