import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { busRoutesService } from '../../services/busRoutes';

interface Route {
  id: string;
  origin: string;
  destination: string;
  departure_time: string;
  arrival: string;
  price: number;
  bus_type: string;
  amenities: string[];
}

interface SearchForm {
  selectedRoute: Route | null;
  departureDate: Date;
  returnDate?: Date;
  passengers: number;
  tripType: 'one-way' | 'round-trip';
}

export default function SearchScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [showDepartureDatePicker, setShowDepartureDatePicker] = useState(false);
  const [showReturnDatePicker, setShowReturnDatePicker] = useState(false);

  const [searchForm, setSearchForm] = useState<SearchForm>({
    selectedRoute: null,
    departureDate: new Date(),
    returnDate: undefined,
    passengers: 1,
    tripType: 'one-way',
  });

  useEffect(() => {
    loadRoutes();
  }, []);

  const loadRoutes = async () => {
    try {
      setLoading(true);
      const routesData = await busRoutesService.getAllRoutes();
      setRoutes(routesData.map(route => ({
        id: route.id,
        origin: route.origin,
        destination: route.destination,
        departure_time: route.departure,
        arrival: route.arrival,
        price: route.price,
        bus_type: route.bus_type,
        amenities: route.amenities || [],
       
      })) || []);
    } catch (error) {
      console.error('Erro ao carregar rotas:', error);
      Alert.alert('Erro', 'Não foi possível carregar as rotas disponíveis.');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date, type: 'departure' | 'return' = 'departure') => {
    if (Platform.OS === 'android') {
      setShowDepartureDatePicker(false);
      setShowReturnDatePicker(false);
    }

    if (selectedDate) {
      if (type === 'departure') {
        setSearchForm(prev => ({ ...prev, departureDate: selectedDate }));
      } else {
        setSearchForm(prev => ({ ...prev, returnDate: selectedDate }));
      }
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatTime = (timeString: string) => {
    try {
      // Se a string já está no formato HH:MM, usar diretamente
      if (/^\d{2}:\d{2}$/.test(timeString)) {
        return timeString;
      }
      
      // Tentar criar uma data válida
      const date = new Date(timeString);
      
      // Verificar se a data é válida
      if (isNaN(date.getTime())) {
        return timeString; // Retorna a string original se não conseguir converter
      }
      
      return date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      // Em caso de erro, retorna a string original ou um valor padrão
      return timeString || 'Horário inválido';
    }
  };

  const getBusTypeLabel = (type: string) => {
    const types: { [key: string]: string } = {
      'convencional': 'Convencional',
      'executivo': 'Executivo',
      'leito': 'Leito',
      'semi-leito': 'Semi-Leito',
    };
    return types[type] || type;
  };

  const handleRouteSelect = (route: Route) => {
    setSearchForm(prev => ({ ...prev, selectedRoute: route }));
  };

  const handleSearch = () => {
    if (!searchForm.selectedRoute) {
      Alert.alert('Erro', 'Por favor, selecione uma rota.');
      return;
    }

    // Navegar para a tela de resultados com os parâmetros de busca
    router.push({
      pathname: '/search/results',
      params: {
        origin: searchForm.selectedRoute.origin,
        destination: searchForm.selectedRoute.destination,
        date: searchForm.departureDate.toISOString(),
        returnDate: searchForm.returnDate?.toISOString(),
        passengers: searchForm.passengers.toString(),
        tripType: searchForm.tripType,
        routeId: searchForm.selectedRoute.id,
      },
    });
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#DC2626', '#B91C1C']} style={styles.header}>
        <Text style={styles.headerTitle}>Buscar Passagens</Text>
        <Text style={styles.headerSubtitle}>
          Escolha sua rota e encontre as melhores opções
        </Text>
      </LinearGradient>

      {/* Search Card */}
      <View style={styles.searchCard}>
        {/* Trip Type */}
        <View style={styles.tripTypeContainer}>
          <TouchableOpacity
            style={[
              styles.tripTypeButton,
              searchForm.tripType === 'one-way' && styles.tripTypeButtonActive,
            ]}
            onPress={() => setSearchForm(prev => ({ ...prev, tripType: 'one-way', returnDate: undefined }))}
          >
            <Text style={[
              styles.tripTypeText,
              searchForm.tripType === 'one-way' && styles.tripTypeTextActive,
            ]}>
              Somente ida
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tripTypeButton,
              searchForm.tripType === 'round-trip' && styles.tripTypeButtonActive,
            ]}
            onPress={() => setSearchForm(prev => ({ ...prev, tripType: 'round-trip', returnDate: new Date() }))}
          >
            <Text style={[
              styles.tripTypeText,
              searchForm.tripType === 'round-trip' && styles.tripTypeTextActive,
            ]}>
              Ida e volta
            </Text>
          </TouchableOpacity>
        </View>

        {/* Routes List */}
        <View style={styles.routesContainer}>
          <Text style={styles.inputLabel}>Selecione sua rota</Text>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#DC2626" />
              <Text style={styles.loadingText}>Carregando rotas...</Text>
            </View>
          ) : (
            <ScrollView 
              style={styles.routesList} 
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              bounces={true}
              contentContainerStyle={styles.routesListContent}
            >
              {routes.map((route) => (
                <TouchableOpacity
                  key={route.id}
                  style={[
                    styles.routeCard,
                    searchForm.selectedRoute?.id === route.id && styles.routeCardSelected,
                  ]}
                  onPress={() => handleRouteSelect(route)}
                >
                  <View style={styles.routeHeader}>
                    <View style={styles.routeInfo}>
                      <Text style={styles.routeText}>
                        {route.origin} → {route.destination}
                      </Text>
                      <Text style={styles.routeTime}>
                        {formatTime(route.departure_time)} - {formatTime(route.arrival)}
                      </Text>
                    </View>
                    <View style={styles.routePrice}>
                      <Text style={styles.priceText}>R$ {route.price.toFixed(2)}</Text>
                      <Text style={styles.busTypeText}>{getBusTypeLabel(route.bus_type)}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.routeDetails}>
                    <View style={styles.amenitiesContainer}>
                      {(route.amenities || []).slice(0, 3).map((amenity, index) => (
                        <View key={index} style={styles.amenityTag}>
                          <Text style={styles.amenityText}>{amenity}</Text>
                        </View>
                      ))}
                      {(route.amenities || []).length > 3 && (
                        <Text style={styles.moreAmenities}>+{(route.amenities || []).length - 3}</Text>
                      )}
                    </View>
                    
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Dates */}
        <View style={styles.datesContainer}>
          <TouchableOpacity
            style={styles.dateInput}
            onPress={() => setShowDepartureDatePicker(true)}
          >
            <Ionicons name="calendar" size={20} color="#DC2626" />
            <View style={styles.dateContent}>
              <Text style={styles.dateLabel}>Data de ida</Text>
              <Text style={styles.dateValue}>{formatDate(searchForm.departureDate)}</Text>
            </View>
          </TouchableOpacity>

          {searchForm.tripType === 'round-trip' && (
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => setShowReturnDatePicker(true)}
            >
              <Ionicons name="calendar" size={20} color="#DC2626" />
              <View style={styles.dateContent}>
                <Text style={styles.dateLabel}>Data de volta</Text>
                <Text style={styles.dateValue}>
                  {searchForm.returnDate ? formatDate(searchForm.returnDate) : 'Selecionar'}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Passengers */}
        <View style={styles.passengersContainer}>
          <Text style={styles.inputLabel}>Passageiros</Text>
          <View style={styles.passengersSelector}>
            <TouchableOpacity
              style={styles.passengerButton}
              onPress={() => setSearchForm(prev => ({ 
                ...prev, 
                passengers: Math.max(1, prev.passengers - 1) 
              }))}
            >
              <Ionicons name="remove" size={20} color="#DC2626" />
            </TouchableOpacity>
            <Text style={styles.passengerCount}>{searchForm.passengers}</Text>
            <TouchableOpacity
              style={styles.passengerButton}
              onPress={() => setSearchForm(prev => ({ 
                ...prev, 
                passengers: Math.min(10, prev.passengers + 1) 
              }))}
            >
              <Ionicons name="add" size={20} color="#DC2626" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Button */}
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Ionicons name="search" size={20} color="#FFFFFF" />
          <Text style={styles.searchButtonText}>Buscar Passagens</Text>
        </TouchableOpacity>
      </View>

      {/* Date Pickers */}
      {showDepartureDatePicker && (
        <DateTimePicker
          value={searchForm.departureDate}
          mode="date"
          display="default"
          onChange={(event, date) => handleDateChange(event, date, 'departure')}
          minimumDate={new Date()}
        />
      )}

      {showReturnDatePicker && searchForm.returnDate && (
        <DateTimePicker
          value={searchForm.returnDate}
          mode="date"
          display="default"
          onChange={(event, date) => handleDateChange(event, date, 'return')}
          minimumDate={searchForm.departureDate}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
    textAlign: 'center',
  },
  searchCard: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  tripTypeContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  tripTypeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tripTypeButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tripTypeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  tripTypeTextActive: {
    color: '#DC2626',
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  routesContainer: {
    marginBottom: 24,
  },
  routesList: {
    maxHeight: 300,
    backgroundColor: '#FFFFFF',
  },
  routesListContent: {
    paddingBottom: 8,
  },
  routeCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 12,
  },
  routeCardSelected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#DC2626',
    borderWidth: 2,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  routeInfo: {
    flex: 1,
  },
  routeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  routeTime: {
    fontSize: 14,
    color: '#6B7280',
  },
  routePrice: {
    alignItems: 'flex-end',
  },
  priceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  busTypeText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  routeDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amenitiesContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  amenityTag: {
    backgroundColor: '#E5E7EB',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
  },
  amenityText: {
    fontSize: 10,
    color: '#374151',
  },
  moreAmenities: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  availabilityText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
  },
  datesContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  dateInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateContent: {
    marginLeft: 12,
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  passengersContainer: {
    marginBottom: 24,
  },
  passengersSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 4,
  },
  passengerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  passengerCount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginHorizontal: 24,
    minWidth: 30,
    textAlign: 'center',
  },
  searchButton: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#DC2626',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
