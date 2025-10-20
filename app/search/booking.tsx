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
    tripId,  // 🔧 Mudança: usar tripId em vez de routeId
    from, 
    to, 
    date, 
    departureTime, 
    arrivalTime, 
    price, 
    companyName, 
    passengers  // 🔧 Mudança: usar passengers em vez de passengerCount
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

  useEffect(() => {
    console.log('🔄 DEBUG: useEffect triggered');
    console.log('🔄 DEBUG: routeId in useEffect:', routeId);
    console.log('🔄 DEBUG: passengerCount in useEffect:', passengerCount);
    console.log('🔄 DEBUG: user in useEffect:', user?.id);
    
    if (routeId) {
      console.log('✅ DEBUG: routeId exists, calling fetchRouteDetails and fetchSeats');
      fetchRouteDetails();
      fetchSeats();
    } else {
      console.log('❌ DEBUG: routeId is missing or falsy:', routeId);
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
  }, [routeId, passengerCount, user]);

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
      
      // Debug individual seat data
      if (seats && seats.length > 0) {
        console.log('🪑 DEBUG: First seat example:', seats[0]);
        console.log('🪑 DEBUG: Seat properties:', Object.keys(seats[0]));
      }
      
      // Debug layout structure
      if (layout && Object.keys(layout).length > 0) {
        const firstRowKey = Object.keys(layout)[0];
        console.log('🗺️ DEBUG: First row key:', firstRowKey);
        console.log('🗺️ DEBUG: First row data:', (layout as any)[firstRowKey]);
      }
      
      setAvailableSeats(available);
      setSeatLayout(layout);
      
      console.log('🎯 DEBUG: State updated - availableSeats:', available.length);
      console.log('🎯 DEBUG: State updated - seatLayout keys:', Object.keys(layout || {}).length);
      
    } catch (err) {
      console.error('❌ DEBUG: Error fetching seats:', err);
      console.error('❌ DEBUG: Error details:', JSON.stringify(err, null, 2));
      setError('Erro ao carregar poltronas disponíveis');
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
          Alert.alert('Seleção de assentos', `Selecione ${requiredSeats} assento(s) para continuar.`);
          return false;
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
      
      const totalAmount = (routeDetails ? routeDetails.price : parseFloat(price as string)) * parseInt(passengerCount as string);
      
      // Extrair apenas os IDs das poltronas selecionadas
      const seatIds = selectedSeats.map(seat => seat.id);
      
      await bookingsService.createBooking(
        routeId as string,
        seatIds,
        totalAmount,
        paymentMethod,
        passengerData.map(p => ({ name: p.name, document: p.rg }))
      );
      
      Alert.alert(
        'Reserva confirmada!',
        'Sua reserva foi realizada com sucesso.',
        [{ text: 'OK', onPress: () => router.push('/(tabs)') }]
      );
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível processar sua reserva. Tente novamente.');
      console.error('Booking error:', err);
    } finally {
      setLoading(false);
    }
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

      {/* Seat Legend */}
      <View style={styles.seatLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSeat, styles.seatAvailable]} />
          <Text style={styles.legendText}>Disponível</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSeat, styles.seatSelected]} />
          <Text style={styles.legendText}>Selecionado</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSeat, styles.seatOccupied]} />
          <Text style={styles.legendText}>Ocupado</Text>
        </View>
      </View>

      {/* Bus Layout */}
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

                    const isOccupied = !seat.is_available;
                    const isSelected = selectedSeats.some(s => s.id === seat.id);

                    return (
                      <TouchableOpacity
                        key={seat.id}
                        style={[
                          styles.seat,
                          isOccupied && styles.seatOccupied,
                          isSelected && styles.seatSelected,
                          !isOccupied && !isSelected && styles.seatAvailable
                        ]}
                        onPress={() => handleSeatSelect(seat)}
                        disabled={isOccupied}
                      >
                        <Text style={[
                          styles.seatText,
                          isOccupied && styles.seatTextOccupied,
                          isSelected && styles.seatTextSelected
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
        {selectedSeats.length > 0 && (
          <View style={styles.selectedSeatsInfo}>
            <Text style={styles.selectedSeatsLabel}>Assentos selecionados:</Text>
            <Text style={styles.selectedSeatsText}>
              {selectedSeats.map(seat => seat.seat_number).join(', ')}
            </Text>
          </View>
        )}
      </View>
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

  // Show loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#DC2626" />
        <Text style={styles.loadingText}>Carregando detalhes da viagem...</Text>
      </View>
    );
  }

  // Show error state
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#DC2626" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchRouteDetails}>
          <Text style={styles.retryButtonText}>Tentar Novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderPayment = () => (
    <ScrollView
      style={styles.stepContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      contentInset={{ bottom: insets.bottom }}
      contentContainerStyle={{ paddingBottom: 24 }}
    >
      <Text style={styles.stepTitle}>Pagamento</Text>
      
      {/* Order Summary */}
      <View style={styles.orderSummary}>
        <Text style={styles.summaryTitle}>Resumo do Pedido</Text>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Rota</Text>
          <Text style={styles.summaryValue}>
            {routeDetails 
              ? `${routeDetails.origin || 'Origem'} → ${routeDetails.destination || 'Destino'}` 
              : `${from || 'Origem'} → ${to || 'Destino'}`
            }
          </Text>
        </View>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Data</Text>
          <Text style={styles.summaryValue}>
            {(() => {
              // Primeiro tenta usar o parâmetro date que vem da tela de resultados
              if (date) {
                try {
                  // Se date já está no formato dd/MM/yyyy, usa diretamente
                  if (typeof date === 'string' && date.includes('/')) {
                    return date;
                  }
                  // Se date está em formato ISO, converte
                  const parsedDate = parseISO(date as string);
                  if (!isNaN(parsedDate.getTime())) {
                    return format(parsedDate, 'dd/MM/yyyy');
                  }
                } catch (error) {
                  console.log('🗓️ DEBUG: Error parsing date param:', error);
                }
              }
              
              // Fallback para routeDetails se date não funcionar
              if (routeDetails && routeDetails.departure) {
                try {
                  const parsedDate = parseISO(routeDetails.departure);
                  if (!isNaN(parsedDate.getTime())) {
                    return format(parsedDate, 'dd/MM/yyyy');
                  }
                } catch (error) {
                  console.log('🗓️ DEBUG: Error parsing routeDetails date:', error);
                }
              }
              
              return 'Data não informada';
            })()}
          </Text>
        </View>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Horário</Text>
          <Text style={styles.summaryValue}>
            {routeDetails 
              ? (() => {
                  try {
                    const departureDate = parseISO(routeDetails.departure);
                    const arrivalDate = parseISO(routeDetails.arrival);
                    if (isNaN(departureDate.getTime()) || isNaN(arrivalDate.getTime())) {
                      return 'Horário inválido';
                    }
                    return `${format(departureDate, 'HH:mm')} - ${format(arrivalDate, 'HH:mm')}`;
                  } catch {
                    return 'Horário inválido';
                  }
                })()
              : `${departureTime || '--:--'} - ${arrivalTime || '--:--'}`
            }
          </Text>
        </View>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Empresa</Text>
          <Text style={styles.summaryValue}>
            {routeDetails ? (routeDetails.bus_company || 'Empresa não informada') : (companyName as string) || 'Empresa não informada'}
          </Text>
        </View>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Passageiros</Text>
          <Text style={styles.summaryValue}>
            {passengerCount ? `${passengerCount} passageiro${parseInt(passengerCount as string) > 1 ? 's' : ''}` : '1 passageiro'}
          </Text>
        </View>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Assentos</Text>
          <Text style={styles.summaryValue}>
            {(() => {
              if (selectedSeats && Array.isArray(selectedSeats) && selectedSeats.length > 0) {
                const seatNumbers = selectedSeats
                  .map(seat => seat?.seat_number)
                  .filter(num => num !== undefined && num !== null)
                  .sort();
                
                return seatNumbers.length > 0 ? seatNumbers.join(', ') : 'Nenhum assento selecionado';
              }
              return 'Nenhum assento selecionado';
            })()}
          </Text>
        </View>
        
        <View style={[styles.summaryRow, styles.summaryTotal]}>
          <Text style={styles.summaryTotalLabel}>Total</Text>
          <Text style={styles.summaryTotalValue}>
            R$ {(() => {
              const basePrice = routeDetails ? routeDetails.price : (price ? parseFloat(price as string) : 0);
              const passengers = passengerCount ? parseInt(passengerCount as string) : 1;
              const total = basePrice * passengers;
              return isNaN(total) ? '0,00' : total.toFixed(2).replace('.', ',');
            })()}
          </Text>
        </View>
      </View>

      {/* Payment Methods */}
      <Text style={styles.paymentMethodTitle}>Forma de Pagamento</Text>
      
      <TouchableOpacity
        style={[styles.paymentOption, paymentMethod === 'credit' && styles.paymentOptionActive]}
        onPress={() => setPaymentMethod('credit')}
      >
        <Ionicons name="card" size={24} color={paymentMethod === 'credit' ? '#DC2626' : '#6B7280'} />
        <Text style={[styles.paymentOptionText, paymentMethod === 'credit' && styles.paymentOptionTextActive]}>
          Cartão de Crédito
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.paymentOption, paymentMethod === 'debit' && styles.paymentOptionActive]}
        onPress={() => setPaymentMethod('debit')}
      >
        <Ionicons name="card-outline" size={24} color={paymentMethod === 'debit' ? '#DC2626' : '#6B7280'} />
        <Text style={[styles.paymentOptionText, paymentMethod === 'debit' && styles.paymentOptionTextActive]}>
          Cartão de Débito
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.paymentOption, paymentMethod === 'pix' && styles.paymentOptionActive]}
        onPress={() => setPaymentMethod('pix')}
      >
        <Ionicons name="qr-code" size={24} color={paymentMethod === 'pix' ? '#DC2626' : '#6B7280'} />
        <Text style={[styles.paymentOptionText, paymentMethod === 'pix' && styles.paymentOptionTextActive]}>
          PIX
        </Text>
      </TouchableOpacity>

      {/* Payment Form */}
      <>
        {/* Card Form */}
        {paymentMethod !== 'pix' && (
          <View style={styles.cardForm}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Número do Cartão *</Text>
              <TextInput
                style={styles.input}
                value={cardData.number}
                onChangeText={(text) => setCardData({ ...cardData, number: text })}
                placeholder="1234 5678 9012 3456"
                keyboardType="numeric"
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Nome no Cartão *</Text>
              <TextInput
                style={styles.input}
                value={cardData.name}
                onChangeText={(text) => setCardData({ ...cardData, name: text })}
                placeholder="JOÃO SILVA"
                autoCapitalize="characters"
              />
            </View>
            
            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Validade *</Text>
                <TextInput
                  style={styles.input}
                  value={cardData.expiry}
                  onChangeText={(text) => {
                    const maskedExpiry = mask(text, '99/99');
                    setCardData({ ...cardData, expiry: maskedExpiry });
                  }}
                  placeholder="MM/AA"
                  keyboardType="numeric"
                />
              </View>
              
              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>CVV *</Text>
                <TextInput
                  style={styles.input}
                  value={cardData.cvv}
                  onChangeText={(text) => setCardData({ ...cardData, cvv: text })}
                  placeholder="123"
                  keyboardType="numeric"
                  secureTextEntry
                />
              </View>
            </View>
          </View>
        )}

        {/* PIX Instructions */}
        {paymentMethod === 'pix' && (
          <View style={styles.pixInstructions}>
            <Ionicons name="information-circle" size={24} color="#3B82F6" />
            <Text style={styles.pixText}>
              Ao confirmar a reserva, você receberá um QR Code PIX para pagamento.
            </Text>
          </View>
        )}
       </>
     </ScrollView>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <LinearGradient colors={['#DC2626', '#B91C1C']} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {routeDetails ? 'Finalizar Reserva' : 'Finalizar Reserva'}
        </Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {/* Progress Steps */}
      <View style={styles.progressContainer}>
        <View style={styles.progressStep}>
          <View style={[styles.progressCircle, currentStep >= 1 && styles.progressCircleActive]}>
            <Text style={[styles.progressNumber, currentStep >= 1 && styles.progressNumberActive]}>1</Text>
          </View>
          <Text style={styles.progressLabel}>Assentos</Text>
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

      {/* Step Content */}
      <>
        {currentStep === 1 && renderSeatSelection()}
        {currentStep === 2 && renderPassengerForm()}
        {currentStep === 3 && renderPayment()}
      </>

      {/* Bottom Actions */}
      <View style={[styles.bottomActions, { paddingBottom: 20 + insets.bottom }]}>
        {currentStep > 1 && (
          <TouchableOpacity
            style={styles.backStepButton}
            onPress={() => setCurrentStep(currentStep - 1)}
            disabled={loading}
          >
            <Ionicons name="arrow-back" size={20} color="#6B7280" />
            <Text style={styles.backStepText}>Voltar</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.nextButton, currentStep === 1 && styles.nextButtonFull]}
          onPress={handleNextStep}
          disabled={loading}
        >
          {loading && currentStep === 3 ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Text style={styles.nextButtonText}>
                {currentStep === 3 ? 'Confirmar Reserva' : 'Continuar'}
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
