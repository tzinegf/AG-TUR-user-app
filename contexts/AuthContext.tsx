import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  email: string;
  name?: string;
  phone?: string;
}

interface AuthContextData {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string, phone?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredData();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const userData = {
            id: session.user.id,
            email: session.user.email!,
            name: session.user.user_metadata?.name,
            phone: session.user.user_metadata?.phone,
          };
          setUser(userData);
          await AsyncStorage.setItem('@AGTur:user', JSON.stringify(userData));
        } else {
          setUser(null);
          await AsyncStorage.removeItem('@AGTur:user');
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function loadStoredData() {
    try {
      console.log('Loading stored data...');
      
      // Definir loading como false imediatamente para evitar redirecionamentos automáticos
      setLoading(false);
      
      // For web platform, skip AsyncStorage and just check session
      if (typeof window !== 'undefined') {
        console.log('Web platform detected, checking session only...');
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Session:', session);
        
        if (session?.user) {
          const userData = {
            id: session.user.id,
            email: session.user.email!,
            name: session.user.user_metadata?.name,
            phone: session.user.user_metadata?.phone,
          };
          console.log('Setting user from session:', userData);
          setUser(userData);
        } else {
          console.log('No session found, user is null');
          // Não definir usuário como null para evitar redirecionamentos
        }
      } else {
        // Native platform logic
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Session:', session);
        
        if (session?.user) {
          const userData = {
            id: session.user.id,
            email: session.user.email!,
            name: session.user.user_metadata?.name,
            phone: session.user.user_metadata?.phone,
          };
          console.log('Setting user from session:', userData);
          setUser(userData);
        } else {
          // Fallback to stored data for development
          const storedUser = await AsyncStorage.getItem('@AGTur:user');
          console.log('Stored user:', storedUser);
          if (storedUser) {
            setUser(JSON.parse(storedUser));
          }
          // Não definir usuário como null para evitar redirecionamentos
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      // Não definir usuário como null para evitar redirecionamentos
    }
  }

  async function signIn(email: string, password: string) {
    try {
      // Basic input validation
      if (!email || !password) {
        throw new Error('Email e senha são obrigatórios');
      }

      if (!email.includes('@')) {
        throw new Error('Email inválido');
      }

      if (password.length < 6) {
        throw new Error('Senha deve ter pelo menos 6 caracteres');
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Check for development mode with specific credentials
        if (__DEV__ && 
            email === 'user@agtur.local' && 
            password === 'UserTest2024!') {
          console.warn('Using development user credentials');
          const mockUser = { 
            id: 'dev-user-' + Date.now(), 
            email,
            name: 'Usuário Desenvolvimento'
          };
          setUser(mockUser);
          await AsyncStorage.setItem('@AGTur:user', JSON.stringify(mockUser));
          return;
        }
        
        // Throw the actual error for production or invalid credentials
        throw new Error(error.message || 'Credenciais inválidas');
      }

      if (data.user) {
        const userData = {
          id: data.user.id,
          email: data.user.email!,
          name: data.user.user_metadata?.name,
          phone: data.user.user_metadata?.phone,
        };
        setUser(userData);
        await AsyncStorage.setItem('@AGTur:user', JSON.stringify(userData));
      }
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  }

  async function signUp(email: string, password: string, name?: string, phone?: string) {
    try {
      // Basic input validation
      if (!email || !password) {
        throw new Error('Email e senha são obrigatórios');
      }

      if (!email.includes('@')) {
        throw new Error('Email inválido');
      }

      if (password.length < 6) {
        throw new Error('Senha deve ter pelo menos 6 caracteres');
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            phone,
          },
        },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao criar conta');
      }

      if (data.user) {
        const userData = {
          id: data.user.id,
          email: data.user.email!,
          name: data.user.user_metadata?.name || name,
          phone: data.user.user_metadata?.phone || phone,
        };
        setUser(userData);
        await AsyncStorage.setItem('@AGTur:user', JSON.stringify(userData));
      }
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  }

  async function signOut() {
    try {
      await supabase.auth.signOut();
      setUser(null);
      await AsyncStorage.removeItem('@AGTur:user');
    } catch (error) {
      console.error('Sign out error:', error);
      // Even if Supabase signOut fails, clear local state
      setUser(null);
      await AsyncStorage.removeItem('@AGTur:user');
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
