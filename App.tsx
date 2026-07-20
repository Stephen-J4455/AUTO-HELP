import React, { useState, useEffect } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Onboarding from './src/screens/Onboarding';
import Home from './src/screens/Home';
import Search from './src/screens/Search';
import Cart from './src/screens/Cart';
import Vehicle from './src/screens/Vehicle';
import Account from './src/screens/Account';
import Orders from './src/screens/Orders';
import OrderDetails from './src/screens/OrderDetails';
import Checkout from './src/screens/Checkout';
import Categories from './src/screens/Categories';
import CategoryProducts from './src/screens/CategoryProducts';
import Notifications from './src/screens/Notifications';
import VehicleParts from './src/screens/VehicleParts';
import BottomNav from './src/components/BottomNav';
import { useTheme } from './src/theme';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthScreen from './src/screens/AuthScreen';
import { AuthProvider, useAuth } from './src/context/Auth';
import { storage } from './src/utils/storage';
import { CartProvider } from './src/context/Cart';
import { CategoryProvider } from './src/context/Categories';
import { AppAlertProvider } from './src/components/AppAlert';
import { addPushNotificationListeners, registerAndSaveToken } from './src/utils/pushNotifications';

const Stack = createNativeStackNavigator();

function AppLoadingScreen() {
  const { colors } = useTheme();
  const spin = React.useRef(new Animated.Value(0)).current;
  const pulse = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [spin, pulse]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const scale = pulse.interpolate({
    inputRange: [0.4, 1],
    outputRange: [0.96, 1.04],
  });

  return (
    <View style={[loaderStyles.container, { backgroundColor: colors.background }]}>
      <View style={[loaderStyles.brandRow, { backgroundColor: colors.surface }]}>
        <Text style={[loaderStyles.brand, { color: colors.text }]}>AUTO HELP</Text>
        <View style={[loaderStyles.brandBadge, { backgroundColor: colors.primary }]}>
          <Text style={loaderStyles.brandBadgeText}>GH</Text>
        </View>
      </View>

      <View style={loaderStyles.logoWrap}>
        <Animated.View
          style={[
            loaderStyles.ring,
            { borderColor: `${colors.primary}33`, borderTopColor: colors.primary, transform: [{ rotate }] },
          ]}
        />
        <Animated.View
          style={[
            loaderStyles.innerGlow,
            { backgroundColor: `${colors.primary}20`, transform: [{ scale }] },
          ]}
        >
          <Image
            source={require('./assets/icon.png')}
            style={loaderStyles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      <Text style={[loaderStyles.title, { color: colors.text }]}>AUTO HELP GH</Text>
      <Text style={[loaderStyles.subtitle, { color: colors.muted }]}>
        Trusted auto parts marketplace
      </Text>

      <View style={[loaderStyles.progressTrack, { backgroundColor: `${colors.primary}1F` }]}>
        <Animated.View
          style={[loaderStyles.progressBar, { backgroundColor: colors.primary, transform: [{ scaleX: pulse }] }]}
        />
      </View>
      <Text style={[loaderStyles.loadingText, { color: colors.muted }]}>Loading app…</Text>
    </View>
  );
}

/**
 * Registers the device for push notifications once a user is signed in, and
 * deep-links to the Notifications screen when a notification is tapped.
 */
function PushInit() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();

  React.useEffect(() => {
    let cleanup: (() => void) | undefined;
    (async () => {
      await registerAndSaveToken(user?.id);
      cleanup = addPushNotificationListeners(() => {
        navigation.navigate('Notifications');
      });
    })();
    return () => {
      cleanup?.();
    };
  }, [user?.id, navigation]);

  return null;
}

function AppContent() {
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [onboardingLoaded, setOnboardingLoaded] = useState(false);
  const { scheme } = useTheme();
  const { session, loading } = useAuth();

  // Load onboarding status from storage on mount
  useEffect(() => {
    const loadOnboardingStatus = async () => {
      try {
        const completed = await storage.getItem("onboarding_completed");
        if (completed === "true") {
          setShowOnboarding(false);
        }
      } catch (error) {
        console.error("Error loading onboarding status:", error);
      } finally {
        setOnboardingLoaded(true);
      }
    };

    loadOnboardingStatus();
  }, []);

  // Save onboarding status when completed
  const handleOnboardingFinish = async () => {
    try {
      await storage.setItem("onboarding_completed", "true");
      setShowOnboarding(false);
    } catch (error) {
      console.error("Error saving onboarding status:", error);
    }
  };

  if (!onboardingLoaded || loading) {
    return <AppLoadingScreen />;
  }

  if (showOnboarding) {
    return (
      <SafeAreaProvider>
        <Onboarding onFinish={handleOnboardingFinish} />
      </SafeAreaProvider>
    );
  }

  // Content is shown to everyone; the Account screen handles the logged-out state.
  const routes = [
    { key: 'home', label: 'Home', icon: 'home', component: Home },
    { key: 'search', label: 'Search', icon: 'search', component: Search },
    { key: 'vehicle', label: 'Vehicle', icon: 'car-sport', component: Vehicle },
    { key: 'cart', label: 'Cart', icon: 'cart', component: Cart },
    { key: 'account', label: 'Account', icon: 'person', component: Account },
  ];

  return (
    <SafeAreaProvider>
      <NavigationContainer> 
        <PushInit />
        <Stack.Navigator>
          <Stack.Screen name="Main" options={{ headerShown: false }}>
            {({ navigation }) => <BottomNav routes={routes} navigation={navigation} />}
          </Stack.Screen>
          <Stack.Screen name="ProductDetails" component={require('./src/screens/ProductDetails').default} options={{ headerShown: false }} />
          <Stack.Screen name="CategoriesList" component={Categories} options={{ headerShown: false }} />
          <Stack.Screen name="CategoryProducts" component={CategoryProducts} options={{ headerShown: false }} />
          <Stack.Screen name="VehicleParts" component={VehicleParts} options={{ headerShown: false }} />
          <Stack.Screen name="Notifications" component={Notifications} options={{ headerShown: false }} />
          <Stack.Screen name="Orders" component={Orders} options={{ title: 'My Orders' }} />
          <Stack.Screen name="OrderDetails" component={OrderDetails} options={{ headerShown: false }} />
          <Stack.Screen name="Checkout" component={Checkout} options={{ title: 'Checkout' }} />
          <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <AppAlertProvider>
      <AuthProvider>
        <CategoryProvider>
          <CartProvider>
            <AppContent />
          </CartProvider>
        </CategoryProvider>
      </AuthProvider>
    </AppAlertProvider>
  );
}

const loaderStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  brandRow: {
    position: 'absolute',
    top: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  brand: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  brandBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  brandBadgeText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  logoWrap: {
    width: 132,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  ring: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 4,
  },
  innerGlow: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 72,
    height: 72,
    borderRadius: 50,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressTrack: {
    width: '70%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressBar: {
    flex: 1,
    borderRadius: 3,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
