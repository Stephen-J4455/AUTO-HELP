import React from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, Image, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import {Ionicons} from '@expo/vector-icons';
import { useFonts } from 'expo-font';

const { width } = Dimensions.get('window');

const categories = [
  { id: '1', title: 'Brakes', image: require('../../assets/onboarding/bmw1.jpg') },
  { id: '2', title: 'Filters', image: require('../../assets/onboarding/bmw2.jpg') },
  { id: '3', title: 'Suspension', image: require('../../assets/onboarding/bmw3.jpg') },
  { id: '4', title: 'Lighting', image: require('../../assets/onboarding/bmw4.jpg') },
];

const featured = [
  { id: 'f1', name: 'Brake Pad Set', price: '$79.99', image: require('../../assets/onboarding/bmw1.jpg') },
  { id: 'f2', name: 'Air Filter', price: '$19.99', image: require('../../assets/onboarding/bmw2.jpg') },
  { id: 'f3', name: 'Headlight', price: '$129.00', image: require('../../assets/onboarding/bmw3.jpg') },
];

export default function Home() {
  const { colors } = useTheme();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={[styles.brand, { color: colors.text }]}>
            AUTO HELP GH
          </Text>
          <TouchableOpacity
            style={styles.notificationBtn}
            activeOpacity={0.75}
            onPress={() => {
              /* TODO: open notifications */
            }}
          >
            <Ionicons
              name="notifications-outline"
              size={22}
              color={colors.muted}
            />
          </TouchableOpacity>
        </View>
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: colors.surface, color: colors.text },
          ]}
        >
          <Ionicons
            name="search"
            size={20}
            color={colors.muted}
            style={{ marginRight: 8 }}
          />
          <TextInput
            style={styles.search}
            placeholder="Search parts, VIN, SKU..."
            placeholderTextColor="#999"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Categories
        </Text>
        <FlatList
          data={categories}
          horizontal
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.categoryItem} activeOpacity={0.8}>
              <Image source={item.image} style={styles.categoryImage} />
              <Text style={[styles.categoryText, { color: colors.muted }]}>
                {item.title}
              </Text>
            </TouchableOpacity>
          )}
          showsHorizontalScrollIndicator={false}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Featured
        </Text>
        <FlatList
          data={featured}
          horizontal
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Image source={item.image} style={styles.cardImage} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {item.name}
              </Text>
              <Text style={[styles.cardPrice, { color: colors.primary }]}>
                {item.price}
              </Text>
            </View>
          )}
          showsHorizontalScrollIndicator={false}
        />
      </View>
      {/*auto part feed */}
      <View style={styles.feed}>
        <Text style={[styles.feedTitle, { color: colors.text }]}>
          Latest Parts
        </Text>
        {/* Placeholder for feed items */}
        <View style={styles.emptystate}>
          <Ionicons name="car-sport" size={48} color={colors.muted} />
          <Text style={[styles.feedItem, { color: colors.text }]}>
            No new parts available.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16 },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  notificationBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  brand: { fontSize: 28, fontWeight: "800", marginBottom: 8 },
  search: { padding: 18, borderRadius: 8 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 30,
    paddingHorizontal: 12,
   
  },
  section: { marginTop: 18, paddingLeft: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  categoryItem: { marginRight: 12, width: 100, alignItems: "center" },
  categoryImage: { width: 100, height: 60, borderRadius: 6, marginBottom: 6 },
  categoryText: {},
  card: { marginRight: 12, width: width * 0.6, borderRadius: 8, padding: 8 },
  cardImage: { width: "100%", height: 120, borderRadius: 6 },
  cardTitle: { marginTop: 8, fontWeight: "700" },
  cardPrice: { marginTop: 4, fontWeight: "800" },
  feed: { marginTop: 24, paddingHorizontal: 16 },
  feedTitle: { fontSize: 18, fontWeight: "700" },
  feedItem: { marginTop: 8, fontSize: 14 },
  emptystate: { marginTop: 16, alignItems: "center", justifyContent: "center" },
});
