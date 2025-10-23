import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { bookingsService } from '../../services/bookings';
import { busService } from '../../services/busService';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Colors } from '../../constants/Colors';
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Linking from 'expo-linking';

export default function TicketsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [busInfoMap, setBusInfoMap] = useState<Record<string, { model?: string; plate?: string; type?: string }>>({});
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

  const handleProceedPayment = useCallback((ticket: any) => {
    try {
      const routeId = (ticket?.tripId || ticket?.route_id || ticket?.routeId || null);
      const seatsStr = (ticket?.seat || '').toString();
      const passengers = seatsStr ? seatsStr.split(',').map((s: string) => s.trim()).filter(Boolean).length : 1;
      if (!routeId) {
        Alert.alert('Pagamento', 'Não foi possível identificar a viagem para pagamento.');
        return;
      }
      router.push({
        pathname: '/search/booking',
        params: { tripId: String(routeId), passengers: String(passengers) }
      });
    } catch (e: any) {
      console.error('Erro ao prosseguir com pagamento:', e);
      Alert.alert('Erro', e?.message || 'Falha ao abrir a tela de pagamento');
    }
  }, [router]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  useEffect(() => {
    const loadBusInfo = async () => {
      try {
        const entries = await Promise.all(
          (bookings || []).map(async (b: any) => {
            try {
              const route = (b as any).route || {};
              const busId = route?.bus_id;
              const routeId = route?.id || b?.route_id || b?.id;
              if (!busId || !routeId) return [routeId || b?.id || Math.random().toString(), null] as [string, { model?: string; plate?: string; type?: string } | null];
              const bus = await busService.getBusById(busId);
              return [routeId, bus ? { model: bus.model, plate: bus.plate, type: bus.type } : null];
            } catch (e) {
              console.error('Erro ao buscar informações do ônibus para uma reserva', e);
              return [((b as any)?.route?.id || b?.route_id || b?.id || Math.random().toString()), null] as [string, { model?: string; plate?: string; type?: string } | null];
            }
          })
        );
        const map = Object.fromEntries(entries.filter(([key]) => !!key));
        setBusInfoMap(map);
      } catch (error) {
        console.error('Erro ao carregar informações de veículo:', error);
      }
    };
    loadBusInfo();
  }, [bookings]);

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

    (bookings || []).forEach((b: any) => {
      const route = (b as any).route || {};
      const departureRaw = (route?.departure_datetime as string | undefined) ?? (route?.departure_time as string | undefined);
      const parsedDeparture = departureRaw ? new Date(departureRaw) : null;
      const departure: Date | null = (parsedDeparture && !isNaN(parsedDeparture.getTime())) ? parsedDeparture : null;
      const arrivalRaw = (route?.arrival_datetime as string | undefined) ?? (route?.arrival_time as string | undefined);
      const parsedArrival = arrivalRaw ? new Date(arrivalRaw) : null;
      let durationLabel = '—';
      if (parsedDeparture && parsedArrival && !isNaN(parsedDeparture.getTime()) && !isNaN(parsedArrival.getTime())) {
        const totalMinutes = Math.max(0, Math.round((parsedArrival.getTime() - parsedDeparture.getTime()) / 60000));
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        durationLabel = h > 0 ? `${h}h ${m}min` : `${m}min`;
      }
      const capacityLabel = (typeof route?.available_seats === 'number' && typeof route?.total_seats === 'number')
        ? `${route.available_seats}/${route.total_seats}`
        : '';
      const routeId = route?.id || b?.route_id;
      const plateLabel = (routeId && busInfoMap[routeId]?.plate) ? (busInfoMap[routeId]?.plate as string) : (route?.bus_plate || '');
      const parsedCreated = b?.created_at ? new Date(b.created_at) : null;
      const createdAt: Date | null = (parsedCreated && !isNaN(parsedCreated.getTime())) ? parsedCreated : null;
      const isCancelled = b.status === 'cancelled' || b.payment_status === 'refunded';
      const isCompleted = b.payment_status === 'completed' || b.payment_status === 'paid' || b.status === 'used' || b.status === 'completed';
      const isPast = departure ? (departure < now || isCompleted || isCancelled) : (isCompleted || isCancelled);
      const safeDate: Date = departure || createdAt || now;
      // [REMOVIDO] definição de handleProceedPayment aqui para seguir regras de hooks
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
            : ((b.payment_status === 'completed' || b.payment_status === 'paid')
              ? 'completed'
              : (b.payment_status === 'refunded' ? 'cancelled' : 'confirmed'))),
        busNumber: route?.bus_company || '',
        platform: route?.bus_type || '',
        duration: durationLabel,
        plate: plateLabel || '',
        capacity: capacityLabel,
        qr_code: b.qr_code,
        canDownloadShare: false,
        route_id: routeId,
        tripId: routeId,
      };

      // Normalizar status e definir flag para exibir ações de download/compartilhar
      ticket.canDownloadShare = ((ticket.status ?? '').toString().toLowerCase().trim() === 'confirmed') ||
                                ((ticket.status ?? '').toString().toLowerCase().trim() === 'completed');

      if (isPast) past.push(ticket);
      else upcoming.push(ticket);
    });

    // Ordenar: próximas por data ascendente; histórico por data descendente
    upcoming.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    past.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Filtrar próximas apenas com status agendado (pendente ou confirmado)
    const upcomingScheduled = upcoming.filter((t) => t.status === 'pending' || t.status === 'confirmed');

    return { upcoming: upcomingScheduled, past };
  }, [bookings, busInfoMap]);

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

  // Gera o HTML do ticket para PDF
  const buildTicketHTML = (ticket: any) => {
    const qrData = encodeURIComponent(ticket.qr_code || `AG-TUR-${ticket.id}-${ticket.date}-${ticket.seat}`);
    const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${qrData}`;
    const statusLabel = ticket.status === 'confirmed' 
      ? 'Confirmado' 
      : ticket.status === 'completed' 
        ? 'Concluído' 
        : ticket.status === 'pending' 
          ? 'Pendente' 
          : 'Cancelado';

    return `
    <!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Ticket AG-TUR</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif; margin: 0; padding: 24px; background: #F9FAFB; color: #111827; }
        .card { max-width: 800px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; box-shadow: 0 6px 18px rgba(0,0,0,0.08); overflow: hidden; }
        .header { background: linear-gradient(90deg, #DC2626, #B91C1C); padding: 20px; color: white; display: flex; justify-content: space-between; align-items: center; }
        .route { display: flex; align-items: center; gap: 12px; font-weight: 700; font-size: 18px; }
        .status { padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; background: rgba(255,255,255,0.2); }
        .body { display: flex; gap: 24px; padding: 20px; }
        .details { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .label { font-size: 12px; color: #6B7280; font-weight: 500; }
        .value { font-size: 14px; color: #1F2937; font-weight: 600; }
        .qr { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
        .footer { padding: 16px 20px; border-top: 1px solid #E5E7EB; font-size: 12px; color: #6B7280; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div class="route">
            <span>${ticket.from}</span>
            <span style="opacity:0.85">→</span>
            <span>${ticket.to}</span>
          </div>
          <div class="status">${statusLabel}</div>
        </div>
        <div class="body">
          <div class="details">
            <div>
              <div class="label">Data</div>
              <div class="value">${formatDate(ticket.date)}</div>
            </div>
            <div>
              <div class="label">Horário</div>
              <div class="value">${ticket.time || '—'}</div>
            </div>
            <div>
              <div class="label">Empresa</div>
              <div class="value">${ticket.busNumber || '—'}</div>
            </div>
            <div>
              <div class="label">Tipo</div>
              <div class="value">${ticket.platform || '—'}</div>
            </div>
            <div>
              <div class="label">Placa</div>
              <div class="value">${ticket.plate || '—'}</div>
            </div>
            <div>
              <div class="label">Duração</div>
              <div class="value">${ticket.duration || '—'}</div>
            </div>
            <div>
              <div class="label">Assento</div>
              <div class="value">${ticket.seat || '—'}</div>
            </div>
            <div>
              <div class="label">Valor</div>
              <div class="value">${ticket.price || '—'}</div>
            </div>
          </div>
          <div class="qr">
            <img src="${qrImg}" alt="QR Code" width="180" height="180" />
            <div style="font-size:10px;color:#6B7280;text-align:center">Apresente este código</div>
          </div>
        </div>
        <div class="footer">Gerado por AG-TUR • Ticket #${ticket.id}</div>
      </div>
    </body>
    </html>
    `;
  };

  const generateTicketPDF = async (ticket: any, shareInstead?: boolean) => {
    try {
      const statusNorm = (ticket?.status ?? '').toString().toLowerCase().trim();
      const payStatusNorm = (ticket?.payment_status ?? '').toString().toLowerCase().trim();
      if (statusNorm === 'pending' || payStatusNorm === 'pending') {
        Alert.alert('Pagamento pendente', 'Finalize o pagamento para baixar ou compartilhar o ticket.');
        return;
      }
      const html = buildTicketHTML(ticket);

      if (Platform.OS === 'web') {
        try {
          const blob = new Blob([html], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `ticket-${ticket.id}.html`;
          link.click();
          URL.revokeObjectURL(url);
        } catch (e) {
          Alert.alert('Download no navegador', 'Se o download não iniciar, use a versão móvel para gerar o PDF.');
        }
        return;
      }

      const file = await Print.printToFileAsync({ html });
      const filename = `ticket-${ticket.id}.pdf`;

      if (shareInstead) {
        await shareAsync(file.uri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf' });
        return;
      }

      // Android: tentar salvar em diretório escolhido via SAF
      if (Platform.OS === 'android' && (FileSystem as any).StorageAccessFramework) {
        try {
          const permissions = await (FileSystem as any).StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (permissions?.granted && permissions.directoryUri) {
            const destUri = await (FileSystem as any).StorageAccessFramework.createFileAsync(
              permissions.directoryUri,
              filename,
              'application/pdf'
            );
            const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: 'base64' });
            await FileSystem.writeAsStringAsync(destUri, base64, { encoding: 'base64' });

            Alert.alert('PDF salvo', 'Arquivo salvo na pasta escolhida.', [
              { text: 'OK' },
              { text: 'Abrir', onPress: () => shareAsync(destUri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf' }) },
            ]);
            return;
          }
        } catch (e) {
          console.warn('SAF falhou, salvando em diretório local', e);
        }
      }

      // Fallback: salvar localmente em documentDirectory ou cacheDirectory
      const destBaseDir: string | null = ((FileSystem as any).documentDirectory ?? (FileSystem as any).cacheDirectory) ?? null;
      const destUri = (destBaseDir ? destBaseDir : file.uri) + filename;

      try {
        if (destBaseDir) {
          await FileSystem.copyAsync({ from: file.uri, to: destUri });
        }
        Alert.alert(
          destBaseDir ? 'PDF salvo' : 'PDF gerado',
          destBaseDir ? 'Seu ticket foi salvo nos arquivos do app.' : 'Use "Abrir" para salvar/compartilhar.',
          [
            { text: 'OK', style: 'default' },
            { text: 'Abrir', onPress: () => shareAsync(destBaseDir ? destUri : file.uri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf' }) },
          ]
        );
      } catch (copyErr) {
        console.warn('Falha ao salvar cópia local do PDF, oferecendo compartilhamento.', copyErr);
        Alert.alert('PDF gerado', 'Use "Abrir" para salvar/compartilhar.', [
          { text: 'OK' },
          { text: 'Abrir', onPress: () => shareAsync(file.uri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf' }) },
        ]);
      }
    } catch (err: any) {
      console.error('Erro ao gerar/salvar PDF do ticket:', err);
      Alert.alert('Erro', err?.message || 'Não foi possível gerar/salvar o PDF do ticket.');
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
              <Ionicons name="business" size={16} color="#6B7280" />
              <Text style={styles.detailLabel}>Empresa</Text>
              <Text style={styles.detailValue}>{ticket.busNumber}</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="bus" size={16} color="#6B7280" />
              <Text style={styles.detailLabel}>Tipo</Text>
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

          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Ionicons name="time" size={16} color="#6B7280" />
              <Text style={styles.detailLabel}>Duração</Text>
              <Text style={styles.detailValue}>{ticket.duration || '—'}</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="barcode" size={16} color="#6B7280" />
              <Text style={styles.detailLabel}>Placa</Text>
              <Text style={styles.detailValue}>{ticket.plate || '—'}</Text>
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
        {ticket.canDownloadShare && (
          <>
            <TouchableOpacity style={styles.actionButton} onPress={() => generateTicketPDF(ticket, false)}>
              <Ionicons name="download" size={20} color="#DC2626" />
              <Text style={styles.actionButtonText}>Baixar PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => generateTicketPDF(ticket, true)}>
              <Ionicons name="share" size={20} color="#DC2626" />
              <Text style={styles.actionButtonText}>Compartilhar</Text>
            </TouchableOpacity>
          </>
        )}
        {(ticket.status === 'confirmed' || ticket.status === 'pending') && (
          <TouchableOpacity style={styles.actionButton} onPress={() => handleCancel(ticket)}>
            <Ionicons name="close-circle" size={20} color="#DC2626" />
            <Text style={styles.actionButtonText}>Cancelar</Text>
          </TouchableOpacity>
        )}
        {((ticket?.status ?? '').toString().toLowerCase().trim() === 'pending') && (
          <TouchableOpacity style={styles.actionButton} onPress={() => handleProceedPayment(ticket)}>
            <Ionicons name="card" size={20} color="#DC2626" />
            <Text style={styles.actionButtonText}>Prosseguir Pagamento</Text>
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
          <View style={{ height: 48 }} />
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
