import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { busRoutesService } from '../../services/busRoutes';
import { BusRoute } from '../../lib/supabase';

export default function SearchScreen() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [passengers, setPassengers] = useState(1);
  const [popularRoutes, setPopularRoutes] = useState<{origin: string, destination: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPopularRoutes();
  }, []);

  const fetchPopularRoutes = async () => {
    try {
      setLoading(true);
      const routes = await busRoutesService.getPopularRoutes();
      
      // Extract unique origin-destination pairs
      const uniqueRoutes = routes.reduce((acc: {origin: string, destination: string}[], route: BusRoute) => {
        const exists = acc.some(r => r.origin === route.origin && r.destination === route.destination);
        if (!exists) {
          acc.push({ origin: route.origin, destination: route.destination });
        }
        return acc;
      }, []);
      
      setPopularRoutes(uniqueRoutes.slice(0, 4)); // Limit to 4 popular routes
      setError(null);
    } catch (err) {
      console.error('Failed to fetch popular routes:', err);
      setError('Falha ao carregar rotas populares');
      // Fallback to default routes
      setPopularRoutes([
        { origin: 'São Paulo', destination: 'Rio de Janeiro' },
        { origin: 'São Paulo', destination: 'Belo Horizonte' },
        { origin: 'Rio de Janeiro', destination: 'Vitória' },
        { origin: 'Belo Horizonte', destination: 'Brasília' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (!origin || !destination) {
      alert('Por favor, preencha a origem e o destino');
      return;
    }

    router.push({
      pathname: '/search/results',
      params: {
        origin,
        destination,
        date: date.toISOString(),
        passengers,
      },
    });
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(false);
    setDate(currentDate);
  };

  const handlePopularRouteSelect = (route: any) => {
    setOrigin(route.origin);
    setDestination(route.destination);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Buscar Passagens</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.searchForm}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Origem</Text>
            <TextInput
              style={styles.input}
              placeholder="De onde você está saindo?"
              value={origin}
              onChangeText={setOrigin}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Destino</Text>
            <TextInput
              style={styles.input}
              placeholder="Para onde você vai?"
              value={destination}
              onChangeText={setDestination}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Data da Viagem</Text>
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateText}>
                {format(date, "dd/MM/yyyy", { locale: ptBR })}
              </Text>
              <Ionicons name="calendar" size={20} color="#6B7280" />
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display="default"
                onChange={handleDateChange}
                minimumDate={new Date()}
              />
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Passageiros</Text>
            <View style={styles.passengersInput}>
              <TouchableOpacity
                style={styles.passengerButton}
                onPress={() => setPassengers(Math.max(1, passengers - 1))}
              >
                <Ionicons name="remove" size={20} color="#6B7280" />
              </TouchableOpacity>
              <Text style={styles.passengersCount}>{passengers}</Text>
              <TouchableOpacity
                style={styles.passengerButton}
                onPress={() => setPassengers(passengers + 1)}
              >
                <Ionicons name="add" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Ionicons name="search" size={20} color="#FFFFFF" />
            <Text style={styles.searchButtonText}>Buscar Passagens</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.popularRoutesSection}>
          <Text style={styles.sectionTitle}>Rotas Populares</Text>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={fetchPopularRoutes}>
                <Text style={styles.retryButtonText}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.popularRoutes}>
              {popularRoutes.length > 0 ? (
                popularRoutes.map((route, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.popularRouteCard}
                    onPress={() => handlePopularRouteSelect(route)}
                  >
                    <Text style={styles.routeText}>{route.origin}</Text>
                    <Ionicons name="arrow-forward" size={16} color="#6B7280" />
                    <Text style={styles.routeText}>{route.destination}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.noRoutesText}>Nenhuma rota popular encontrada</Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  searchForm: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  dateInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    color: '#111827',
  },
  passengersInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 8,
  },
  passengerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  passengersCount: {
    fontSize: 18,
    fontWeight: '500',
    color: '#111827',
  },
  searchButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  popularRoutesSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  popularRoutes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  popularRouteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    width: '48%',
  },
  routeText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorContainer: {
    padding: 16,
    alignItems: 'center',
  },
  errorText: {
    color: '#EF4444',
    marginBottom: 8,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  noRoutesText: {
    textAlign: 'center',
    color: '#6B7280',
    padding: 16,
    width: '100%',
  },
});

const additionalStyles = StyleSheet.create({
  dateInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    color: '#111827',
  },
  passengersInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 8,
  },
  passengerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  passengersCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  searchButton: {
    backgroundColor: '#DC2626',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  popularRoutesSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  popularRoutes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  popularRouteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    width: '48%',
  },
  routeText: {
    fontSize: 12,
    color: '#374151',
    flex: 1,
    textAlign: 'center',
  },
});