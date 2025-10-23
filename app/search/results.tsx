import { Ionicons } from '@expo/vector-icons';
import { differenceInMinutes, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { busRoutesService } from '../../services/busRoutes';
import { seatsService } from '../../services/seats';
import { BusRoute } from '../../lib/supabase';

interface Trip {
  id: string;
  companyName: string;
  companyLogo?: string;
  departure: string;
  arrivalTime: string;
  duration: string;
  price: number;
  originalPrice?: number;
  busType: 'convencional' | 'executivo' | 'leito' | 'semi-leito';
  availableSeats: number;
  totalSeats: number;
  amenities: string[];
  stops: number;
  rating: number;
  reviews: number;
}

export default function SearchResults() {
  const params = useLocalSearchParams();
  const { origin, destination, date: dateParam, passengers, tripType, returnDate, routeId, returnRouteId } = params;
  
  const [trips, setTrips] = useState<Trip[]>([]);
  const [combinedTrip, setCombinedTrip] = useState<{ outbound: Trip; returnTrip: Trip; totalPrice: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'price' | 'departure' | 'duration'>('price');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({
    busType: [] as string[],
    priceRange: [0, 500],
    departureTime: [] as string[],
    amenities: [] as string[],
  });

  useEffect(() => {
    loadTrips();
  }, []);

  const calculateDuration = (departureISO: string, arrivalISO: string): string => {
    try {
      const departure = parseISO(departureISO);
      const arrival = parseISO(arrivalISO);
      const minutes = differenceInMinutes(arrival, departure);
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h${remainingMinutes > 0 ? ` ${remainingMinutes}min` : ''}`;
    } catch (error) {
      return '0h';
    }
  };

  const formatTime = (iso: string): string => {
    try {
      const date = parseISO(iso);
      return format(date, 'HH:mm');
    } catch (error) {
      return '';
    }
  };

  const loadTrips = async () => {
    try {
      setLoading(true);
      setError(null);

      // Se ida e volta com rotas já selecionadas, carregar ambas e montar card combinado
      if ((tripType as string) === 'round-trip' && routeId && returnRouteId) {
        const [outboundRoute, returnRoute] = await Promise.all([
          busRoutesService.getRoute(routeId as string),
          busRoutesService.getRoute(returnRouteId as string),
        ]);

        const [outSeats, retSeats] = await Promise.all([
          seatsService.getAllSeatsForRoute(outboundRoute.id),
          seatsService.getAllSeatsForRoute(returnRoute.id),
        ]);

        const mapToTrip = (route: BusRoute, seats: any[]): Trip => {
          const availableSeats = (seats || []).filter((s) => s.is_available).length;
          const totalSeats = (seats || []).length;
          const busTypeNormalized = (route.bus_type || '')
            .toLowerCase()
            .replace(/\s+/g, '-');
          return {
            id: route.id,
            companyName: route.bus_company,
            departure: formatTime(route.departure_datetime),
            arrivalTime: formatTime(route.arrival_datetime),
            duration: calculateDuration(route.departure_datetime, route.arrival_datetime),
            price: route.price,
            originalPrice: undefined,
            busType: busTypeNormalized as 'convencional' | 'executivo' | 'leito' | 'semi-leito',
            availableSeats,
            totalSeats,
            amenities: route.amenities || [],
            stops: 0,
            rating: 4.5,
            reviews: 120,
          };
        };

        const outboundTrip = mapToTrip(outboundRoute, outSeats);
        const returnTrip = mapToTrip(returnRoute, retSeats);
        const totalPrice = (outboundTrip.price || 0) + (returnTrip.price || 0);
        setCombinedTrip({ outbound: outboundTrip, returnTrip, totalPrice });
        setTrips([]);
        return;
      }
      
      // Fluxo padrão: buscar viagens de ida
      const routes = await busRoutesService.searchRoutes(
        origin as string,
        destination as string,
        new Date(dateParam as string)
      );

      // Buscar poltronas para cada rota em paralelo
      const seatsByRoute = await Promise.all(
        routes.map((route) => seatsService.getAllSeatsForRoute(route.id))
      );

      const tripsData: Trip[] = routes.map((route, index) => {
        const seats = seatsByRoute[index] || [];
        const availableSeats = seats.filter((s) => s.is_available).length;
        const totalSeats = seats.length;

        const busTypeNormalized = (route.bus_type || '')
          .toLowerCase()
          .replace(/\s+/g, '-');

        return {
          id: route.id,
          companyName: route.bus_company,
          departure: formatTime(route.departure_datetime),
          arrivalTime: formatTime(route.arrival_datetime),
          duration: calculateDuration(route.departure_datetime, route.arrival_datetime),
          price: route.price,
          originalPrice: undefined,
          busType: busTypeNormalized as 'convencional' | 'executivo' | 'leito' | 'semi-leito',
          availableSeats,
          totalSeats,
          amenities: route.amenities || [],
          stops: 0,
          rating: 4.5,
          reviews: 120,
        };
      });

      setTrips(tripsData);
    } catch (err) {
      console.error('Error loading trips:', err);
      setError('Erro ao carregar viagens. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const sortTrips = (trips: Trip[]) => {
    switch (sortBy) {
      case 'price':
        return [...trips].sort((a, b) => a.price - b.price);
      case 'departure':
        return [...trips].sort((a, b) => a.departure.localeCompare(b.departure));
      case 'duration':
        return [...trips].sort((a, b) => {
          const aDuration = parseInt(a.duration.split('h')[0]);
          const bDuration = parseInt(b.duration.split('h')[0]);
          return aDuration - bDuration;
        });
      default:
        return trips;
    }
  };

  const getBusTypeLabel = (type: string) => {
    switch (type) {
      case 'convencional': return 'Convencional';
      case 'executivo': return 'Executivo';
      case 'semi-leito': return 'Semi-Leito';
      case 'leito': return 'Leito';
      default: return type;
    }
  };

  const getBusTypeColor = (type: string) => {
    switch (type) {
      case 'convencional': return '#6B7280';
      case 'executivo': return '#3B82F6';
      case 'semi-leito': return '#8B5CF6';
      case 'leito': return '#DC2626';
      default: return '#6B7280';
    }
  };

  const getAmenityIcon = (amenity: string) => {
    switch (amenity) {
      case 'wifi': return 'wifi';
      case 'ac': return 'snow';
      case 'bathroom': return 'water';
      case 'reclining': return 'bed';
      case 'bed': return 'bed';
      case 'usb': return 'phone-portrait';
      case 'blanket': return 'shirt';
      case 'pillow': return 'square';
      case 'snack': return 'fast-food';
      default: return 'checkmark';
    }
  };

  const handleSelectTrip = (trip: Trip) => {
    router.push({
      pathname: '/search/booking',
      params: {
        tripId: trip.id,
        from: origin as string,
        to: destination as string,
        date: dateParam as string,
        passengers,
        price: trip.price.toString(),
        departure: trip.departure,
        arrivalTime: trip.arrivalTime,
        companyName: trip.companyName,
        busType: trip.busType,
      },
    });
  };

  const handleSelectCombinedTrip = () => {
    if (!combinedTrip) return;
    router.push({
      pathname: '/search/booking',
      params: {
        tripId: combinedTrip.outbound.id,
        returnTripId: combinedTrip.returnTrip.id,
        tripType: 'round-trip',
        from: origin as string,
        to: destination as string,
        date: dateParam as string,
        returnDate: returnDate as string,
        passengers,
        // preço total das duas passagens
        price: combinedTrip.totalPrice.toString(),
        // manter dados do trecho de ida para exibir no header de booking
        departure: combinedTrip.outbound.departure,
        arrivalTime: combinedTrip.outbound.arrivalTime,
        companyName: combinedTrip.outbound.companyName,
        busType: combinedTrip.outbound.busType,
      },
    });
  };

  const renderTrip = ({ item }: { item: Trip }) => {
    return (
      <TouchableOpacity style={styles.tripCard} onPress={() => handleSelectTrip(item)}>
        {/* Company and Bus Type */}
        <View style={styles.tripHeader}>
          <View>
            <Text style={styles.companyName}>{item.companyName}</Text>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={14} color="#F59E0B" />
              <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
              <Text style={styles.reviewsText}>({item.reviews})</Text>
            </View>
          </View>
          <View style={[styles.busTypeBadge, { backgroundColor: getBusTypeColor(item.busType) }]}>
            <Text style={styles.busTypeText}>{getBusTypeLabel(item.busType)}</Text>
          </View>
        </View>

        {/* Times and Duration */}
        <View style={styles.tripTimes}>
          <View style={styles.timeBlock}>
            <Text style={styles.time}>{item.departure}</Text>
            <Text style={styles.city}>{origin as string}</Text>
          </View>
          
          <View style={styles.durationBlock}>
            <View style={styles.durationLine} />
            <Text style={styles.duration}>{item.duration}</Text>
            {item.stops > 0 && (
              <Text style={styles.stops}>{item.stops} parada{item.stops > 1 ? 's' : ''}</Text>
            )}
          </View>
          
          <View style={styles.timeBlock}>
            <Text style={styles.time}>{item.arrivalTime}</Text>
            <Text style={styles.city}>{destination as string}</Text>
          </View>
        </View>

        {/* Amenities */}
        <View style={styles.amenitiesContainer}>
          {item.amenities.map((amenity, index) => (
            <View key={index} style={styles.amenityItem}>
              <Ionicons name={getAmenityIcon(amenity)} size={16} color="#6B7280" />
            </View>
          ))}
        </View>

        {/* Price and Availability */}
        <View style={styles.tripFooter}>
          <View style={styles.availabilityContainer}>
            <Text style={styles.availabilityText}>
              {item.availableSeats} lugares disponíveis
            </Text>
            <View style={styles.seatIndicator}>
              <View 
                style={[
                  styles.seatIndicatorFill, 
                  { width: `${((item.totalSeats - item.availableSeats) / item.totalSeats) * 100}%` }
                ]} 
              />
            </View>
          </View>
          
          <View style={styles.priceContainer}>
            {item.originalPrice && (
              <Text style={styles.originalPrice}>R$ {item.originalPrice.toFixed(2)}</Text>
            )}
            <Text style={styles.price}>R$ {item.price.toFixed(2)}</Text>
            <Text style={styles.pricePerPerson}>por pessoa</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCombinedTrip = () => {
    if (!combinedTrip) return null;
    const { outbound, returnTrip, totalPrice } = combinedTrip;
    return (
      <TouchableOpacity style={styles.tripCard} onPress={handleSelectCombinedTrip}>
        {/* Company and Bus Type */}
        <View style={styles.tripHeader}>
          <View>
            <Text style={styles.companyName}>{outbound.companyName}</Text>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={14} color="#F59E0B" />
              <Text style={styles.ratingText}>{outbound.rating.toFixed(1)}</Text>
              <Text style={styles.reviewsText}>({outbound.reviews})</Text>
            </View>
          </View>
          <View style={[styles.busTypeBadge, { backgroundColor: getBusTypeColor(outbound.busType) }]}>
            <Text style={styles.busTypeText}>{getBusTypeLabel(outbound.busType)}</Text>
          </View>
        </View>

        {/* Outbound Times */}
        <View style={styles.tripTimes}>
          <View style={styles.timeBlock}>
            <Text style={styles.time}>{outbound.departure}</Text>
            <Text style={styles.city}>{origin as string}</Text>
          </View>
          <View style={styles.durationBlock}>
            <View style={styles.durationLine} />
            <Text style={styles.duration}>{outbound.duration}</Text>
          </View>
          <View style={styles.timeBlock}>
            <Text style={styles.time}>{outbound.arrivalTime}</Text>
            <Text style={styles.city}>{destination as string}</Text>
          </View>
        </View>

        {/* Return Times */}
        <View style={[styles.tripTimes, { marginTop: 8 }] }>
          <View style={styles.timeBlock}>
            <Text style={styles.time}>{returnTrip.departure}</Text>
            <Text style={styles.city}>{destination as string}</Text>
          </View>
          <View style={styles.durationBlock}>
            <View style={styles.durationLine} />
            <Text style={styles.duration}>{returnTrip.duration}</Text>
          </View>
          <View style={styles.timeBlock}>
            <Text style={styles.time}>{returnTrip.arrivalTime}</Text>
            <Text style={styles.city}>{origin as string}</Text>
          </View>
        </View>

        {/* Amenities (merge simple) */}
        <View style={styles.amenitiesContainer}>
          {[...new Set([...(outbound.amenities || []), ...(returnTrip.amenities || [])])].slice(0, 6).map((amenity, index) => (
            <View key={index} style={styles.amenityItem}>
              <Ionicons name={getAmenityIcon(amenity)} size={16} color="#6B7280" />
            </View>
          ))}
        </View>

        {/* Price and Availability */}
        <View style={styles.tripFooter}>
          <View style={styles.availabilityContainer}>
            <Text style={styles.availabilityText}>
              {outbound.availableSeats} lugares ida • {returnTrip.availableSeats} volta
            </Text>
          </View>
          <View style={styles.priceContainer}>
            <Text style={styles.price}>R$ {totalPrice.toFixed(2)}</Text>
            <Text style={styles.pricePerPerson}>total das duas passagens</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#DC2626", "#B91C1C"]} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <View style={styles.routeInfo}>
            <Text style={styles.headerTitle}>{origin} → {destination}</Text>
            <Text style={styles.headerSubtitle}>
              {(() => {
                try {
                  const parsedDate = parseISO(dateParam as string);
                  if (isNaN(parsedDate.getTime())) {
                    const fallbackDate = new Date(dateParam as string);
                    return isNaN(fallbackDate.getTime()) ? 'Data inválida' : format(fallbackDate, "dd/MM/yyyy", { locale: ptBR });
                  }
                  return format(parsedDate, "dd/MM/yyyy", { locale: ptBR });
                } catch (error) {
                  return 'Data inválida';
                }
              })()} • {passengers} passageiro{parseInt(passengers as string) > 1 ? 's' : ''}
            </Text>
          </View>
          
          <TouchableOpacity style={styles.editButton} onPress={() => router.back()}>
            <Ionicons name="pencil" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Control Bar */}
      <View style={styles.controlBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortOptions}>
          {[
            { key: 'price', label: 'Menor preço', icon: 'pricetag' },
            { key: 'departure', label: 'Horário', icon: 'time' },
            { key: 'duration', label: 'Duração', icon: 'speedometer' },
          ].map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.sortButton,
                sortBy === option.key && styles.sortButtonActive,
              ]}
              onPress={() => setSortBy(option.key as any)}
            >
              <Ionicons 
                name={option.icon as any} 
                size={16} 
                color={sortBy === option.key ? '#DC2626' : '#6B7280'} 
              />
              <Text style={[
                styles.sortButtonText,
                sortBy === option.key && styles.sortButtonTextActive,
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        <TouchableOpacity 
          style={styles.filterButton} 
          onPress={() => setFilterModalVisible(true)}
        >
          <Ionicons name="options" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC2626" />
          <Text style={styles.loadingText}>Buscando viagens...</Text>
        </View>
      ) : error ? (
        <View style={styles.loadingContainer}>
          <Ionicons name="alert-circle" size={48} color="#DC2626" />
          <Text style={styles.loadingText}>{error}</Text>
          <TouchableOpacity onPress={loadTrips} style={{ marginTop: 16 }}>
            <Text style={{ color: '#DC2626', fontWeight: '600' }}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : combinedTrip ? (
        <ScrollView contentContainerStyle={styles.listContainer}>
          <Text style={styles.resultsCount}>1 combinação ida e volta selecionada</Text>
          {renderCombinedTrip()}
        </ScrollView>
      ) : (
        <FlatList
          data={sortTrips(trips)}
          renderItem={renderTrip}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListHeaderComponent={() => (
            <Text style={styles.resultsCount}>
              {trips.length} viagem{trips.length !== 1 ? 'ns' : ''} encontrada{trips.length !== 1 ? 's' : ''}
            </Text>
          )}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Ionicons name="bus" size={64} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>Nenhuma viagem encontrada</Text>
              <Text style={styles.emptyText}>
                Tente alterar os filtros ou buscar em outras datas
              </Text>
            </View>
          )}
        />
      )}

      {/* Filter Modal */}
      <Modal
        visible={filterModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtros</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              {/* Bus Type Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Tipo de ônibus</Text>
                {['convencional', 'executivo', 'semi-leito', 'leito'].map((type) => (
                  <TouchableOpacity key={type} style={styles.filterOption}>
                    <View style={styles.checkbox}>
                      {selectedFilters.busType.includes(type) && (
                        <Ionicons name="checkmark" size={16} color="#DC2626" />
                      )}
                    </View>
                    <Text style={styles.filterOptionText}>{getBusTypeLabel(type)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.clearButton}>
                <Text style={styles.clearButtonText}>Limpar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.applyButton}
                onPress={() => setFilterModalVisible(false)}
              >
                <Text style={styles.applyButtonText}>Aplicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingTop: 40,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  backButton: {
    marginRight: 16,
  },
  routeInfo: {
    flex: 1,
  },
  routeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  dateText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  editButton: {
    padding: 8,
  },
  controlBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sortOptions: {
    flex: 1,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  sortButtonActive: {
    backgroundColor: '#FEE2E2',
  },
  sortButtonText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
  },
  sortButtonTextActive: {
    color: '#DC2626',
    fontWeight: '600',
  },
  filterButton: {
    padding: 8,
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  listContainer: {
    padding: 16,
  },
  resultsCount: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  tripCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  companyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 4,
  },
  reviewsText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  busTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  busTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tripTimes: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  timeBlock: {
    alignItems: 'center',
  },
  time: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  city: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  durationBlock: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  durationLine: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#E5E7EB',
  },
  duration: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
  },
  stops: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  amenitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  amenityItem: {
    backgroundColor: '#F3F4F6',
    padding: 8,
    borderRadius: 8,
  },
  tripFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  availabilityContainer: {
    flex: 1,
  },
  availabilityText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  seatIndicator: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  seatIndicatorFill: {
    height: '100%',
    backgroundColor: '#DC2626',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  originalPrice: {
    fontSize: 14,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  pricePerPerson: {
    fontSize: 12,
    color: '#6B7280',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  modalBody: {
    padding: 20,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterOptionText: {
    fontSize: 16,
    color: '#374151',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  clearButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  applyButton: {
    flex: 1,
    backgroundColor: '#DC2626',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
