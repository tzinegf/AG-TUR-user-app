import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useColorScheme } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { router } from 'expo-router';

export default function SupportScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <LinearGradient
        colors={['#DC2626', '#B91C1C']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ajuda e Suporte</Text>
          <View style={styles.placeholder} />
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Welcome Section */}
        <View style={[styles.section, { backgroundColor: colors.background }]}>
          <View style={styles.welcomeHeader}>
            <Ionicons name="help-circle" size={48} color="#DC2626" />
            <Text style={[styles.welcomeTitle, { color: colors.text }]}>
              Como podemos ajudar?
            </Text>
            <Text style={[styles.welcomeSubtitle, { color: colors.text }]}>
              Estamos aqui para resolver suas dúvidas e problemas
            </Text>
          </View>
        </View>

        {/* Contact Options */}
        <View style={[styles.section, { backgroundColor: colors.background }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Entre em Contato
          </Text>
          
          <View style={styles.contactOptions}>
            {/* WhatsApp */}
            <TouchableOpacity 
              style={[styles.contactOption, { backgroundColor: colors.card }]}
              onPress={() => {
                const whatsappUrl = `whatsapp://send?phone=5511999887766&text=Olá! Preciso de ajuda com o aplicativo AG TUR.`;
                Alert.alert(
                  'WhatsApp Business',
                  'Você será redirecionado para o WhatsApp para falar conosco. Nossa equipe está disponível de segunda a sexta, das 8h às 18h.',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Abrir WhatsApp', onPress: () => console.log('Abrir WhatsApp:', whatsappUrl) }
                  ]
                );
              }}
            >
              <View style={[styles.contactIconContainer, { backgroundColor: '#25D366' }]}>
                <Ionicons name="logo-whatsapp" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.contactInfo}>
                <Text style={[styles.contactTitle, { color: colors.text }]}>WhatsApp Business</Text>
                <Text style={[styles.contactSubtitle, { color: colors.text }]}>(11) 99988-7766</Text>
                <Text style={[styles.contactDescription, { color: colors.text }]}>
                  Atendimento rápido e personalizado
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </TouchableOpacity>

            {/* Email */}
            <TouchableOpacity 
              style={[styles.contactOption, { backgroundColor: colors.card }]}
              onPress={() => {
                Alert.alert(
                  'E-mail de Suporte',
                  'Envie um e-mail para: suporte@agtur.com.br\n\nNossa equipe responde em até 24 horas.',
                  [
                    { text: 'OK' },
                    { text: 'Copiar E-mail', onPress: () => Alert.alert('E-mail copiado!', 'suporte@agtur.com.br foi copiado para a área de transferência.') }
                  ]
                );
              }}
            >
              <View style={[styles.contactIconContainer, { backgroundColor: '#DC2626' }]}>
                <Ionicons name="mail" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.contactInfo}>
                <Text style={[styles.contactTitle, { color: colors.text }]}>E-mail</Text>
                <Text style={[styles.contactSubtitle, { color: colors.text }]}>suporte@agtur.com.br</Text>
                <Text style={[styles.contactDescription, { color: colors.text }]}>
                  Resposta em até 24 horas
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </TouchableOpacity>

            {/* Phone */}
            <TouchableOpacity 
              style={[styles.contactOption, { backgroundColor: colors.card }]}
              onPress={() => {
                Alert.alert(
                  'Telefone Principal',
                  'Ligue para: (11) 3456-7890\n\nHorário de atendimento:\nSegunda a Sexta: 8h às 18h\nSábado: 8h às 14h',
                  [
                    { text: 'OK' },
                    { text: 'Ligar Agora', onPress: () => console.log('Ligar para: (11) 3456-7890') }
                  ]
                );
              }}
            >
              <View style={[styles.contactIconContainer, { backgroundColor: '#059669' }]}>
                <Ionicons name="call" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.contactInfo}>
                <Text style={[styles.contactTitle, { color: colors.text }]}>Telefone</Text>
                <Text style={[styles.contactSubtitle, { color: colors.text }]}>(11) 3456-7890</Text>
                <Text style={[styles.contactDescription, { color: colors.text }]}>
                  Seg-Sex: 8h-18h | Sáb: 8h-14h
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* FAQ Section */}
        <View style={[styles.section, { backgroundColor: colors.background }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Perguntas Frequentes
          </Text>
          
          <View style={styles.faqContainer}>
            <TouchableOpacity style={[styles.faqItem, { backgroundColor: colors.card }]}>
              <Text style={[styles.faqQuestion, { color: colors.text }]}>
                Como cancelar uma passagem?
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.faqItem, { backgroundColor: colors.card }]}>
              <Text style={[styles.faqQuestion, { color: colors.text }]}>
                Como alterar dados da passagem?
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.faqItem, { backgroundColor: colors.card }]}>
              <Text style={[styles.faqQuestion, { color: colors.text }]}>
                Política de bagagem
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.faqItem, { backgroundColor: colors.card }]}>
              <Text style={[styles.faqQuestion, { color: colors.text }]}>
                Como funciona o reembolso?
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Feedback Section */}
        <View style={[styles.section, { backgroundColor: colors.background }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Sua Opinião
          </Text>
          
          <TouchableOpacity 
            style={[styles.feedbackButton, { backgroundColor: '#DC2626' }]}
            onPress={() => {
              Alert.prompt(
                'Críticas e Sugestões',
                'Sua opinião é muito importante para nós! Compartilhe suas críticas, sugestões ou elogios:',
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { 
                    text: 'Enviar', 
                    onPress: (text?: string) => {
                      if (text && text.trim()) {
                        Alert.alert(
                          'Obrigado!', 
                          'Seu feedback foi enviado com sucesso. Nossa equipe analisará sua mensagem e retornará em breve.'
                        );
                      }
                    }
                  }
                ],
                'plain-text',
                '',
                'default'
              );
            }}
          >
            <Ionicons name="chatbubble-ellipses" size={24} color="#FFFFFF" />
            <Text style={styles.feedbackButtonText}>Enviar Críticas e Sugestões</Text>
          </TouchableOpacity>
        </View>

        {/* Emergency Contact */}
        <View style={[styles.section, { backgroundColor: colors.background }]}>
          <View style={styles.emergencyContainer}>
            <Ionicons name="warning" size={24} color="#EAB308" />
            <View style={styles.emergencyInfo}>
              <Text style={[styles.emergencyTitle, { color: colors.text }]}>
                Emergência na Viagem?
              </Text>
              <Text style={[styles.emergencySubtitle, { color: colors.text }]}>
                Ligue para: (11) 99999-0000 (24h)
              </Text>
            </View>
          </View>
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
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
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
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginVertical: 10,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  welcomeHeader: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  contactOptions: {
    gap: 12,
  },
  contactOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  contactIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  contactInfo: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  contactSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  contactDescription: {
    fontSize: 12,
    opacity: 0.7,
  },
  faqContainer: {
    gap: 8,
  },
  faqItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
  },
  faqQuestion: {
    fontSize: 16,
    flex: 1,
  },
  feedbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 12,
  },
  feedbackButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emergencyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)',
  },
  emergencyInfo: {
    marginLeft: 12,
    flex: 1,
  },
  emergencyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  emergencySubtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
});