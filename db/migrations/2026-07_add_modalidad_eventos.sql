-- =====================================================================
--  Migración: eventos por Zoom (online)
--  Agrega a la tabla `eventos` la modalidad (presencial | zoom) y el link.
--  Correr UNA vez en la base de producción (base: maravillas).
--
--  Nota: MySQL 8 no soporta "ADD COLUMN IF NOT EXISTS". Si las columnas ya
--  existen, este script da error 1060 (Duplicate column) — es inofensivo,
--  significa que ya estaba aplicado.
-- =====================================================================

ALTER TABLE eventos
  ADD COLUMN modalidad VARCHAR(20) NOT NULL DEFAULT 'presencial',  -- 'presencial' | 'zoom'
  ADD COLUMN enlace    VARCHAR(500) NULL;                          -- link de Zoom (solo online)

-- Los eventos existentes quedan como 'presencial' por el DEFAULT. Verificación:
SELECT id, dia, hora, modalidad, enlace FROM eventos;
