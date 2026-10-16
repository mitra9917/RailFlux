-- RailFlux core schema v1.0 (MySQL 8)
-- Aligns with docs/design/data-consistency.md and experiment/correctness.sql

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(32) NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
);

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  cohort VARCHAR(32) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY idx_users_cohort (cohort)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS trains (
  train_no VARCHAR(16) NOT NULL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  source CHAR(5) NOT NULL,
  destination CHAR(5) NOT NULL,
  KEY idx_trains_route (source, destination)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS train_runs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  train_no VARCHAR(16) NOT NULL,
  journey_date DATE NOT NULL,
  CONSTRAINT fk_train_runs_train FOREIGN KEY (train_no) REFERENCES trains (train_no),
  UNIQUE KEY uq_train_runs_schedule (train_no, journey_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS seat_inventory (
  id CHAR(36) NOT NULL PRIMARY KEY,
  train_run_id CHAR(36) NOT NULL,
  fixture_id VARCHAR(64) NOT NULL,
  class_code VARCHAR(8) NOT NULL,
  quota VARCHAR(16) NOT NULL,
  initial_seats INT NOT NULL,
  available_seats INT NOT NULL,
  version INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_inventory_train_run FOREIGN KEY (train_run_id) REFERENCES train_runs (id),
  CONSTRAINT chk_inventory_nonneg CHECK (available_seats >= 0),
  CONSTRAINT chk_inventory_initial CHECK (initial_seats >= 0),
  CONSTRAINT chk_inventory_bounds CHECK (available_seats <= initial_seats),
  UNIQUE KEY uq_inventory_bucket (train_run_id, fixture_id, class_code, quota),
  KEY idx_inventory_fixture (fixture_id),
  KEY idx_inventory_claim (id, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bookings (
  id CHAR(36) NOT NULL PRIMARY KEY,
  run_id VARCHAR(64) NOT NULL,
  simulated_pnr VARCHAR(16) NULL,
  user_id CHAR(36) NOT NULL,
  inventory_id CHAR(36) NOT NULL,
  status VARCHAR(32) NOT NULL,
  seat_count INT NOT NULL,
  total_fare DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_bookings_inventory FOREIGN KEY (inventory_id) REFERENCES seat_inventory (id),
  CONSTRAINT chk_bookings_seat_count CHECK (seat_count BETWEEN 1 AND 4),
  UNIQUE KEY uq_bookings_simulated_pnr (simulated_pnr),
  KEY idx_bookings_run_status (run_id, status),
  KEY idx_bookings_inventory (inventory_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS booking_passengers (
  id CHAR(36) NOT NULL PRIMARY KEY,
  booking_id CHAR(36) NOT NULL,
  synthetic_name VARCHAR(80) NOT NULL,
  age TINYINT UNSIGNED NOT NULL,
  CONSTRAINT fk_passengers_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE,
  KEY idx_passengers_booking (booking_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  run_id VARCHAR(64) NOT NULL,
  booking_id CHAR(36) NOT NULL,
  status VARCHAR(32) NOT NULL,
  stub_sequence VARCHAR(64) NOT NULL,
  CONSTRAINT fk_payments_booking FOREIGN KEY (booking_id) REFERENCES bookings (id),
  KEY idx_payments_run_status (run_id, status),
  KEY idx_payments_booking (booking_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS booking_idempotency (
  idempotency_key_hash CHAR(64) NOT NULL PRIMARY KEY,
  run_id VARCHAR(64) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  booking_id CHAR(36) NULL,
  response_body JSON NULL,
  expires_at TIMESTAMP(6) NOT NULL,
  CONSTRAINT fk_idempotency_booking FOREIGN KEY (booking_id) REFERENCES bookings (id),
  KEY idx_idempotency_run (run_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS outbox_events (
  event_id CHAR(36) NOT NULL PRIMARY KEY,
  aggregate_type VARCHAR(64) NOT NULL,
  aggregate_id CHAR(36) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  payload JSON NOT NULL,
  published_at TIMESTAMP(6) NULL,
  KEY idx_outbox_unpublished (published_at, aggregate_type),
  KEY idx_outbox_aggregate (aggregate_id, event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS processed_events (
  event_id CHAR(36) NOT NULL,
  run_id VARCHAR(64) NOT NULL,
  handler_type VARCHAR(64) NOT NULL,
  processed_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (event_id, handler_type),
  CONSTRAINT fk_processed_outbox FOREIGN KEY (event_id) REFERENCES outbox_events (event_id),
  KEY idx_processed_run (run_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
