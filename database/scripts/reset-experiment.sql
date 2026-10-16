-- Clear mutable experiment state and restore inventory for the active fixture.
-- Set @fixture_id before running (see reset.sh).

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM booking_passengers;
DELETE FROM payments;
DELETE FROM booking_idempotency;
DELETE FROM processed_events;
DELETE FROM outbox_events;
DELETE FROM bookings;

UPDATE seat_inventory
SET available_seats = initial_seats,
    version = 0
WHERE fixture_id = @fixture_id;

SET FOREIGN_KEY_CHECKS = 1;
