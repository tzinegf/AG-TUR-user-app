import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { bookingsService } from '../../services/bookings';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const { width } = Dimensions.get('window');

interface PopularRoute {
  id: string;
  from: string;
  to: string;
  fromCity: string;
  toCity: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  duration: string;
  distance: string;
  image: string;
  popularity: number;
  availableCompanies: number;
  nextDeparture: string;
  rating: number;
  totalBookings: number;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const [popularRoutes, setPopularRoutes] = useState<PopularRoute[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [userStats, setUserStats] = useState({
    totalTrips: 0,
    totalSpent: 0,
    favoriteDestination: '',
    memberSince: '',
    upcomingTrips: 0,
    loyaltyPoints: 0
  });

  useEffect(() => {
    loadPopularRoutes();
    loadUserStats();
  }, []);

  const loadUserStats = async () => {
    try {
      const bookings = await bookingsService.getUserBookings();
      const now = new Date();
      let upcomingTrips = 0;

      (bookings || []).forEach((b: any) => {
        const route = b?.route || {};
        const departureRaw = route?.departure_time || (route as any)?.departure;
        const parsedDeparture = departureRaw ? new Date(departureRaw as string) : null;
        const departure: Date | null = (parsedDeparture && !isNaN(parsedDeparture.getTime())) ? parsedDeparture : null;
        const isCancelled = b.status === 'cancelled';
        const isCompleted = b.payment_status === 'completed' || b.payment_status === 'paid' || b.status === 'used' || b.status === 'completed';
        const statusOk = b.payment_status === 'pending' || b.payment_status === 'completed' || b.payment_status === 'paid' || b.status === 'confirmed' || b.status === 'active';
        const isUpcoming = departure ? (departure >= now && !isCancelled) : (!isCancelled && statusOk && !isCompleted);
        if (isUpcoming && statusOk) upcomingTrips++;
      });

      const totalTrips = (bookings || []).filter((b: any) => b.status !== 'cancelled').length;

      // Calcular Gastos (reservas pagas) e Destino Favorito
      let totalSpent = 0;
      const destCount: Record<string, number> = {};
      (bookings || []).forEach((b: any) => {
        const paid = b?.payment_status === 'completed' || b?.payment_status === 'paid';
        if (paid && typeof b?.total_price === 'number') {
          totalSpent += b.total_price;
        }
        const destination = (b?.route?.destination) || (b as any)?.destination || '';
        if (destination) {
          destCount[destination] = (destCount[destination] || 0) + 1;
        }
      });

      const favoriteDestination = Object.entries(destCount)
        .sort((a, b) => b[1] - a[1])
        .map(([dest]) => dest)[0] || '';

      // Pontos de fidelidade (ex.: 1 ponto por R$10 gastos)
      const loyaltyPoints = Math.floor(totalSpent / 10);

      // "Membro desde" a partir do perfil
      let memberSince = '';
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        const userId = authUser?.id;
        if (userId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('created_at')
            .eq('id', userId)
            .single();
          const createdAt = (profile as any)?.created_at;
          if (createdAt) {
            const dt = new Date(createdAt);
            if (!isNaN(dt.getTime())) {
              memberSince = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(dt);
            }
          }
        }
      } catch (e) {
        // Mantém vazio se falhar
      }

      setUserStats((prev) => ({
        ...prev,
        totalTrips,
        upcomingTrips,
        totalSpent,
        favoriteDestination,
        loyaltyPoints,
        memberSince,
      }));
    } catch (err) {
      console.warn('Falha ao carregar estatísticas de viagens. Mantendo valores padrão.', err);
    }
  };

  const loadPopularRoutes = () => {
    // Simulate API call
    setTimeout(() => {
      setPopularRoutes([
        {
          id: '1',
          from: 'São Paulo',
          to: 'Rio de Janeiro',
          fromCity: 'SP',
          toCity: 'RJ',
          price: 89.90,
          originalPrice: 120.00,
          discount: 25,
          duration: '6h',
          distance: '430 km',
          image: 'https://images.pexels.com/photos/351283/pexels-photo-351283.jpeg?auto=compress&cs=tinysrgb&w=800',
          popularity: 95,
          availableCompanies: 8,
          nextDeparture: '30 min',
          rating: 4.7,
          totalBookings: 1234,
        },
        {
          id: '2',
          from: 'Belo Horizonte',
          to: 'Salvador',
          fromCity: 'MG',
          toCity: 'BA',
          price: 129.90,
          originalPrice: 180.00,
          discount: 28,
          duration: '20h',
          distance: '1.372 km',
          image: 'https://images.pexels.com/photos/1804177/pexels-photo-1804177.jpeg?auto=compress&cs=tinysrgb&w=800',
          popularity: 88,
          availableCompanies: 5,
          nextDeparture: '2h',
          rating: 4.5,
          totalBookings: 856,
        },
        {
          id: '3',
          from: 'Brasília',
          to: 'Goiânia',
          fromCity: 'DF',
          toCity: 'GO',
          price: 45.90,
          duration: '3h',
          distance: '209 km',
          image: 'https://images.pexels.com/photos/2467558/pexels-photo-2467558.jpeg?auto=compress&cs=tinysrgb&w=800',
          popularity: 82,
          availableCompanies: 6,
          nextDeparture: '1h',
          rating: 4.6,
          totalBookings: 2341,
        },
        {
          id: '4',
          from: 'Curitiba',
          to: 'Florianópolis',
          fromCity: 'PR',
          toCity: 'SC',
          price: 75.00,
          originalPrice: 95.00,
          discount: 21,
          duration: '4h 30min',
          distance: '300 km',
          image: 'https://images.pexels.com/photos/1121782/pexels-photo-1121782.jpeg?auto=compress&cs=tinysrgb&w=800',
          popularity: 79,
          availableCompanies: 4,
          nextDeparture: '45 min',
          rating: 4.8,
          totalBookings: 1567,
        },
        {
          id: '5',
          from: 'Porto Alegre',
          to: 'São Paulo',
          fromCity: 'RS',
          toCity: 'SP',
          price: 189.90,
          originalPrice: 250.00,
          discount: 24,
          duration: '18h',
          distance: '1.109 km',
          image: 'https://images.pexels.com/photos/1770775/pexels-photo-1770775.jpeg?auto=compress&cs=tinysrgb&w=800',
          popularity: 75,
          availableCompanies: 7,
          nextDeparture: '3h',
          rating: 4.4,
          totalBookings: 678,
        },
      ]);
      setLoadingRoutes(false);
    }, 1000);
  };

  const handleRoutePress = (route: PopularRoute) => {
    router.push({
      pathname: '/(tabs)/search',
      params: {
        from: route.from,
        to: route.to,
      },
    });
  };

  const quickActions = [
    {
      icon: 'search',
      title: 'Buscar Viagem',
      subtitle: 'Encontre sua rota',
      color: '#DC2626',
      onPress: () => router.push('/(tabs)/search'),
    },
    {
      icon: 'ticket',
      title: 'Minhas Passagens',
      subtitle: 'Histórico de viagens',
      color: '#7C3AED',
      onPress: () => router.push('/(tabs)/tickets'),
    },
    {
      icon: 'notifications',
      title: 'Notificações',
      subtitle: 'Alertas de viagem',
      color: '#EAB308',
      onPress: () => {},
    },
    {
      icon: 'help-circle',
      title: 'Suporte',
      subtitle: 'Precisa de ajuda?',
      color: '#059669',
      onPress: () => router.push('/support'),
    },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <LinearGradient
        colors={['#DC2626', '#7C3AED']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>Olá, {user?.name || 'Viajante'}!</Text>
            <Text style={styles.subGreeting}>Para onde vamos hoje?</Text>
          </View>
          <TouchableOpacity style={styles.profileButton} onPress={() => router.push('/(tabs)/profile')}>
            <Ionicons name="person-circle" size={40} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* User Data Section */}
      <View style={styles.section}>
        <Text style={styles.activities}>Atividades</Text>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
             <View style={styles.statIconContainer}>
               <Ionicons name="bus" size={20} color="#DC2626" />
             </View>
             <Text style={styles.statValue}>{userStats.totalTrips}</Text>
             <Text style={styles.statLabel}>Viagens</Text>
           </View>

          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="card" size={20} color="#7C3AED" />
            </View>
            <Text style={styles.statValue}>R$ {userStats.totalSpent.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Gastos</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="location" size={20} color="#EAB308" />
            </View>
            <Text style={styles.statValue}>{userStats.favoriteDestination}</Text>
            <Text style={styles.statLabel}>Destino Favorito</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="star" size={20} color="#059669" />
            </View>
            <Text style={styles.statValue}>{userStats.loyaltyPoints}</Text>
            <Text style={styles.statLabel}>Pontos</Text>
          </View>
        </View>

        {userStats.upcomingTrips > 0 && (
          <View style={styles.upcomingTripsCard}>
            <LinearGradient
              colors={['#059669', '#10B981']}
              style={styles.upcomingTripsGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <View style={styles.upcomingTripsContent}>
                <Ionicons name="calendar" size={24} color="#FFFFFF" />
                <View style={styles.upcomingTripsText}>
                  <Text style={styles.upcomingTripsTitle}>Próximas Viagens</Text>
                  <Text style={styles.upcomingTripsSubtitle}>
                    Você tem {userStats.upcomingTrips} viagem{userStats.upcomingTrips > 1 ? 'ns' : ''} agendada{userStats.upcomingTrips > 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.upcomingTripsButton} onPress={() => router.push('/(tabs)/tickets')}>
                <Text style={styles.upcomingTripsButtonText}>Ver</Text>
                <Ionicons name="arrow-forward" size={16} color="#059669" />
              </TouchableOpacity>
            </LinearGradient>
          </View>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ações Rápidas</Text>
        <View style={styles.quickActionsGrid}>
          {quickActions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={styles.quickActionCard}
              onPress={action.onPress}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: action.color }]}>
                <Ionicons name={action.icon as any} size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.quickActionTitle}>{action.title}</Text>
              <Text style={styles.quickActionSubtitle}>{action.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Popular Routes - Enhanced Section */}
      <View style={styles.popularSection}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Rotas Mais Procuradas</Text>
            <Text style={styles.sectionSubtitle}>Destinos favoritos dos viajantes</Text>
          </View>
          <TouchableOpacity style={styles.viewAllButton}>
            <Text style={styles.viewAllText}>Ver todas</Text>
            <Ionicons name="arrow-forward" size={16} color="#DC2626" />
          </TouchableOpacity>
        </View>

        {loadingRoutes ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#DC2626" />
          </View>
        ) : (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.routesContainer}
            pagingEnabled
            snapToInterval={width - 48}
            decelerationRate="fast"
          >
            {popularRoutes.map((route, index) => (
              <TouchableOpacity
                key={route.id}
                style={[
                  styles.popularRouteCard,
                  index === 0 && styles.firstCard,
                  index === popularRoutes.length - 1 && styles.lastCard,
                ]}
                onPress={() => handleRoutePress(route)}
                activeOpacity={0.9}
              >
                {/* Background Image */}
                <Image source={{ uri: route.image }} style={styles.routeBackgroundImage} />
                
                {/* Gradient Overlay */}
                <LinearGradient
                  colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)']}
                  style={styles.routeGradientOverlay}
                />

                {/* Discount Badge */}
                {route.discount && (
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountText}>{route.discount}% OFF</Text>
                  </View>
                )}

                {/* Popularity Indicator */}
                <View style={styles.popularityBadge}>
                  <Ionicons name="flame" size={16} color="#FFFFFF" />
                  <Text style={styles.popularityText}>{route.popularity}% popular</Text>
                </View>

                {/* Route Content */}
                <View style={styles.routeContent}>
                  {/* Cities */}
                  <View style={styles.citiesContainer}>
                    <View style={styles.cityBlock}>
                      <Text style={styles.cityCode}>{route.fromCity}</Text>
                      <Text style={styles.cityName}>{route.from}</Text>
                    </View>
                    
                    <View style={styles.routeLineContainer}>
                      <View style={styles.routeLine} />
                      <Ionicons name="bus" size={20} color="#FFFFFF" style={styles.busIcon} />
                      <View style={styles.routeLine} />
                    </View>
                    
                    <View style={styles.cityBlock}>
                      <Text style={styles.cityCode}>{route.toCity}</Text>
                      <Text style={styles.cityName}>{route.to}</Text>
                    </View>
                  </View>

                  {/* Route Info */}
                  <View style={styles.routeInfoGrid}>
                    <View style={styles.routeInfoItem}>
                      <Ionicons name="time-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.routeInfoText}>{route.duration}</Text>
                    </View>
                    <View style={styles.routeInfoItem}>
                      <Ionicons name="location-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.routeInfoText}>{route.distance}</Text>
                    </View>
                    <View style={styles.routeInfoItem}>
                      <Ionicons name="business-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.routeInfoText}>{route.availableCompanies} empresas</Text>
                    </View>
                  </View>

                  {/* Stats */}
                  <View style={styles.routeStats}>
                    <View style={styles.statItem}>
                      <Ionicons name="star" size={14} color="#F59E0B" />
                      <Text style={styles.statText}>{route.rating}</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Ionicons name="people" size={14} color="#FFFFFF" />
                      <Text style={styles.statText}>{route.totalBookings} reservas</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Ionicons name="timer-outline" size={14} color="#FFFFFF" />
                      <Text style={styles.statText}>Próxima em {route.nextDeparture}</Text>
                    </View>
                  </View>

                  {/* Price */}
                  <View style={styles.priceContainer}>
                    <View>
                      <Text style={styles.priceLabel}>A partir de</Text>
                      <View style={styles.priceRow}>
                        {route.originalPrice && (
                          <Text style={styles.originalPrice}>R$ {route.originalPrice.toFixed(2)}</Text>
                        )}
                        <Text style={styles.currentPrice}>R$ {route.price.toFixed(2)}</Text>
                      </View>
                    </View>
                    <View style={styles.bookButton}>
                      <Text style={styles.bookButtonText}>Reservar</Text>
                      <Ionicons name="arrow-forward" size={16} color="#DC2626" />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Route Indicators */}
        <View style={styles.indicatorsContainer}>
          {popularRoutes.map((_, index) => (
            <View
              key={index}
              style={[
                styles.indicator,
                index === 0 && styles.activeIndicator,
              ]}
            />
          ))}
        </View>
      </View>

      {/* Promotions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Promoções</Text>
        <LinearGradient
          colors={['#EAB308', '#F59E0B']}
          style={styles.promotionCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={styles.promotionContent}>
            <Ionicons name="gift" size={32} color="#FFFFFF" />
            <View style={styles.promotionText}>
              <Text style={styles.promotionTitle}>Desconto de 20%</Text>
              <Text style={styles.promotionSubtitle}>Na primeira viagem</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.promotionButton}>
            <Text style={styles.promotionButtonText}>Usar Cupom</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subGreeting: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
    marginTop: 4,
  },
  profileButton: {
    padding: 4,
  },
  section: {
    paddingHorizontal: 24,
    marginTop: 32,
  },
  popularSection: {
    marginTop: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
   
  activities: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    paddingBottom:20
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '600',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 16,
  },
  quickActionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    width: '47%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
  },
  quickActionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  loadingContainer: {
    height: 320,
    justifyContent: 'center',
    alignItems: 'center',
  },
  routesContainer: {
    paddingLeft: 24,
    paddingRight: 8,
  },
  popularRouteCard: {
    width: width - 48,
    height: 320,
    marginRight: 16,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  firstCard: {
    marginLeft: 0,
  },
  lastCard: {
    marginRight: 24,
  },
  routeBackgroundImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  routeGradientOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  discountBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  discountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  popularityBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  popularityText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  routeContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  citiesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cityBlock: {
    alignItems: 'center',
  },
  cityCode: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  cityName: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    marginTop: 4,
  },
  routeLineContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
  },
  routeLine: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  busIcon: {
    marginHorizontal: 8,
  },
  routeInfoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  routeInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  routeInfoText: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  routeStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  priceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  priceLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.8,
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  originalPrice: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.6,
    textDecorationLine: 'line-through',
  },
  currentPrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  bookButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bookButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
  },
  indicatorsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  activeIndicator: {
    backgroundColor: '#DC2626',
    width: 24,
  },
  promotionCard: {
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  promotionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  promotionText: {
    flex: 1,
  },
  promotionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  promotionSubtitle: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  promotionButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  promotionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EAB308',
  },
  promotionBadge: {
    backgroundColor: '#EAB308',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  promotionBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  promotionIcon: {
    color: '#EAB308',
  },
  // User Data Section Styles
  userDataSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  userInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  userInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userInfoText: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  memberSince: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  editProfileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    width: '48%',
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  upcomingTripsCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  upcomingTripsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  upcomingTripsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  upcomingTripsText: {
    marginLeft: 12,
    flex: 1,
  },
  upcomingTripsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  upcomingTripsSubtitle: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  upcomingTripsButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  upcomingTripsButtonText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
});
