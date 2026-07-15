-- =====================================================================
--  Migración: correo electrónico en inscripciones
--  Agrega la columna `email` (se usa en los eventos por Zoom, donde el
--  formulario /online pide correo en vez de institución).
--  Correr UNA vez en la base de producción (base: maravillas).
--
--  Nota: MySQL 8 no soporta "ADD COLUMN IF NOT EXISTS". Si ya existe,
--  da error 1060 (Duplicate column) — inofensivo, ya estaba aplicado.
-- =====================================================================

ALTER TABLE inscripciones
  ADD COLUMN email VARCHAR(190) NOT NULL DEFAULT '' AFTER cjp;

SELECT id, nombre, apellido, cjp, email FROM inscripciones;
