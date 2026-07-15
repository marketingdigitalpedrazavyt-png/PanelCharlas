-- =========================================================
--  Maravillas del Mediterráneo — Esquema MySQL
--  Se ejecuta automáticamente al crear el contenedor de MySQL.
--  El superadmin NO se crea acá: lo siembra el backend al arrancar
--  (necesita hashear la contraseña con bcrypt).
-- =========================================================
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS usuarios (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email         VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol           ENUM('superadmin','staff') NOT NULL DEFAULT 'staff',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS eventos (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  dia        DATE NOT NULL,
  hora       VARCHAR(5) NOT NULL,
  lugar      VARCHAR(190) NULL,
  direccion  VARCHAR(255) NOT NULL,
  barrio     VARCHAR(120) NOT NULL,
  vendedor   VARCHAR(120) NULL,            -- vendedor "a cargo" del evento (opcional)
  activo     TINYINT(1) NOT NULL DEFAULT 1,
  modalidad  VARCHAR(20) NOT NULL DEFAULT 'presencial',  -- 'presencial' | 'zoom'
  enlace     VARCHAR(500) NULL,            -- link de Zoom (solo eventos online)
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vendedores (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug       VARCHAR(60) NOT NULL,
  nombre     VARCHAR(160) NOT NULL,
  activo     TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vendedores_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inscripciones (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo          VARCHAR(20) NOT NULL,
  nombre          VARCHAR(120) NOT NULL,
  apellido        VARCHAR(120) NOT NULL,
  dni             VARCHAR(20) NOT NULL,
  celular         VARCHAR(20) NOT NULL,
  cjp             VARCHAR(120) NOT NULL DEFAULT '',
  evento_id       BIGINT UNSIGNED NULL,
  vendedor_slug   VARCHAR(60) NULL,
  vendedor_nombre VARCHAR(160) NOT NULL DEFAULT 'Directo',
  asistio         TINYINT(1) NOT NULL DEFAULT 0,
  asistio_at      TIMESTAMP NULL DEFAULT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inscripciones_codigo (codigo),
  UNIQUE KEY uq_evento_dni (evento_id, dni),        -- 1 DNI por evento
  UNIQUE KEY uq_evento_celular (evento_id, celular),-- 1 celular por evento
  KEY idx_inscripciones_evento (evento_id),
  KEY idx_inscripciones_vendedor (vendedor_slug),
  CONSTRAINT fk_inscripciones_evento FOREIGN KEY (evento_id)
    REFERENCES eventos (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
