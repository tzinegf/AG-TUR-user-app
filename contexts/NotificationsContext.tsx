import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { registerForPushNotificationsAsync } from '../services/notifications';

interface NotificationContextData {
  pushToken: string | null;
  lastNotification: Notifications.Notification | null;
  ready: boolean;
  testLocalNotification: (title?: string, body?: string, data?: Record<string, any>) => Promise<void>;
}

const NotificationsContext = createContext<NotificationContextData | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [lastNotification, setLastNotification] = useState<Notifications.Notification | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let receiveSub: Notifications.Subscription | undefined;
    let responseSub: Notifications.Subscription | undefined;

    async function init() {
      try {
        // Solicitar permissão e obter token (somente em dispositivos físicos)
        if (Platform.OS !== 'web') {
          const token = await registerForPushNotificationsAsync();
          if (token) {
            setPushToken(token);
            // Opcional: salvar token no backend futuramente
          }
        }

        // Listener: app recebeu uma notificação (foreground)
        receiveSub = Notifications.addNotificationReceivedListener((notification) => {
          try {
            setLastNotification(notification);
            const title = notification.request.content.title || 'Notificação';
            const body = notification.request.content.body || '';
            Alert.alert(title, body);
          } catch { /* no-op */ }
        });

        // Listener: usuário interagiu com a notificação (tap)
        responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
          try {
            const data = response.notification.request.content.data || {};
            const tripId = String((data as any).tripId || '');
            if (tripId) {
              // Navegar para detalhes/checkout da viagem
              router.push({ pathname: '/search/booking', params: { tripId, passengers: '1' } });
            } else {
              // Abre tickets por padrão
              router.push('/(tabs)/tickets');
            }
          } catch { /* no-op */ }
        });
      } finally {
        setReady(true);
      }
    }

    init();

    return () => {
      receiveSub?.remove?.();
      responseSub?.remove?.();
    };
  }, [router]);

  const testLocalNotification = useMemo(() => {
    return async (title?: string, body?: string, data?: Record<string, any>) => {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: title || 'Teste de Notificação',
          body: body || 'Esta é uma notificação local de teste.',
          data: data || {},
        },
        trigger: null, // imediata
      });
    };
  }, []);

  const value: NotificationContextData = {
    pushToken,
    lastNotification,
    ready,
    testLocalNotification,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}