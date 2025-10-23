/*
  # Normalize update_available_seats function

  Adjust the function to consider both bookings.seat_numbers and bookings.seats
  arrays when updating routes.available_seats, ensuring compatibility with
  different schema versions.
*/

CREATE OR REPLACE FUNCTION update_available_seats()
RETURNS TRIGGER AS $$
DECLARE
  inserted_count integer := 0;
  deleted_count integer := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    inserted_count := COALESCE(array_length(NEW.seat_numbers, 1), array_length(NEW.seats, 1), 0);
    UPDATE routes
    SET available_seats = available_seats - inserted_count
    WHERE id = NEW.route_id;

  ELSIF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND COALESCE(OLD.status, '') <> 'cancelled') THEN
    deleted_count := COALESCE(array_length(OLD.seat_numbers, 1), array_length(OLD.seats, 1), 0);
    UPDATE routes
    SET available_seats = available_seats + deleted_count
    WHERE id = OLD.route_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;