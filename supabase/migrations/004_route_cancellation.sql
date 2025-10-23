/*
  # Route Cancellation Cascade

  When a route is set to status 'cancelled', cascade effects:
    - Mark all related bookings as 'cancelled'
    - Delete booking_seats to release seats (seat availability updated via trigger)
    - Update payments to 'refunded' for affected bookings

  Relies on existing triggers:
    - update_seat_availability on booking_seats (sets seats.is_available)
    - update_available_seats on bookings (adjusts routes.available_seats by seat_numbers)
*/

-- Function to handle cascading updates when a route is cancelled
CREATE OR REPLACE FUNCTION handle_route_cancellation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act when status changes to 'cancelled'
  IF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND COALESCE(OLD.status, '') <> 'cancelled' THEN
    -- Cancel all bookings for this route
    UPDATE bookings
    SET status = 'cancelled', updated_at = now()
    WHERE route_id = NEW.id AND status <> 'cancelled';

    -- Refund payments for affected bookings
    UPDATE payments
    SET status = 'refunded', updated_at = now()
    WHERE booking_id IN (
      SELECT id FROM bookings WHERE route_id = NEW.id
    ) AND status IN ('completed', 'pending');

    -- Release seats by deleting booking_seats associated with the route's bookings
    DELETE FROM booking_seats
    WHERE booking_id IN (
      SELECT id FROM bookings WHERE route_id = NEW.id
    );
    
    -- Do NOT set routes.available_seats here explicitly.
    -- It will be adjusted by existing triggers on bookings (update_available_seats)
    -- and by booking_seats (update_seat_availability).
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to invoke cascade on route status change
CREATE TRIGGER on_route_cancelled
  AFTER UPDATE ON routes
  FOR EACH ROW EXECUTE FUNCTION handle_route_cancellation();