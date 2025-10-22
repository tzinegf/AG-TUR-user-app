import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? (Constants.expoConfig?.extra as any)?.supabaseUrl ?? '').trim();
const supabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? (Constants.expoConfig?.extra as any)?.supabaseAnonKey ?? '').trim();

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[Supabase] Missing environment variables: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (or define in app.json extra).'
  );
}

// Use different storage for web and native
const storage = Platform.OS === 'web' ? undefined : AsyncStorage;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Database types
export interface Profile {
  id: string;
  email: string;
  name: string;
  phone: string;
  created_at: string;
  updated_at: string;
}

export interface BusRoute {
  id: string;
  origin: string;
  destination: string;
  departure_datetime: string;
  arrival_datetime: string;
  price: number;
  bus_company: string;
  bus_type: string;
  amenities?: string[];
  duration?: string;
  status: string;
  created_at: string;
}

export interface Ticket {
  id: string;
  user_id: string;
  route_id: string;
  seat_number: string;
  passenger_name: string;
  passenger_document: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  payment_status: 'pending' | 'paid' | 'refunded';
  total_price: number;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  user_id: string;
  route_id: string;
  seat_number: string;
  passenger_name: string;
  passenger_document: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  payment_status: 'pending' | 'paid' | 'refunded';
  total_price: number;
  created_at: string;
  updated_at: string;
}

export interface Bus {
  id: string;
  plate: string;
  model: string;
  brand: string;
  year: number;
  seats: number;
  type: 'convencional' | 'executivo' | 'leito';
  status: 'active' | 'maintenance' | 'inactive';
  amenities?: string[];
  imageurl?: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  booking_id: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  payment_method: string;
  transaction_id?: string;
  created_at: string;
  updated_at: string;
}
