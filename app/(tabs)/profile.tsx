import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useColorScheme } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../contexts/AuthContext';
import { userService } from '../../services/userService';
import { supabase } from '../../lib/supabase';
import { mask } from 'react-native-mask-text';
import { router } from 'expo-router';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user, signOut } = useAuth();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(user?.name || '');
  const [editedPhone, setEditedPhone] = useState(user?.phone || '');

  // refs para manter valores atuais sem causar re-render
  const nameRef = useRef<string>(editedName);
  const phoneRef = useRef<string>(editedPhone);

  const onlyDigits = (s: string) => (s || '').replace(/\D/g, '');
  const isValidPhoneBR = (s: string) => {
    const d = onlyDigits(s);
    return d.length === 10 || d.length === 11; // fixo (10) ou celular (11)
  };

  const handleLogout = () => {
    Alert.alert(
      'Sair da Conta',
      'Tem certeza que deseja sair da sua conta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Sair', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await signOut();
              // Navigate to auth screen after logout
              router.replace('/auth');
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível sair da conta. Tente novamente.');
            }
          }
        },
      ]
    );
  };

  const handleSaveProfile = async (nameOverride?: string, phoneOverride?: string) => {
    try {
      if (!user?.id) {
        Alert.alert('Erro', 'Usuário não autenticado.');
        return;
      }

      const nameValue = (nameOverride ?? editedName)?.trim() || '';
      const phoneValue = (phoneOverride ?? editedPhone)?.trim() || '';

      // validação
      if (!nameValue) {
        Alert.alert('Validação', 'Nome não pode ser vazio.');
        return;
      }
      if (!isValidPhoneBR(phoneValue)) {
        Alert.alert('Validação', 'Telefone inválido. Use o formato (99) 99999-9999.');
        return;
      }

      const payload: Partial<{ name: string; phone: string }> = {
        name: nameValue,
        phone: phoneValue,
      };

      await userService.updateUser(user.id, payload as any);

      // Atualiza metadados do usuário para refletir no contexto quando possível
      try {
        await supabase.auth.updateUser({
          data: {
            name: payload.name,
            phone: payload.phone,
          },
        });
      } catch (e) {
        // Mesmo que falhe, já atualizamos o perfil
        console.warn('Falha ao atualizar metadados de auth:', e);
      }

      setIsEditing(false);
      Alert.alert('Sucesso', 'Perfil atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      Alert.alert('Erro', 'Não foi possível atualizar seu perfil.');
    }
  };

  const ProfileItem = ({ icon, label, value, editable = false, keyboardType, onValueChange }: {
    icon: string;
    label: string;
    value: string;
    editable?: boolean;
    keyboardType?: any;
    onValueChange?: (text: string) => void; // atualiza ref sem re-render do pai
  }) => {
    const [localValue, setLocalValue] = useState(value || '');

    useEffect(() => {
      setLocalValue(value || '');
    }, [value]);

    const handleChange = (text: string) => {
      const newText = keyboardType === 'phone-pad' ? mask(text, '(99) 99999-9999') : text;
      setLocalValue(newText);
      onValueChange?.(newText);
    };

    return (
      <View style={styles.profileItem}>
        <View style={styles.profileItemIcon}>
          <Ionicons name={icon as any} size={20} color="#DC2626" />
        </View>
        <View style={styles.profileItemContent}>
          <Text style={styles.profileItemLabel}>{label}</Text>
          {editable && isEditing ? (
            <TextInput
              style={styles.profileItemInput}
              value={localValue}
              onChangeText={handleChange}
              keyboardType={keyboardType}
              placeholder={`Digite seu ${label.toLowerCase()}`}
              blurOnSubmit={false}
            />
          ) : (
            <Text style={styles.profileItemValue}>{value || 'Não informado'}</Text>
          )}
        </View>
      </View>
    );
  };

  const MenuOption = ({ icon, title, subtitle, onPress, danger = false }: {
    icon: string;
    title: string;
    subtitle?: string;
    onPress: () => void;
    danger?: boolean;
  }) => (
    <TouchableOpacity style={styles.menuOption} onPress={onPress}>
      <View style={[styles.menuOptionIcon, danger && styles.dangerIcon]}>
        <Ionicons
          name={icon as any}
          size={22}
          color={danger ? "#EF4444" : "#DC2626"}
        />
      </View>
      <View style={styles.menuOptionContent}>
        <Text style={[styles.menuOptionTitle, danger && styles.dangerText]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.menuOptionSubtitle}>
            {subtitle}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#F9FAFB' }]}>
      <LinearGradient
        colors={['#DC2626', '#B91C1C']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.headerContent}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <Ionicons name="person" size={48} color="white" />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                {editedName || user?.name || 'Usuário'}
              </Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
              
            </View>
          </View>
          
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={[styles.section, { backgroundColor: '#FFFFFF' }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: '#1F2937' }]}>
                Informações Pessoais
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (isEditing) {
                    // atualiza estados com os valores atuais dos inputs sem reatividade durante digitação
                    const nameCurrent = nameRef.current ?? '';
                    const phoneCurrent = phoneRef.current ?? '';
                    setEditedName(nameCurrent);
                    setEditedPhone(phoneCurrent);
                    handleSaveProfile(nameCurrent, phoneCurrent);
                  } else {
                    setIsEditing(true);
                  }
                }}
                style={[styles.editButton, { backgroundColor: '#DC2626' }]}
              >
                <Ionicons
                  name={isEditing ? 'checkmark' : 'pencil'}
                  size={16}
                  color="white"
                />
                <Text style={styles.editButtonText}>
                  {isEditing ? 'Salvar' : 'Editar'}
                </Text>
              </TouchableOpacity>
            </View>
            

  
            {/* refs para valores enquanto edita sem re-render do pai */}
            {/* atualizados via onValueChange */}
            
            
            
            <ProfileItem
              icon="person-outline"
              label="Nome"
              value={editedName}
              editable={true}
              onValueChange={(text) => { nameRef.current = text; }}
            />
            <ProfileItem
              icon="mail-outline"
              label="E-mail"
              value={user?.email || ''}
            />
            <ProfileItem
              icon="call-outline"
              label="Telefone"
              value={editedPhone}
              editable={true}
              keyboardType="phone-pad"
              onValueChange={(text) => { phoneRef.current = text; }}
            />
          </View>

          <View style={[styles.section, { backgroundColor: '#FFFFFF' }]}>
            <Text style={[styles.sectionTitle, { color: '#1F2937' }]}>
              Configurações
            </Text>
            
            <MenuOption
              icon="notifications-outline"
              title="Notificações"
              subtitle="Gerencie suas notificações"
              onPress={() => Alert.alert('Em breve', 'Funcionalidade em desenvolvimento')}
            />
            
            <MenuOption
              icon="shield-outline"
              title="Privacidade e Segurança"
              subtitle="Alterar senha e configurações de privacidade"
              onPress={() => Alert.alert('Em breve', 'Funcionalidade em desenvolvimento')}
            />

            
            <MenuOption
              icon="information-circle-outline"
              title="Sobre o App"
              subtitle="Versão 1.0.0"
              onPress={() => Alert.alert('AGTur', 'Aplicativo de passagens rodoviárias\nVersão 1.0.0')}
            />
          </View>

          <View style={[styles.section, { backgroundColor: '#FFFFFF' }]}>
            <MenuOption
              icon="log-out-outline"
              title="Sair da Conta"
              onPress={handleLogout}
              danger={true}
            />
          </View>
        </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  memberText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginVertical: 10,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  editButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  profileItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  profileItemContent: {
    flex: 1,
  },
  profileItemLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  profileItemValue: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  profileItemInput: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
    borderBottomWidth: 1,
    borderBottomColor: '#DC2626',
    paddingVertical: 4,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  dangerIcon: {
    backgroundColor: '#FEF2F2',
  },
  menuOptionContent: {
    flex: 1,
  },
  menuOptionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 2,
  },
  menuOptionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  dangerText: {
    color: '#EF4444',
  },
  // Support Section Styles
});
