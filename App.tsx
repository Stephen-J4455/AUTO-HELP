import React, { useState, useEffect } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Onboarding from './src/screens/Onboarding';
import Home from './src/screens/Home';
import Search from './src/screens/Search';
import Cart from './src/screens/Cart';
import Account from './src/screens/Account';
import Checkout from './src/screens/Checkout';
import Categories from './src/screens/Categories';
import CategoryProducts from './src/screens/CategoryProducts';
import Notifications from './src/screens/Notifications';
import BottomNav from './src/components/BottomNav';
import { useTheme } from './src/theme';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthScreen from './src/screens/AuthScreen';
import { AuthProvider, useAuth } from './src/context/Auth';
import { storage } from './src/utils/storage';
import { CartProvider } from './src/context/Cart';
import { CategoryProvider } from './src/context/Categories';

const Stack = createNativeStackNavigator();

function AppLoadingScreen() {
  const { colors } = useTheme();
  const pulse = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulse]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });
  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 1],
  });

  return (
    <View style={[loaderStyles.container, { backgroundColor: colors.background }]}>
      <Animated.View
        style={[
          loaderStyles.logoWrap,
          {
            backgroundColor: `${colors.primary}20`,
            transform: [{ scale }],
            opacity,
          },
        ]}
      >
        <Text style={[loaderStyles.logoText, { color: colors.primary }]}>AH</Text>
      </Animated.View>
      <Text style={[loaderStyles.title, { color: colors.text }]}>AUTO HELP GH</Text>
      <Text style={[loaderStyles.subtitle, { color: colors.muted }]}>Loading app...</Text>
    </View>
  );
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

  // If not logged in, show auth screen
  if (!session) {
    return (
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen name="AuthScreen" component={AuthScreen} options={{headerShown: false}}/>
          </Stack.Navigator>
        </NavigationContainer>
        <StatusBar style="dark" />
      </SafeAreaProvider>
    );
  }

  const routes = [
    { key: 'home', label: 'Home', icon: 'home', component: Home },
    { key: 'search', label: 'Search', icon: 'search', component: Search },
    { key: 'cart', label: 'Cart', icon: 'cart', component: Cart },
    { key: 'account', label: 'Account', icon: 'person', component: Account },
  ];

  return (
    <SafeAreaProvider>
      <NavigationContainer> 
        <Stack.Navigator>
          <Stack.Screen name="Main" options={{ headerShown: false }}>
            {({ navigation }) => <BottomNav routes={routes} navigation={navigation} />}
          </Stack.Screen>
          <Stack.Screen name="ProductDetails" component={require('./src/screens/ProductDetails').default} options={{ headerShown: false }} />
          <Stack.Screen name="CategoriesList" component={Categories} options={{ headerShown: false }} />
          <Stack.Screen name="CategoryProducts" component={CategoryProducts} options={{ headerShown: false }} />
          <Stack.Screen name="Notifications" component={Notifications} options={{ headerShown: false }} />
          <Stack.Screen name="Checkout" component={Checkout} options={{ title: 'Checkout' }} />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CategoryProvider>
        <CartProvider>
          <AppContent />
        </CartProvider>
      </CategoryProvider>
    </AuthProvider>
  );
}

const loaderStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  logoWrap: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 26,
    fontWeight: '900',
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
  },
});
