import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { bookingsService } from '../../services/bookings';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Colors } from '../../constants/Colors';

export default function TicketsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const router = useRouter();

  const loadBookings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await bookingsService.getUserBookings();
      setBookings(data || []);
    } catch (err: any) {
      console.error('Erro ao carregar reservas:', err);
      setError(err?.message || 'Não foi possível carregar suas passagens');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const formatCurrency = (value?: number) => {
    if (typeof value !== 'number') return '-';
    try {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    } catch {
      return `R$ ${value.toFixed(2)}`;
    }
  };

  const splitByTime = useMemo(() => {
    const now = new Date();
    const upcoming: any[] = [];
    const past: any[] = [];

    (bookings || []).forEach((b) => {
      const route = (b as any).route || {};
      const departureRaw = route?.departure_time || (route as any)?.departure;
      const parsedDeparture = departureRaw ? new Date(departureRaw as string) : null;
      const departure: Date | null = (parsedDeparture && !isNaN(parsedDeparture.getTime())) ? parsedDeparture : null;
      const parsedCreated = b?.created_at ? new Date(b.created_at) : null;
      const createdAt: Date | null = (parsedCreated && !isNaN(parsedCreated.getTime())) ? parsedCreated : null;
      const isCancelled = b.status === 'cancelled';
      const isCompleted = b.payment_status === 'completed' || b.status === 'used' || b.status === 'completed';
      const isPast = departure ? (departure < now || isCompleted || isCancelled) : (isCompleted || isCancelled);
      const safeDate: Date = departure || createdAt || now;
      const ticket = {
        id: b.id,
        from: route?.origin || 'Origem',
        to: route?.destination || 'Destino',
        date: safeDate.toISOString(),
        time: departure ? departure.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
        seat: Array.isArray((b as any).seats)
          ? (b as any).seats.join(', ')
          : Array.isArray((b as any).seat_numbers)
            ? (b as any).seat_numbers.join(', ')
            : (b as any).seat_number || '-',
        price: formatCurrency(b.total_price),
        status: isCancelled
          ? 'cancelled'
          : (b.payment_status === 'pending' || b.status === 'active'
            ? 'pending'
            : (b.payment_status === 'completed' ? 'completed' : 'confirmed')),
        busNumber: route?.bus_id || '',
        platform: route?.platform || '',
        qr_code: b.qr_code,
      };

      if (isPast) past.push(ticket);
      else upcoming.push(ticket);
    });

    // Ordenar: próximas por data ascendente; histórico por data descendente
    upcoming.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    past.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Filtrar próximas apenas com status agendado (pendente ou confirmado)
    const upcomingScheduled = upcoming.filter((t) => t.status === 'pending' || t.status === 'confirmed');

    return { upcoming: upcomingScheduled, past };
  }, [bookings]);

  const formatDate = (value: string | Date | undefined) => {
    if (!value) return '—';
    const d = typeof value === 'string' ? new Date(value) : value;
    const time = d.getTime();
    if (isNaN(time)) return '—';
    try {
      return d.toLocaleDateString('pt-BR');
    } catch {
      return '—';
    }
  };

  const handleCancel = async (ticket: any) => {
    try {
      Alert.alert('Cancelar passagem', 'Tem certeza que deseja cancelar esta passagem?', [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim',
          style: 'destructive',
          onPress: async () => {
            try {
              await bookingsService.cancelBooking(ticket.id);
              await loadBookings();
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Não foi possível cancelar a passagem');
            }
          },
        },
      ]);
    } catch {}
  };

  const renderTicket = (ticket: any) => (
    <View key={ticket.id} style={styles.ticketCard}>
      <LinearGradient
        colors={['#DC2626', '#B91C1C']}
        style={styles.ticketHeader}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.routeInfo}>
          <Text style={styles.cityText}>{ticket.from}</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          <Text style={styles.cityText}>{ticket.to}</Text>
        </View>
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, 
            ticket.status === 'confirmed' && styles.confirmedBadge,
            ticket.status === 'completed' && styles.completedBadge,
            ticket.status === 'pending' && styles.pendingBadge,
          ]}>
            <Text style={styles.statusText}>
              {ticket.status === 'confirmed' 
                ? 'Confirmado' 
                : ticket.status === 'completed' 
                  ? 'Concluído' 
                  : ticket.status === 'pending' 
                    ? 'Pendente' 
                    : 'Cancelado'}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.ticketBody}>
        <View style={styles.ticketDetails}>
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Ionicons name="calendar" size={16} color="#6B7280" />
              <Text style={styles.detailLabel}>Data</Text>
              <Text style={styles.detailValue}>{formatDate(ticket.date)}</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="time" size={16} color="#6B7280" />
              <Text style={styles.detailLabel}>Horário</Text>
              <Text style={styles.detailValue}>{ticket.time}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Ionicons name="car" size={16} color="#6B7280" />
              <Text style={styles.detailLabel}>Ônibus</Text>
              <Text style={styles.detailValue}>{ticket.busNumber}</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="location" size={16} color="#6B7280" />
              <Text style={styles.detailLabel}>Plataforma</Text>
              <Text style={styles.detailValue}>{ticket.platform}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Ionicons name="person" size={16} color="#6B7280" />
              <Text style={styles.detailLabel}>Assento</Text>
              <Text style={styles.detailValue}>{ticket.seat}</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="card" size={16} color="#6B7280" />
              <Text style={styles.detailLabel}>Valor</Text>
              <Text style={styles.detailValue}>{ticket.price}</Text>
            </View>
          </View>
        </View>

        {ticket.status === 'completed' && (
          <View style={styles.qrCodeContainer}>
            <QRCode
              value={ticket.qr_code || `AG-TUR-${ticket.id}-${ticket.date}-${ticket.seat}`}
              size={80}
              color="#1F2937"
              backgroundColor="#FFFFFF"
            />
            <Text style={styles.qrCodeText}>Apresente este código</Text>
          </View>
        )}
      </View>

      <View style={styles.ticketActions}>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="download" size={20} color="#DC2626" />
          <Text style={styles.actionButtonText}>Baixar PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => {}}>
          <Ionicons name="share" size={20} color="#DC2626" />
          <Text style={styles.actionButtonText}>Compartilhar</Text>
        </TouchableOpacity>
        {(ticket.status === 'confirmed' || ticket.status === 'pending') && (
          <TouchableOpacity style={styles.actionButton} onPress={() => handleCancel(ticket)}>
            <Ionicons name="close-circle" size={20} color="#DC2626" />
            <Text style={styles.actionButtonText}>Cancelar</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#DC2626', '#B91C1C']}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Text style={styles.headerTitle}>Minhas Passagens</Text>
        <Text style={styles.headerSubtitle}>Gerencie suas viagens</Text>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>
            Próximas Viagens
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'past' && styles.activeTab]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.activeTabText]}>
            Histórico
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={[styles.content, { alignItems: 'center' }]}>
          <ActivityIndicator size="large" color="#DC2626" />
          <Text style={{ marginTop: 12, color: '#6B7280' }}>Carregando suas passagens...</Text>
        </View>
      ) : error ? (
        <View style={styles.content}>
          <View style={styles.emptyState}>
            <Ionicons name="warning-outline" size={64} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>Algo deu errado</Text>
            <Text style={styles.emptySubtitle}>{error}</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={loadBookings}>
              <Text style={styles.emptyButtonText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {activeTab === 'upcoming' ? (
            splitByTime.upcoming.length > 0 ? (
              splitByTime.upcoming.map(renderTicket)
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="ticket-outline" size={64} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>Nenhuma viagem agendada</Text>
                <Text style={styles.emptySubtitle}>
                  Que tal planejar sua próxima aventura?
                </Text>
                <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/(tabs)/search') }>
                  <Text style={styles.emptyButtonText}>Buscar Passagens</Text>
                </TouchableOpacity>
              </View>
            )
          ) : (
            splitByTime.past.length > 0 ? (
              splitByTime.past.map(renderTicket)
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="time-outline" size={64} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>Nenhuma viagem anterior</Text>
                <Text style={styles.emptySubtitle}>
                  Suas viagens passadas aparecerão aqui
                </Text>
              </View>
            )
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#DC2626',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#DC2626',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  ticketCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  ticketHeader: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cityText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  confirmedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  completedBadge: {
    backgroundColor: 'rgba(107, 114, 128, 0.2)',
  },
  pendingBadge: {
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  ticketBody: {
    padding: 20,
    flexDirection: 'row',
    gap: 20,
  },
  ticketDetails: {
    flex: 1,
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    gap: 20,
  },
  detailItem: {
    flex: 1,
    gap: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
  },
  qrCodeContainer: {
    alignItems: 'center',
    gap: 8,
  },
  qrCodeText: {
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
  },
  ticketActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 8,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
