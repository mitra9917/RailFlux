-- RailFlux post-run reconciliation template.
-- Replace :run_id and fixture values through the experiment runner.

-- No negative inventory.
SELECT COUNT(*) AS negative_inventory_count
FROM seat_inventory
WHERE fixture_id = :fixture_id
  AND available_seats < 0;

-- Returns one row only when confirmed seats do not equal consumed inventory.
WITH inventory_totals AS (
  SELECT COALESCE(SUM(initial_seats - available_seats), 0) AS consumed_inventory
  FROM seat_inventory
  WHERE fixture_id = :fixture_id
),
booking_totals AS (
  SELECT COALESCE(SUM(seat_count), 0) AS confirmed_seats
  FROM bookings
  WHERE run_id = :run_id
    AND status = 'CONFIRMED'
)
SELECT consumed_inventory, confirmed_seats
FROM inventory_totals
CROSS JOIN booking_totals
WHERE consumed_inventory <> confirmed_seats;

-- No idempotency key maps to multiple bookings.
SELECT idempotency_key_hash, COUNT(DISTINCT booking_id) AS booking_count
FROM booking_idempotency
WHERE run_id = :run_id
GROUP BY idempotency_key_hash
HAVING COUNT(DISTINCT booking_id) > 1;

-- No booking has multiple successful payments.
SELECT booking_id, COUNT(*) AS successful_payment_count
FROM payments
WHERE run_id = :run_id AND status = 'SUCCESS'
GROUP BY booking_id
HAVING COUNT(*) > 1;

-- Every confirmed booking has exactly one durable outbox event.
SELECT b.id
FROM bookings b
LEFT JOIN outbox_events o
  ON o.aggregate_id = b.id
 AND o.event_type = 'BOOKING_CONFIRMED'
WHERE b.run_id = :run_id
  AND b.status = 'CONFIRMED'
GROUP BY b.id
HAVING COUNT(o.event_id) <> 1;

-- No accepted booking remains non-terminal after reconciliation timeout.
SELECT COUNT(*) AS non_terminal_booking_count
FROM bookings
WHERE run_id = :run_id
  AND status NOT IN ('CONFIRMED', 'SOLD_OUT', 'FAILED');

-- No side-effect handler executes the same event more than once.
SELECT event_id, handler_type, COUNT(*) AS executions
FROM processed_events
WHERE run_id = :run_id
GROUP BY event_id, handler_type
HAVING COUNT(*) > 1;

-- No orphaned children.
SELECT COUNT(*) AS orphan_payment_count
FROM payments p
LEFT JOIN bookings b ON b.id = p.booking_id
WHERE p.run_id = :run_id AND b.id IS NULL;
