import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  navigation?: any;
  route?: any;
};

const CONTENT: Record<string, { title: string; updated: string; sections: { heading: string; body: string }[] }> = {
  privacy: {
    title: 'Privacy Policy',
    updated: 'Last updated: January 2026',
    sections: [
      {
        heading: 'Information we collect',
        body: 'We collect information you provide directly, such as your name, email address, phone number, delivery address, and order history. We also collect device and usage information to keep the app secure and improve your experience.',
      },
      {
        heading: 'How we use your information',
        body: 'We use your information to process orders, provide customer support, send order and account notifications, and comply with legal obligations. We do not sell your personal data to third parties.',
      },
      {
        heading: 'Notifications & messages',
        body: 'With your permission, we send push notifications about order status, promotions, and account activity. You can disable push alerts at any time from the Account screen.',
      },
      {
        heading: 'Data retention & security',
        body: 'We retain your data for as long as your account is active or as needed to provide our services. We use reasonable administrative and technical safeguards to protect your information.',
      },
      {
        heading: 'Your rights',
        body: 'You may request access to, correction of, or deletion of your personal data by contacting support@autohelpgh.com. We will respond in accordance with applicable law.',
      },
      {
        heading: 'Contact',
        body: 'Questions about this policy can be sent to support@autohelpgh.com or via the support options in the Account screen.',
      },
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    updated: 'Last updated: January 2026',
    sections: [
      {
        heading: 'Acceptance of terms',
        body: 'By accessing or using Auto Help GH, you agree to be bound by these Terms & Conditions and our Privacy Policy. If you do not agree, please do not use the app.',
      },
      {
        heading: 'Accounts',
        body: 'You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You must provide accurate information when creating an account.',
      },
      {
        heading: 'Orders & payments',
        body: 'All orders are subject to availability and acceptance. Prices are listed in Ghana Cedis and are inclusive of applicable taxes unless stated otherwise. Payments are processed securely through our payment partners.',
      },
      {
        heading: 'Shipping & delivery',
        body: 'Delivery times are estimates and not guarantees. Risk of loss passes to you upon delivery. Additional delivery fees may apply and are shown at checkout.',
      },
      {
        heading: 'Returns & refunds',
        body: 'Eligible products may be returned in accordance with our return policy. Refunds are issued to the original payment method after inspection and approval.',
      },
      {
        heading: 'Limitation of liability',
        body: 'Auto Help GH is provided "as is" without warranties of any kind. To the fullest extent permitted by law, we are not liable for indirect or consequential damages arising from your use of the app.',
      },
    ],
  },
};

export default function LegalScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const type = route?.params?.type === 'terms' ? 'terms' : 'privacy';
  const data = CONTENT[type];

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.surface }]}
          onPress={() => navigation?.goBack?.()}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {data.title}
          </Text>
          <Text style={[styles.updated, { color: colors.muted }]}>{data.updated}</Text>
        </View>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {data.sections.map((section, idx) => (
          <View key={idx} style={styles.section}>
            <Text style={[styles.heading, { color: colors.text }]}>{section.heading}</Text>
            <Text style={[styles.body, { color: colors.muted }]}>{section.body}</Text>
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 24, fontWeight: '900' },
  updated: { fontSize: 12, marginTop: 2 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  section: { marginBottom: 18 },
  heading: { fontSize: 15, fontWeight: '800', marginBottom: 6 },
  body: { fontSize: 14, fontWeight: '500', lineHeight: 21 },
});