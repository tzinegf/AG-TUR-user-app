/*
  # Seed Data for AG TUR
  
  1. Sample routes
  2. Sample admin user
*/

-- Insert sample routes
INSERT INTO routes (origin, destination, departure_time, arrival_time, price, available_seats, total_seats, bus_company, bus_type, amenities)
VALUES
  ('São Paulo', 'Rio de Janeiro', '2025-01-20 08:00:00', '2025-01-20 14:30:00', 89.90, 40, 44, 'AG TUR', 'Executivo', ARRAY['Wi-Fi', 'Ar Condicionado', 'Banheiro', 'Tomadas USB']),
  ('São Paulo', 'Rio de Janeiro', '2025-01-20 14:00:00', '2025-01-20 20:30:00', 89.90, 38, 44, 'AG TUR', 'Executivo', ARRAY['Wi-Fi', 'Ar Condicionado', 'Banheiro', 'Tomadas USB']),
  ('São Paulo', 'Rio de Janeiro', '2025-01-20 22:00:00', '2025-01-21 04:30:00', 79.90, 42, 44, 'AG TUR', 'Convencional', ARRAY['Ar Condicionado', 'Banheiro']),
  ('Rio de Janeiro', 'São Paulo', '2025-01-20 09:00:00', '2025-01-20 15:30:00', 89.90, 35, 44, 'AG TUR', 'Executivo', ARRAY['Wi-Fi', 'Ar Condicionado', 'Banheiro', 'Tomadas USB']),
  ('São Paulo', 'Campinas', '2025-01-20 07:00:00', '2025-01-20 08:30:00', 35.00, 40, 44, 'AG TUR', 'Executivo', ARRAY['Ar Condicionado', 'Wi-Fi']),
  ('São Paulo', 'Santos', '2025-01-20 10:00:00', '2025-01-20 11:30:00', 28.00, 42, 44, 'AG TUR', 'Convencional', ARRAY['Ar Condicionado']),
  ('São Paulo', 'Belo Horizonte', '2025-01-20 21:00:00', '2025-01-21 05:00:00', 120.00, 30, 44, 'AG TUR', 'Leito', ARRAY['Wi-Fi', 'Ar Condicionado', 'Banheiro', 'Tomadas USB', 'Cobertor', 'Travesseiro']),
  ('Belo Horizonte', 'São Paulo', '2025-01-20 22:00:00', '2025-01-21 06:00:00', 120.00, 32, 44, 'AG TUR', 'Leito', ARRAY['Wi-Fi', 'Ar Condicionado', 'Banheiro', 'Tomadas USB', 'Cobertor', 'Travesseiro']);
