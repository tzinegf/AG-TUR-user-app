import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { userService } from '../../services/userService';
import { busRoutesService } from '../../services/busRoutes';
import { bookingsService } from '../../services/bookings';
import { seatsService, Seat } from '../../services/seats';
import { BusRoute } from '../../lib/supabase';
import { format, parseISO } from 'date-fns';
import { mask } from 'react-native-mask-text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { couponsService } from '../../services/coupons';

interface Passenger {
  name: string;
  cpf: string;
  rg: string;
  email: string;
  phone: string;
}

export default function BookingScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  
  // 🚨 DEBUG: Log básico do componente
  console.log('🎬 DEBUG: BookingScreen component loaded');
  console.log('📋 DEBUG: All params:', params);
  console.log('📋 DEBUG: All params keys:', Object.keys(params));
  console.log('📋 DEBUG: All params values:', Object.values(params));
  
  // 🔍 DEBUG: Verificar cada parâmetro individualmente
  console.log('🔍 DEBUG: params.tripId:', params.tripId);
  console.log('🔍 DEBUG: params.passengers:', params.passengers);
  console.log('🔍 DEBUG: params.from:', params.from);
  console.log('🔍 DEBUG: params.to:', params.to);
  
  // 🔍 DEBUG: Verificar se existe com nomes diferentes
  console.log('🔍 DEBUG: params keys includes tripId?', Object.keys(params).includes('tripId'));
  console.log('🔍 DEBUG: params keys includes passengers?', Object.keys(params).includes('passengers'));

  const {
    tripId,
    from,
    to,
    date,
    departureTime,
    arrivalTime,
    price,
    companyName,
    passengers,
    tripType,
    returnTripId,
  } = params;

  // Use tripId as routeId for backward compatibility
  const routeId = tripId;
  const passengerCount = passengers;
  
  console.log('🆔 DEBUG: tripId received:', tripId);
  console.log('🆔 DEBUG: tripId type:', typeof tripId);
  console.log('🆔 DEBUG: routeId (mapped from tripId):', routeId);
  console.log('🆔 DEBUG: routeId type:', typeof routeId);
  console.log('👥 DEBUG: passengers received:', passengers);
  console.log('👤 DEBUG: user:', user?.id);

  const [currentStep, setCurrentStep] = useState(1);
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const [availableSeats, setAvailableSeats] = useState<Seat[]>([]);
  const [seatLayout, setSeatLayout] = useState<{ [key: number]: Seat[] }>({});
  const [totalSeatsCount, setTotalSeatsCount] = useState<number>(0);
  const [passengerData, setPassengerData] = useState<Passenger[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'credit' | 'debit' | 'pix'>('credit');
  const [cardData, setCardData] = useState({
    number: '',
    name: '',
    expiry: '',
    cvv: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeDetails, setRouteDetails] = useState<BusRoute | null>(null);
  // Adicionados estados para a volta
  const [returnRouteDetails, setReturnRouteDetails] = useState<BusRoute | null>(null);
  const [selectedReturnSeats, setSelectedReturnSeats] = useState<Seat[]>([]);
  const [returnAvailableSeats, setReturnAvailableSeats] = useState<Seat[]>([]);
  const [returnSeatLayout, setReturnSeatLayout] = useState<{ [key: number]: Seat[] }>({});

  // Cupom de desconto - manter hooks antes de quaisquer retornos
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);

  // Helpers de formatação para consistência com results.tsx
  const formatDateSafe = (dateString?: string) => {
    try {
      if (!dateString) return '';
      const parsed = parseISO(dateString);
      if (isNaN(parsed.getTime())) return '';
      return format(parsed, 'dd/MM/yyyy');
    } catch {
      return '';
    }
  };

  const formatTimeSafe = (dateString?: string) => {
    try {
      if (!dateString) return '';
      const parsed = parseISO(dateString);
      if (isNaN(parsed.getTime())) return '';
      return format(parsed, 'HH:mm');
    } catch {
      return '';
    }
  };

  // Conversão segura para número
  const toNumber = (value: any, fallback = 0) => {
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    return Number.isFinite(n) ? n : fallback;
  };

  const calculateDuration = (departure?: string, arrival?: string) => {
    try {
      if (!departure || !arrival) return '';
      const d = parseISO(departure);
      const a = parseISO(arrival);
      if (isNaN(d.getTime()) || isNaN(a.getTime())) return '';
      const diffMs = a.getTime() - d.getTime();
      if (diffMs <= 0) return '';
      const totalMinutes = Math.floor(diffMs / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${hours}h ${minutes}min`;
    } catch {
      return '';
    }
  };

  const normalizeBusType = (busType?: string) => {
    const t = (busType || '').toLowerCase();
    if (t.includes('execut')) return 'executivo';
    if (t.includes('semi')) return 'semi-leito';
    if (t.includes('leito')) return 'leito';
    return 'convencional';
  };

  const getBusTypeLabel = (type: string) => {
    switch (type) {
      case 'executivo': return 'Executivo';
      case 'semi-leito': return 'Semi-Leito';
      case 'leito': return 'Leito';
      case 'convencional':
      default: return 'Convencional';
    }
  };

  // Formatar desconto conforme o tipo do cupom
  const formatDiscount = (discount: number, coupon?: any) => {
    if (!coupon) return formatCurrencyBRL(discount);
    
    if (coupon.type === 'percent') {
      const baseTotal = (() => {
        const passengersCountNum = parseInt(passengerCount as string) || 1;
        const priceNum = toNumber(price as string, 0);
        const isRoundTrip = (tripType as string) === 'round-trip' && !!returnTripId;
        const idaPrice = toNumber(
          routeDetails?.price ?? (isRoundTrip ? priceNum / 2 : priceNum),
          0
        );
        const voltaPrice = isRoundTrip
          ? toNumber(returnRouteDetails?.price ?? (priceNum / 2), 0)
          : 0;
        return isRoundTrip
          ? ((idaPrice + voltaPrice) * passengersCountNum)
          : (idaPrice * passengersCountNum);
      })();
      
      const percentage = baseTotal > 0 ? Math.round((discount / baseTotal) * 100) : 0;
      return `${percentage}% (${formatCurrencyBRL(discount)})`;
    }
    
    return formatCurrencyBRL(discount);
  };

  // moved helper fetch functions above useEffect to avoid undefined in effects

  useEffect(() => {
    console.log('🔄 DEBUG: useEffect triggered');
    console.log('🔄 DEBUG: routeId in useEffect:', routeId);
    console.log('🔄 DEBUG: passengerCount in useEffect:', passengerCount);
    console.log('🔄 DEBUG: user in useEffect:', user?.id);
    console.log('🔄 DEBUG: returnTripId in useEffect:', returnTripId);
    
    if (routeId) {
      console.log('✅ DEBUG: routeId exists, calling fetchRouteDetails and fetchSeats');
      fetchRouteDetails();
      fetchSeats();
    } else {
      console.log('❌ DEBUG: routeId is missing or falsy:', routeId);
    }

    if (returnTripId) {
      console.log('✅ DEBUG: returnTripId exists, calling fetchReturnRouteDetails and fetchReturnSeats');
      fetchReturnRouteDetails();
      fetchReturnSeats();
    }
    
    // Initialize passengers array based on passenger count
    const count = parseInt(passengerCount as string) || 1;
    console.log('👥 DEBUG: Passenger count:', count);
    const initialPassengers = Array.from({ length: count }, (_, index) => ({
      name: index === 0 ? (user?.name || '') : '',
      cpf: '',
      rg: '',
      email: index === 0 ? (user?.email || '') : '',
      phone: index === 0 ? (user?.phone ? mask(user.phone, '(99) 99999-9999') : '') : ''
    }));
    setPassengerData(initialPassengers);
  }, [routeId, passengerCount, user, returnTripId]);

  // Prefill from profiles if missing in auth metadata
  useEffect(() => {
    const prefillFromProfile = async () => {
      try {
        if (!user?.id) return;
        // Only if first passenger has empty name or phone
        const first = passengerData[0];
        if (first && (!first.name || !first.phone)) {
          const profile = await userService.getUserById(user.id);
          const updated = [...passengerData];
          updated[0] = {
            ...first,
            name: first.name || profile.name || '',
            phone: first.phone || (profile.phone ? mask(profile.phone, '(99) 99999-9999') : ''),
          };
          setPassengerData(updated);
        }
      } catch (e) {
        console.warn('Falha ao prefazer dados do perfil:', e);
      }
    };
    prefillFromProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Early returns for loading and error states
  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#DC2626" />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="alert-circle" size={48} color="#DC2626" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const fetchRouteDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const details = await busRoutesService.getRoute(routeId as string);
      setRouteDetails(details);
    } catch (err) {
      setError('Erro ao carregar detalhes da viagem');
      console.error('Error fetching route details:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSeats = async () => {
    try {
      setLoading(true);
      console.log('🔍 DEBUG: Fetching seats for route:', routeId);
      const seats = await seatsService.getAllSeatsForRoute(routeId as string);
      console.log('🪑 DEBUG: Raw seats data:', seats);
      console.log('🪑 DEBUG: Seats count:', seats?.length || 0);
      const layout = await seatsService.getSeatLayout(routeId as string);
      console.log('🗺️ DEBUG: Raw layout data:', layout);
      console.log('🗺️ DEBUG: Layout keys:', Object.keys(layout || {}));
      console.log('🗺️ DEBUG: Layout keys count:', Object.keys(layout || {}).length);
      const available = seats.filter(seat => seat.is_available);
      console.log('✅ DEBUG: Available seats:', available.length);
      console.log('✅ DEBUG: Available seats data:', available);
      setAvailableSeats(available);
      setSeatLayout(layout);
    } catch (err) {
      console.error('❌ DEBUG: Error fetching seats:', err);
      console.error('❌ DEBUG: Error details:', JSON.stringify(err, null, 2));
      setError('Erro ao carregar poltronas disponíveis');
    } finally {
      setLoading(false);
    }
  };

  const fetchReturnRouteDetails = async () => {
    try {
      setLoading(true);
      const details = await busRoutesService.getRoute(returnTripId as string);
      setReturnRouteDetails(details);
    } catch (err) {
      console.error('Error fetching return route details:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReturnSeats = async () => {
    try {
      setLoading(true);
      console.log('🔍 DEBUG: Fetching seats for return route:', returnTripId);
      const seats = await seatsService.getAllSeatsForRoute(returnTripId as string);
      const layout = await seatsService.getSeatLayout(returnTripId as string);
      const available = seats.filter(seat => seat.is_available);
      setReturnAvailableSeats(available);
      setReturnSeatLayout(layout);
    } catch (err) {
      console.error('❌ DEBUG: Error fetching return seats:', err);
      setError('Erro ao carregar poltronas da volta');
    } finally {
      setLoading(false);
    }
  };

  const handleSeatSelect = (seat: Seat) => {
    if (!seat.is_available) return;
    
    const maxSeats = parseInt(passengerCount as string) || 1;
    const isSelected = selectedSeats.some(s => s.id === seat.id);
    
    if (isSelected) {
      setSelectedSeats(selectedSeats.filter(s => s.id !== seat.id));
    } else if (selectedSeats.length < maxSeats) {
      setSelectedSeats([...selectedSeats, seat]);
    } else {
      Alert.alert('Limite de assentos', `Você pode selecionar no máximo ${maxSeats} assento(s).`);
    }
  };

  const handleReturnSeatSelect = (seat: Seat) => {
    if (!seat.is_available) return;

    const maxSeats = parseInt(passengerCount as string) || 1;
    const isSelected = selectedReturnSeats.some(s => s.id === seat.id);

    if (isSelected) {
      setSelectedReturnSeats(selectedReturnSeats.filter(s => s.id !== seat.id));
    } else if (selectedReturnSeats.length < maxSeats) {
      setSelectedReturnSeats([...selectedReturnSeats, seat]);
    } else {
      Alert.alert('Limite de assentos', `Você pode selecionar no máximo ${maxSeats} assento(s) para a volta.`);
    }
  };

  const handlePassengerUpdate = (index: number, field: keyof Passenger, value: string) => {
    const updatedPassengers = [...passengerData];
    updatedPassengers[index] = { ...updatedPassengers[index], [field]: value };
    setPassengerData(updatedPassengers);
  };

  const isValidRG = (rg: string) => {
    const clean = (rg || '').replace(/[^0-9A-Za-z]/g, '');
    return clean.length >= 7 && clean.length <= 13;
  };

  const validateStep = () => {
    switch (currentStep) {
      case 1:
        const requiredSeats = parseInt(passengerCount as string) || 1;
        if (selectedSeats.length !== requiredSeats) {
          Alert.alert('Seleção de assentos', `Selecione ${requiredSeats} assento(s) para a ida.`);
          return false;
        }
        if ((tripType as string) === 'round-trip' && returnTripId) {
          if (selectedReturnSeats.length !== requiredSeats) {
            Alert.alert('Seleção de assentos', `Selecione ${requiredSeats} assento(s) para a volta.`);
            return false;
          }
        }
        return true;
      
      case 2:
        for (let i = 0; i < passengerData.length; i++) {
          const passenger = passengerData[i];
          const hasCpf = !!passenger.cpf;
          const hasRg = !!passenger.rg;
          const cpfOk = hasCpf ? (passenger.cpf || '').replace(/\D/g, '').length === 11 : true;
          const rgOk = hasRg ? isValidRG(passenger.rg) : true;
      
          if (!passenger.name || !passenger.email || !passenger.phone) {
            Alert.alert('Dados incompletos', `Complete nome, email e telefone do passageiro ${i + 1}.`);
            return false;
          }
          if (!hasCpf && !hasRg) {
            Alert.alert('Documento obrigatório', `Informe pelo menos um documento (CPF ou RG) para o passageiro ${i + 1}.`);
            return false;
          }
          if (!cpfOk) {
            Alert.alert('CPF inválido', `Verifique o CPF do passageiro ${i + 1}.`);
            return false;
          }
          if (!rgOk) {
            Alert.alert('RG inválido', `Verifique o RG do passageiro ${i + 1}.`);
            return false;
          }
        }
        return true;
      
      case 3:
        if (paymentMethod !== 'pix') {
          if (!cardData.number || !cardData.name || !cardData.expiry || !cardData.cvv) {
            Alert.alert('Dados do cartão', 'Complete todos os dados do cartão.');
            return false;
          }
        }
        return true;
      
      default:
        return true;
    }
  };

  const handleNextStep = async () => {
    if (!validateStep()) return;

    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      // Process booking
      await handleBooking();
    }
  };

  const handleBooking = async () => {
    try {
      setLoading(true);
      
      const isRoundTrip = (tripType as string) === 'round-trip' && !!returnTripId;
      const passengersCount = parseInt(passengerCount as string) || 1;

      if (isRoundTrip) {
        const idaAmount = (routeDetails ? routeDetails.price : parseFloat(price as string) / 2 || 0) * passengersCount;
        const voltaAmount = (returnRouteDetails ? returnRouteDetails.price : parseFloat(price as string) / 2 || 0) * passengersCount;
        const totalBoth = idaAmount + voltaAmount;
        const ratioIda = totalBoth > 0 ? idaAmount / totalBoth : 0.5;
        const ratioVolta = 1 - ratioIda;
        const idaFinal = Math.max(0, idaAmount - discountAmount * ratioIda);
        const voltaFinal = Math.max(0, voltaAmount - discountAmount * ratioVolta);

        const idaSeatIds = selectedSeats.map(seat => seat.id);
        const voltaSeatIds = selectedReturnSeats.map(seat => seat.id);

        const idaBooking = await bookingsService.createBooking(
          routeId as string,
          idaSeatIds,
          idaFinal,
          paymentMethod,
          passengerData.map(p => ({ name: p.name, document: p.rg }))
        );

        const voltaBooking = await bookingsService.createBooking(
          returnTripId as string,
          voltaSeatIds,
          voltaFinal,
          paymentMethod,
          passengerData.map(p => ({ name: p.name, document: p.rg }))
        );

        if (couponApplied && appliedCoupon?.id && user?.id) {
          const totalBothAmount = idaAmount + voltaAmount;
          await couponsService.recordUsage({
            coupon_id: appliedCoupon.id,
            booking_id: null,
            user_id: user.id,
            amount_before: totalBothAmount,
            amount_discount: Math.min(discountAmount, totalBothAmount),
            amount_after: Math.max(0, totalBothAmount - discountAmount),
          });
        }
      } else {
        const baseAmount = routeDetails ? routeDetails.price : parseFloat(price as string);
        const totalAmount = baseAmount * passengersCount;
        const totalFinal = Math.max(0, totalAmount - discountAmount);
        const seatIds = selectedSeats.map(seat => seat.id);
        const booking = await bookingsService.createBooking(
          routeId as string,
          seatIds,
          totalFinal,
          paymentMethod,
          passengerData.map(p => ({ name: p.name, document: p.rg }))
        );

        if (couponApplied && appliedCoupon?.id && user?.id) {
          const totalAmount = (routeDetails ? routeDetails.price : parseFloat(price as string)) * passengersCount;
          await couponsService.recordUsage({
            coupon_id: appliedCoupon.id,
            booking_id: booking?.id ?? null,
            user_id: user.id,
            amount_before: totalAmount,
            amount_discount: Math.min(discountAmount, totalAmount),
            amount_after: Math.max(0, totalAmount - discountAmount),
          });
        }
      }
      
      Alert.alert(
        'Reserva confirmada!',
        isRoundTrip ? 'Suas reservas de ida e volta foram realizadas com sucesso.' : 'Sua reserva foi realizada com sucesso.',
        [{ text: 'OK', onPress: () => router.push('/(tabs)') }]
      );
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível processar sua reserva. Tente novamente.');
      console.error('Booking error:', err);
    } finally {
      setLoading(false);
    }
  };







  const applyCoupon = async () => {
    const code = (couponCode || '').trim().toUpperCase();
    const passengersCountNum = parseInt(passengerCount as string) || 1;
    const priceNum = toNumber(price as string, 0);
    const isRoundTrip = (tripType as string) === 'round-trip' && !!returnTripId;
    const idaPrice = toNumber(
      routeDetails?.price ?? (isRoundTrip ? priceNum / 2 : priceNum),
      0
    );
    const voltaPrice = isRoundTrip
      ? toNumber(returnRouteDetails?.price ?? (priceNum / 2), 0)
      : 0;
    const baseTotal = isRoundTrip ? ((idaPrice + voltaPrice) * passengersCountNum) : (idaPrice * passengersCountNum);

    setCouponError(null);
    setCouponApplied(false);
    setAppliedCoupon(null);

    const result = await couponsService.applyCoupon(code, baseTotal, { tripType: isRoundTrip ? 'round-trip' : 'one-way' });
    if (result.valid) {
      setDiscountAmount(result.discount);
      setCouponApplied(true);
      setCouponError(null);
      setAppliedCoupon(result.coupon);
      return;
    }

    let pct: number | undefined;
    if (code === 'AG20' || code === 'FIRST20') pct = 0.20;
    else if (code === 'AG10') pct = 0.10;
    if (!pct) {
      setDiscountAmount(0);
      setCouponApplied(false);
      setCouponError(result.error || 'Cupom inválido ou expirado.');
      setAppliedCoupon(null);
      return;
    }
    const discount = Math.min(baseTotal, Math.round(baseTotal * pct * 100) / 100);
    setDiscountAmount(discount);
    setCouponApplied(true);
    setCouponError(null);
    setAppliedCoupon({ type: 'percent', value: pct, code });
  };
  
  const removeCoupon = () => {
    setCouponCode('');
    setCouponApplied(false);
    setCouponError(null);
    setDiscountAmount(0);
    setAppliedCoupon(null);
  };

  const renderSeatSelection = () => (
    <ScrollView
      style={styles.stepContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      contentInset={{ bottom: insets.bottom }}
      contentContainerStyle={{ paddingBottom: 24 }}
    >
      <Text style={styles.stepTitle}>Selecione seus assentos</Text>
      <Text style={styles.stepSubtitle}>
        Escolha {passengerCount} assento(s) para sua viagem
      </Text>

      {/* Ida */}
      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 12 }}>Poltronas da ida</Text>
        <View style={styles.busLayout}>
          <View style={styles.busContainer}>
            {/* Driver */}
            <View style={styles.busDriver}>
              <Ionicons name="person" size={24} color="#6B7280" />
            </View>

            {/* Seats */}
            {Object.keys(seatLayout).length === 0 ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: '#6B7280', fontSize: 16 }}>
                  Nenhuma poltrona disponível para esta rota
                </Text>
              </View>
            ) : (
              Object.keys(seatLayout).sort((a, b) => parseInt(a) - parseInt(b)).map((rowKey) => {
                const row = seatLayout[parseInt(rowKey)];
                return (
                  <View key={rowKey} style={styles.seatRow}>
                    {row.map((seat, seatIndex) => {
                      if (seat === null) {
                        return <View key={seatIndex} style={styles.aisle} />;
                      }
                      const isSelected = selectedSeats.some(s => s.id === seat.id);
                      return (
                        <TouchableOpacity
                          key={seatIndex}
                          style={[
                            styles.seat,
                            seat.is_available ? styles.seatAvailable : styles.seatOccupied,
                            isSelected && styles.seatSelected,
                          ]}
                          onPress={() => handleSeatSelect(seat)}
                          disabled={!seat.is_available}
                        >
                          <Text style={[
                            styles.seatText,
                            isSelected && styles.seatTextSelected,
                            !seat.is_available && styles.seatTextOccupied,
                          ]}>
                            {seat.seat_number}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })
            )}
          </View>

          {/* Selected Seats Info */}
          <View style={styles.selectedSeatsInfo}>
            <Text style={styles.selectedSeatsLabel}>Poltronas da ida selecionadas</Text>
            <Text style={styles.selectedSeatsText}>
              {selectedSeats.map(s => s.seat_number).join(', ') || 'Nenhuma poltrona selecionada'}
            </Text>
          </View>
        </View>
      </View>

      {/* Volta */}
      {(tripType as string) === 'round-trip' && returnTripId && (
        <View>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 12 }}>Poltronas da volta</Text>
          <View style={styles.busLayout}>
            <View style={styles.busContainer}>
              {/* Driver */}
              <View style={styles.busDriver}>
                <Ionicons name="person" size={24} color="#6B7280" />
              </View>

              {/* Seats */}
              {Object.keys(returnSeatLayout).length === 0 ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ color: '#6B7280', fontSize: 16 }}>
                    Nenhuma poltrona disponível para esta rota de volta
                  </Text>
                </View>
              ) : (
                Object.keys(returnSeatLayout).sort((a, b) => parseInt(a) - parseInt(b)).map((rowKey) => {
                  const row = returnSeatLayout[parseInt(rowKey)];
                  return (
                    <View key={rowKey} style={styles.seatRow}>
                      {row.map((seat, seatIndex) => {
                        if (seat === null) {
                          return <View key={seatIndex} style={styles.aisle} />;
                        }
                        const isSelected = selectedReturnSeats.some(s => s.id === seat.id);
                        return (
                          <TouchableOpacity
                            key={seatIndex}
                            style={[
                              styles.seat,
                              seat.is_available ? styles.seatAvailable : styles.seatOccupied,
                              isSelected && styles.seatSelected,
                            ]}
                            onPress={() => handleReturnSeatSelect(seat)}
                            disabled={!seat.is_available}
                          >
                            <Text style={[
                              styles.seatText,
                              isSelected && styles.seatTextSelected,
                              !seat.is_available && styles.seatTextOccupied,
                            ]}>
                              {seat.seat_number}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })
              )}
            </View>

            {/* Selected Seats Info */}
            <View style={styles.selectedSeatsInfo}>
              <Text style={styles.selectedSeatsLabel}>Poltronas da volta selecionadas</Text>
              <Text style={styles.selectedSeatsText}>
                {selectedReturnSeats.map(s => s.seat_number).join(', ') || 'Nenhuma poltrona selecionada'}
              </Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );

  const renderPassengerForm = () => (
    <ScrollView
      style={styles.stepContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      contentInset={{ bottom: insets.bottom }}
      contentContainerStyle={{ paddingBottom: 24 }}
    >
      <Text style={styles.stepTitle}>Dados dos passageiros</Text>
      <Text style={styles.stepSubtitle}>
        Preencha os dados de todos os passageiros
      </Text>

      {passengerData.map((passenger, index) => (
        <View key={index} style={styles.passengerCard}>
          <View style={styles.passengerHeader}>
            <Text style={styles.passengerTitle}>Passageiro {index + 1}</Text>
            <Text style={styles.passengerSeat}>
              Assento {selectedSeats[index]?.seat_number || 'N/A'}
            </Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Nome completo *</Text>
            <TextInput
              style={styles.input}
              value={passenger.name}
              onChangeText={(text) => handlePassengerUpdate(index, 'name', text)}
              placeholder="João Silva"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>CPF (opcional)</Text>
            <TextInput
              style={styles.input}
              value={passenger.cpf}
              onChangeText={(text) => {
                const maskedCpf = mask(text, '999.999.999-99');
                handlePassengerUpdate(index, 'cpf', maskedCpf);
              }}
              placeholder="000.000.000-00"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>RG (opcional)</Text>
            <TextInput
              style={styles.input}
              value={passenger.rg}
              onChangeText={(text) => {
                const maskedRg = mask(text, '99.999.999-9');
                handlePassengerUpdate(index, 'rg', maskedRg);
              }}
              placeholder="00.000.000-0"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>E-mail *</Text>
            <TextInput
              style={styles.input}
              value={passenger.email}
              onChangeText={(text) => handlePassengerUpdate(index, 'email', text)}
              placeholder="joao@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Telefone *</Text>
            <TextInput
              style={styles.input}
              value={passenger.phone}
              onChangeText={(text) => {
                const maskedPhone = mask(text, '(99) 99999-9999');
                handlePassengerUpdate(index, 'phone', maskedPhone);
              }}
              placeholder="(11) 99999-9999"
              keyboardType="phone-pad"
            />
          </View>
        </View>
      ))}
    </ScrollView>
  );

  const renderPayment = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Pagamento</Text>
      <Text style={styles.stepSubtitle}>Escolha a forma de pagamento</Text>

      <Text style={styles.paymentMethodTitle}>Método de pagamento</Text>
      {[{ key: 'credit', label: 'Cartão de Crédito' }, { key: 'debit', label: 'Cartão de Débito' }, { key: 'pix', label: 'Pix' }].map((method) => (
        <TouchableOpacity
          key={method.key}
          style={[styles.paymentOption, paymentMethod === method.key && styles.paymentOptionActive]}
          onPress={() => setPaymentMethod(method.key as any)}
        >
          <Ionicons name={paymentMethod === method.key ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={paymentMethod === method.key ? '#DC2626' : '#6B7280'} />
          <Text style={[styles.paymentOptionText, paymentMethod === method.key && styles.paymentOptionTextActive]}>{method.label}</Text>
        </TouchableOpacity>
      ))}
      
      {paymentMethod !== 'pix' && (
        <View style={{ marginTop: 16 }}>
          <Text style={styles.paymentMethodTitle}>Dados do cartão</Text>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Número do cartão *</Text>
            <TextInput
              style={styles.input}
              value={cardData.number}
              onChangeText={(text) => setCardData({ ...cardData, number: mask(text, '9999 9999 9999 9999') })}
              placeholder="1234 5678 9012 3456"
              keyboardType="numeric"
              maxLength={19}
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Nome no cartão *</Text>
            <TextInput
              style={styles.input}
              value={cardData.name}
              onChangeText={(text) => setCardData({ ...cardData, name: text })}
              placeholder="JOAO SILVA"
              autoCapitalize="characters"
            />
          </View>
          <View style={{ flexDirection: 'row' }}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 12 }] }>
              <Text style={styles.label}>Validade (MM/AA) *</Text>
              <TextInput
                style={styles.input}
                value={cardData.expiry}
                onChangeText={(text) => setCardData({ ...cardData, expiry: mask(text, '99/99') })}
                placeholder="12/34"
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
            <View style={[styles.formGroup, { width: 100 }] }>
              <Text style={styles.label}>CVV *</Text>
              <TextInput
                style={styles.input}
                value={cardData.cvv}
                onChangeText={(text) => setCardData({ ...cardData, cvv: mask(text, '9999') })}
                placeholder="123"
                keyboardType="numeric"
                maxLength={4}
              />
            </View>
          </View>
        </View>
      )}

      {/* Cupom acima do resumo do pedido */}
      <View style={styles.couponCard}>
        <Text style={styles.couponTitle}>Cupom de desconto</Text>
        <View style={styles.couponRow}>
          <TextInput
            style={styles.couponInput}
            value={couponCode}
            onChangeText={setCouponCode}
            placeholder="Digite seu cupom"
            autoCapitalize="characters"
          />
          {couponApplied ? (
            <TouchableOpacity style={styles.couponRemoveButton} onPress={removeCoupon}>
              <Text style={styles.couponRemoveText}>Remover</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.couponApplyButton} onPress={applyCoupon}>
              <Text style={styles.couponApplyText}>Aplicar</Text>
            </TouchableOpacity>
          )}
        </View>
        {couponError ? (
          <Text style={styles.couponError}>{couponError}</Text>
        ) : null}
        {couponApplied ? (
          <Text style={styles.couponSuccess}>Cupom aplicado: - {formatDiscount(discountAmount, appliedCoupon)}</Text>
        ) : null}
      </View>

      <View style={styles.orderSummary}>
        <Text style={styles.summaryTitle}>Resumo do pedido</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Rota</Text>
          <Text style={styles.summaryValue}>{from} → {to}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Data</Text>
          <Text style={styles.summaryValue}>{formatDateSafe(date as string)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Passageiros</Text>
          <Text style={styles.summaryValue}>{passengerCount}</Text>
        </View>
        <View style={styles.summaryTotal}>
          <Text style={styles.summaryTotalLabel}>Total</Text>
          <Text style={styles.summaryTotalValue}>{(() => { const passengersCountNum = parseInt(passengerCount as string) || 1; const idaPrice = toNumber(routeDetails?.price ?? parseFloat(price as string)); const isRoundTrip = (tripType as string) === 'round-trip' && !!returnTripId; const voltaPrice = isRoundTrip ? toNumber(returnRouteDetails?.price ?? idaPrice) : 0; const baseTotal = isRoundTrip ? ((idaPrice + voltaPrice) * passengersCountNum) : (idaPrice * passengersCountNum); const finalTotal = Math.max(0, baseTotal - (Number.isFinite(discountAmount) ? discountAmount : 0)); return formatCurrencyBRL(finalTotal); })()}</Text>
        </View>
        {couponApplied ? (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Cupom</Text>
            <Text style={[styles.summaryValue, { color: '#10B981' }]}>- {formatDiscount(discountAmount, appliedCoupon)}</Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#DC2626", "#B91C1C"]} style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Finalizar agendamento</Text>
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      {/* Progress steps */}
      <View style={styles.progressContainer}>
        <View style={styles.progressStep}>
          <View style={[styles.progressCircle, currentStep >= 1 && styles.progressCircleActive]}>
            <Text style={[styles.progressNumber, currentStep >= 1 && styles.progressNumberActive]}>1</Text>
          </View>
          <Text style={styles.progressLabel}>Poltronas</Text>
        </View>
        <View style={[styles.progressLine, currentStep >= 2 && styles.progressLineActive]} />
        <View style={styles.progressStep}>
          <View style={[styles.progressCircle, currentStep >= 2 && styles.progressCircleActive]}>
            <Text style={[styles.progressNumber, currentStep >= 2 && styles.progressNumberActive]}>2</Text>
          </View>
          <Text style={styles.progressLabel}>Passageiros</Text>
        </View>
        <View style={[styles.progressLine, currentStep >= 3 && styles.progressLineActive]} />
        <View style={styles.progressStep}>
          <View style={[styles.progressCircle, currentStep >= 3 && styles.progressCircleActive]}>
            <Text style={[styles.progressNumber, currentStep >= 3 && styles.progressNumberActive]}>3</Text>
          </View>
          <Text style={styles.progressLabel}>Pagamento</Text>
        </View>
      </View>

      {/* Steps content */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {currentStep === 1 && renderSeatSelection()}
        {currentStep === 2 && renderPassengerForm()}
        {currentStep === 3 && renderPayment()}
      </KeyboardAvoidingView>

      {/* Bottom actions */}
      <SafeAreaView edges={['bottom']} style={styles.bottomActions}>
        {currentStep > 1 && (
          <TouchableOpacity style={styles.backStepButton} onPress={() => setCurrentStep(currentStep - 1)}>
            <Ionicons name="arrow-back" size={20} color="#6B7280" />
            <Text style={styles.backStepText}>Voltar etapa</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.nextButton, currentStep === 1 && styles.nextButtonFull]} onPress={handleNextStep}>
          <Text style={styles.nextButtonText}>{currentStep < 3 ? 'Continuar' : 'Confirmar reserva'}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 40,
    backgroundColor: '#FFFFFF',
  },
  progressStep: {
    alignItems: 'center',
  },
  progressCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  progressCircleActive: {
    backgroundColor: '#DC2626',
  },
  progressNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#9CA3AF',
  },
  progressNumberActive: {
    color: '#FFFFFF',
  },
  progressLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
    marginBottom: 24,
  },
  progressLineActive: {
    backgroundColor: '#DC2626',
  },
  stepContent: {
    flex: 1,
    padding: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24,
  },
  seatLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 24,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendSeat: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  legendText: {
    fontSize: 12,
    color: '#6B7280',
  },
  busLayout: {
    flex: 1,
  },
  busContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  busDriver: {
    width: 60,
    height: 60,
    backgroundColor: '#F3F4F6',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  seatRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  seat: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  seatAvailable: {
    backgroundColor: '#FFFFFF',
  },
  seatSelected: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  seatOccupied: {
    backgroundColor: '#E5E7EB',
    borderColor: '#9CA3AF',
  },
  seatText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  seatTextSelected: {
    color: '#FFFFFF',
  },
  seatTextOccupied: {
    color: '#9CA3AF',
  },
  aisle: {
    width: 20,
  },
  selectedSeatsInfo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  selectedSeatsLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  selectedSeatsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  passengerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  passengerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  passengerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  passengerSeat: {
    fontSize: 14,
    color: '#DC2937',
    fontWeight: '600',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  formRow: {
    flexDirection: 'row',
  },
  orderSummary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 8,
    paddingTop: 16,
  },
  summaryTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  summaryTotalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  paymentMethodTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  paymentOptionActive: {
    borderColor: '#DC2626',
  },
  paymentOptionText: {
    fontSize: 16,
    color: '#6B7280',
    marginLeft: 12,
  },
  paymentOptionTextActive: {
    color: '#DC2626',
    fontWeight: '600',
  },
  // Cupom - estilos mais visíveis
  couponCard: {
    backgroundColor: '#FFF5F5',
    borderWidth: 2,
    borderColor: '#DC2626',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  couponTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#B91C1C',
    marginBottom: 12,
  },
  couponRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  couponInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#DC2626',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  couponApplyButton: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  couponApplyText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  couponRemoveButton: {
    borderWidth: 2,
    borderColor: '#DC2626',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  couponRemoveText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '700',
  },
  couponError: {
    marginTop: 10,
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },
  couponSuccess: {
    marginTop: 10,
    color: '#10B981',
    fontSize: 14,
    fontWeight: '600',
  },
  cardForm: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
  },
  pixInstructions: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  pixText: {
    flex: 1,
    fontSize: 14,
    color: '#1E40AF',
    marginLeft: 12,
  },
  bottomActions: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  backStepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  backStepText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 8,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  nextButtonFull: {
    flex: 1,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#DC2626',
    textAlign: 'center',
    marginVertical: 16,
  },
  retryButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

// Formatação monetária consistente (pt-BR)
 const formatCurrencyBRL = (value?: number) => {
   try {
     const base = typeof value === 'number' ? value : parseFloat(String(value));
     const v = Number.isFinite(base) ? base : 0;
     return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
   } catch {
     const v = typeof value === 'number' && Number.isFinite(value) ? value : 0;
     return `R$ ${v.toFixed(2)}`;
   }
 };
