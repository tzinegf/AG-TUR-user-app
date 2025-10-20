/*
  # Seats Table Migration
  
  1. New Tables:
     - seats (individual seat records for each route)
     - booking_seats (junction table for bookings and seats)
  
  2. Features:
     - Track seat availability per route
     - Support for different seat types (window, aisle, etc.)
     - Real-time seat status updates
     - Relationship with bookings
*/

-- First, check if routes table exists and get its id column type
DO $$
DECLARE
    routes_id_type text;
    bookings_id_type text;
BEGIN
    -- Get the data type of routes.id column
    SELECT data_type INTO routes_id_type
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'routes' 
    AND column_name = 'id';
    
    -- Get the data type of bookings.id column
    SELECT data_type INTO bookings_id_type
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'bookings' 
    AND column_name = 'id';
    
    -- Handle bookings table ID type conversion first
    IF bookings_id_type = 'integer' THEN
        RAISE NOTICE 'Bookings table has integer id. Converting to uuid.';
        
        -- Add a new uuid column for bookings
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS new_id uuid DEFAULT gen_random_uuid();
        
        -- Update any existing booking_seats references (if table exists)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_seats') THEN
            UPDATE booking_seats SET booking_id = (
                SELECT new_id FROM bookings WHERE bookings.id = booking_seats.booking_id::integer
            ) WHERE EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_seats.booking_id::integer);
        END IF;
        
        -- Drop the old id column and rename new_id to id
        ALTER TABLE bookings DROP COLUMN IF EXISTS id CASCADE;
        ALTER TABLE bookings RENAME COLUMN new_id TO id;
        ALTER TABLE bookings ADD PRIMARY KEY (id);
    END IF;
    
    -- If routes table doesn't exist or id is not uuid, we need to handle this
    IF routes_id_type IS NULL THEN
        RAISE NOTICE 'Routes table does not exist. Creating it first.';
        
        -- Create routes table with uuid id if it doesn't exist
        CREATE TABLE IF NOT EXISTS routes (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            origin text NOT NULL,
            destination text NOT NULL,
            departure_time timestamptz NOT NULL,
            arrival_time timestamptz NOT NULL,
            price decimal(10,2) NOT NULL,
            available_seats integer NOT NULL DEFAULT 40,
            total_seats integer NOT NULL DEFAULT 40,
            bus_company text NOT NULL DEFAULT 'AG TUR',
            bus_type text NOT NULL DEFAULT 'convencional',
            amenities text[] DEFAULT '{}',
            status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed')),
            created_at timestamptz DEFAULT now()
        );
        
        ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
        
    ELSIF routes_id_type = 'integer' THEN
        RAISE NOTICE 'Routes table has integer id. Converting to uuid.';
        
        -- If routes.id is integer, we need to convert it to uuid
        -- First, drop any existing foreign key constraints
        ALTER TABLE IF EXISTS bookings DROP CONSTRAINT IF EXISTS bookings_route_id_fkey;
        
        -- Add a new uuid column
        ALTER TABLE routes ADD COLUMN IF NOT EXISTS new_id uuid DEFAULT gen_random_uuid();
        
        -- Update any existing bookings to use the new uuid
        -- First check if bookings.route_id is text, integer, or uuid type
        DO $update_bookings$
        DECLARE
            bookings_route_id_type text;
        BEGIN
            SELECT data_type INTO bookings_route_id_type
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'bookings' 
            AND column_name = 'route_id';
            
            IF bookings_route_id_type = 'integer' THEN
                -- First convert bookings.route_id to text to store the new uuid values
                ALTER TABLE bookings ALTER COLUMN route_id TYPE text USING route_id::text;
                
                -- Now update with the new uuid values (as text)
                UPDATE bookings SET route_id = (
                    SELECT new_id::text FROM routes WHERE routes.id = bookings.route_id::integer
                ) WHERE EXISTS (SELECT 1 FROM routes WHERE routes.id = bookings.route_id::integer);
                
            ELSIF bookings_route_id_type = 'text' THEN
                -- If bookings.route_id is text, convert integer to text for comparison
                UPDATE bookings SET route_id = (
                    SELECT new_id::text FROM routes WHERE routes.id = bookings.route_id::integer
                ) WHERE EXISTS (SELECT 1 FROM routes WHERE routes.id = bookings.route_id::integer);
            ELSIF bookings_route_id_type = 'uuid' THEN
                -- If bookings.route_id is already uuid, just update with new_id
                UPDATE bookings SET route_id = (
                    SELECT new_id FROM routes WHERE routes.id::text = bookings.route_id::text
                ) WHERE EXISTS (SELECT 1 FROM routes WHERE routes.id::text = bookings.route_id::text);
            END IF;
        END $update_bookings$;
        
        -- Drop the old id column and rename new_id to id
        ALTER TABLE routes DROP COLUMN IF EXISTS id CASCADE;
        ALTER TABLE routes RENAME COLUMN new_id TO id;
        ALTER TABLE routes ADD PRIMARY KEY (id);
        
        -- Recreate foreign key constraint for bookings if the table exists
        DO $recreate_fk$
        DECLARE
            bookings_route_id_type text;
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bookings') THEN
                -- Check the final type of bookings.route_id
                SELECT data_type INTO bookings_route_id_type
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'bookings' 
                AND column_name = 'route_id';
                
                -- Convert bookings.route_id to uuid (it should be text at this point)
                IF bookings_route_id_type = 'text' THEN
                    ALTER TABLE bookings ALTER COLUMN route_id TYPE uuid USING route_id::uuid;
                ELSIF bookings_route_id_type = 'integer' THEN
                    -- This shouldn't happen since we converted it above, but just in case
                    ALTER TABLE bookings ALTER COLUMN route_id TYPE text USING route_id::text;
                    ALTER TABLE bookings ALTER COLUMN route_id TYPE uuid USING route_id::uuid;
                END IF;
                
                -- Now add the foreign key constraint
                ALTER TABLE bookings ADD CONSTRAINT bookings_route_id_fkey 
                FOREIGN KEY (route_id) REFERENCES routes(id);
            END IF;
        END $recreate_fk$;
        
    END IF;
END $$;

-- Now create seats table with proper route_id reference
CREATE TABLE IF NOT EXISTS seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  seat_number text NOT NULL,
  seat_type text NOT NULL DEFAULT 'standard' CHECK (seat_type IN ('standard', 'window', 'aisle', 'premium')),
  row_number integer NOT NULL,
  position text NOT NULL CHECK (position IN ('A', 'B', 'C', 'D')), -- A e D são janela, B e C são corredor
  is_available boolean NOT NULL DEFAULT true,
  price_modifier decimal(5,2) DEFAULT 0.00, -- Modificador de preço para assentos premium
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraint para garantir que não há assentos duplicados por rota
  UNIQUE(route_id, seat_number)
);

-- Create booking_seats junction table
CREATE TABLE IF NOT EXISTS booking_seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  seat_id uuid NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
  passenger_name text,
  passenger_document text,
  created_at timestamptz DEFAULT now(),
  
  -- Constraint para garantir que um assento não seja reservado duas vezes na mesma reserva
  UNIQUE(booking_id, seat_id)
);

-- Enable RLS
ALTER TABLE seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_seats ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_seats_route_id ON seats(route_id);
CREATE INDEX IF NOT EXISTS idx_seats_availability ON seats(route_id, is_available);
CREATE INDEX IF NOT EXISTS idx_booking_seats_booking_id ON booking_seats(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_seats_seat_id ON booking_seats(seat_id);

-- RLS Policies for seats
CREATE POLICY "Anyone can view seats" ON seats
  FOR SELECT USING (true);

CREATE POLICY "System can manage seats" ON seats
  FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS Policies for booking_seats
CREATE POLICY "Users can view own booking seats" ON booking_seats
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookings 
      WHERE bookings.id = booking_seats.booking_id 
      AND bookings.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create booking seats" ON booking_seats
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings 
      WHERE bookings.id = booking_seats.booking_id 
      AND bookings.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all booking seats" ON booking_seats
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Function to automatically create seats for a route
CREATE OR REPLACE FUNCTION create_seats_for_route(
  p_route_id uuid,
  p_total_seats integer DEFAULT 40
)
RETURNS void AS $$
DECLARE
  seat_num integer;
  row_num integer;
  seat_pos text;
  positions text[] := ARRAY['A', 'B', 'C', 'D'];
  pos_index integer;
BEGIN
  -- Delete existing seats for this route (in case of recreation)
  DELETE FROM seats WHERE route_id = p_route_id;
  
  -- Create seats based on total_seats
  FOR seat_num IN 1..p_total_seats LOOP
    row_num := ((seat_num - 1) / 4) + 1;
    pos_index := ((seat_num - 1) % 4) + 1;
    seat_pos := positions[pos_index];
    
    INSERT INTO seats (
      route_id,
      seat_number,
      seat_type,
      row_number,
      position,
      is_available
    ) VALUES (
      p_route_id,
      LPAD(seat_num::text, 2, '0'),
      CASE 
        WHEN seat_pos IN ('A', 'D') THEN 'window'
        ELSE 'aisle'
      END,
      row_num,
      seat_pos,
      true
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to update seat availability when booking is created/cancelled
CREATE OR REPLACE FUNCTION update_seat_availability()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Mark seat as unavailable
    UPDATE seats 
    SET is_available = false, updated_at = now()
    WHERE id = NEW.seat_id;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Mark seat as available again
    UPDATE seats 
    SET is_available = true, updated_at = now()
    WHERE id = OLD.seat_id;
    
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update seat availability
CREATE TRIGGER update_seat_availability_trigger
  AFTER INSERT OR DELETE ON booking_seats
  FOR EACH ROW EXECUTE FUNCTION update_seat_availability();

-- Function to automatically create seats when a new route is added
CREATE OR REPLACE FUNCTION auto_create_seats_for_new_route()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_seats_for_route(NEW.id, NEW.total_seats);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create seats automatically for new routes
CREATE TRIGGER auto_create_seats_trigger
  AFTER INSERT ON routes
  FOR EACH ROW EXECUTE FUNCTION auto_create_seats_for_new_route();

-- Create seats for existing routes
DO $$
DECLARE
  route_record RECORD;
  total_seats_exists boolean;
BEGIN
  -- Check if total_seats column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'routes' 
    AND column_name = 'total_seats'
  ) INTO total_seats_exists;
  
  IF total_seats_exists THEN
    -- Use total_seats column if it exists
    FOR route_record IN SELECT id, total_seats FROM routes LOOP
      PERFORM create_seats_for_route(route_record.id, route_record.total_seats);
    END LOOP;
  ELSE
    -- Use default value if total_seats column doesn't exist
    FOR route_record IN SELECT id FROM routes LOOP
      PERFORM create_seats_for_route(route_record.id, 40);
    END LOOP;
  END IF;
END $$;