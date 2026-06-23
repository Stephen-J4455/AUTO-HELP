import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import Onboarding from './src/screens/Onboarding';
import Home from './src/screens/Home';
import Search from './src/screens/Search';
import Cart from './src/screens/Cart';
import Account from './src/screens/Account';
import BottomNav from './src/components/BottomNav';
import { useTheme } from './src/theme';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthScreen from './src/screens/AuthScreen';
import { AuthProvider, useAuth } from './src/context/Auth';
import { storage } from './src/utils/storage';
import { CartProvider } from './src/context/Cart';

const Stack = createNativeStackNavigator();

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
    return null; // or a loading screen
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
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <AppContent />
      </CartProvider>
    </AuthProvider>
  );
}

