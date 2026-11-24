import React, { useState, useEffect } from 'react';
import { Platform, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import Onboarding from './src/screens/Onboarding';
import BottomNav from './src/components/BottomNav';
import { useTheme } from './src/theme';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { DarkTheme, DefaultTheme, NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import UpdatePassword from './src/screens/UpdatePassword';
import LegalScreen from './src/screens/LegalScreen';
import { AuthProvider, useAuth } from './src/context/Auth';
import { storage } from './src/utils/storage';
import { CartProvider } from './src/context/Cart';
import { CategoryProvider } from './src/context/Categories';
import { AppAlertProvider } from './src/components/AppAlert';
import StartupSplash from './src/components/StartupSplash';
import { addPushNotificationListeners, registerAndSaveToken } from './src/utils/pushNotifications';
import { PopupAd, FullscreenAd } from './src/utils/remoteContent';
import { fetchUpdateDecision, UpdateDecision } from './src/utils/updateCheck';
import UpdateGate from './src/screens/UpdateGate';
import { useReduceMotion } from './src/utils/useReduceMotion';
import { ChallengeVisibilityContext, useChallengeVisibility } from './src/features/challenge/visibility';

const STARTUP_REQUEST_TIMEOUT_MS = 8000;
const Stack = createNativeStackNavigator();
const routes = [
  { key: 'home', label: 'Home', icon: 'home', getComponent: () => require('./src/screens/Home').default },
  { key: 'vehicle', label: 'Vehicle', icon: 'car-sport', getComponent: () => require('./src/screens/Vehicle').default },
  { key: 'assistant', label: 'AI Assistant', icon: 'sparkles', getComponent: () => require('./src/components/ChatBot').default },
  { key: 'cart', label: 'Cart', icon: 'cart', getComponent: () => require('./src/screens/Cart').default },
  { key: 'account', label: 'Account', icon: 'person', getComponent: () => require('./src/screens/Account').default },
];

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

function AppContent({ startupComplete, onStartupReady }: { startupComplete: boolean; onStartupReady: () => void }) {
  const challengeVisibility = useChallengeVisibility();
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [onboardingLoaded, setOnboardingLoaded] = useState(false);
  const { colors, scheme } = useTheme();
  const reducedMotion = useReduceMotion();
  const { loading, recoveryMode } = useAuth();
  const navigationTheme = React.useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
      },
    };
  }, [colors, scheme]);

  // Check the admin-controlled `app_updates` table once the app is ready,
  // so we can show maintenance / force-update / optional-update prompts.
  const [updateDecision, setUpdateDecision] = React.useState<UpdateDecision | null>(null);
  React.useEffect(() => {
    if (!onboardingLoaded) return;
    const request = new AbortController();
    let active = true;
    const timer = setTimeout(() => request.abort(), STARTUP_REQUEST_TIMEOUT_MS);
    void fetchUpdateDecision(request.signal)
      .catch(() => ({ kind: 'none' } as const))
      .then((decision) => { if (active) setUpdateDecision(decision); })
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      clearTimeout(timer);
      request.abort();
    };
  }, [onboardingLoaded]);

  const [homeReady, setHomeReady] = useState(false);
  const onHomeReady = React.useCallback(() => setHomeReady(true), []);
  const canRender = onboardingLoaded && !loading && (showOnboarding || recoveryMode || updateDecision !== null);
  const waitingForHome = canRender && !showOnboarding && !recoveryMode && updateDecision?.kind === 'none' && !homeReady;

  useEffect(() => {
    if (startupComplete || !waitingForHome) return;
    const timer = setTimeout(onHomeReady, STARTUP_REQUEST_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [startupComplete, waitingForHome, onHomeReady]);

  useEffect(() => {
    if (startupComplete || !canRender || waitingForHome) return;
    const frame = requestAnimationFrame(onStartupReady);
    return () => cancelAnimationFrame(frame);
  }, [startupComplete, canRender, waitingForHome, onStartupReady]);

  const [activeTab, setActiveTab] = useState('home');

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

  if (!canRender && !startupComplete) {
    return null;
  }

  if (showOnboarding) {
    return (
      <SafeAreaProvider>
        <Onboarding onFinish={handleOnboardingFinish} />
      </SafeAreaProvider>
    );
  }

  // When the user opens a password-reset link from their email, Supabase opens
  // the app with a short-lived recovery session. Show the "set new password"
  // screen instead of dropping them straight into the app.
  if (recoveryMode) {
    return (
      <SafeAreaProvider>
        <UpdatePassword />
        <StatusBar style="dark" />
      </SafeAreaProvider>
    );
  }

  // Block or prompt the user based on the admin's update configuration.
  if (updateDecision && updateDecision.kind !== "none") {
    return (
      <SafeAreaProvider>
        <UpdateGate
          decision={updateDecision}
          onDismiss={() => setUpdateDecision({ kind: "none" })}
        />
        <StatusBar style="dark" />
      </SafeAreaProvider>
    );
  }

  return (
       <ChallengeVisibilityContext.Provider value={challengeVisibility}>
       <SafeAreaProvider>
         <NavigationContainer theme={navigationTheme}>
        <PushInit />
        <Stack.Navigator screenOptions={{
          headerShadowVisible: false,
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '800' },
          contentStyle: { backgroundColor: colors.background },
          animation: reducedMotion ? 'none' : 'fade_from_bottom',
          animationDuration: 180,
        }}>
          <Stack.Screen name="Main" options={{ headerShown: false }}>
            {({ navigation }) => (
              <BottomNav
                routes={routes}
                navigation={navigation}
                active={activeTab}
                onActiveChange={setActiveTab}
                onHomeReady={onHomeReady}
                reducedMotion={reducedMotion}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="Search" getComponent={() => require('./src/screens/Search').default} options={{ headerShown: false }} />
          <Stack.Screen name="ProductDetails" getComponent={() => require('./src/screens/ProductDetails').default} options={{ headerShown: false }} />
          {challengeVisibility.enabled && <Stack.Screen name="Challenge" getComponent={() => require('./src/screens/Challenge').default} options={{ headerShown: false }} />}
          <Stack.Screen name="CategoriesList" getComponent={() => require('./src/screens/Categories').default} options={{ headerShown: false }} />
          <Stack.Screen name="CategoryProducts" getComponent={() => require('./src/screens/CategoryProducts').default} options={{ headerShown: false }} />
          <Stack.Screen name="VehicleParts" getComponent={() => require('./src/screens/VehicleParts').default} options={{ headerShown: false }} />
          <Stack.Screen name="Notifications" getComponent={() => require('./src/screens/Notifications').default} options={{ headerShown: false }} />
          <Stack.Screen name="Orders" getComponent={() => require('./src/screens/Orders').default} options={{ title: 'My Orders' }} />
          <Stack.Screen name="OrderDetails" getComponent={() => require('./src/screens/OrderDetails').default} options={{ headerShown: false }} />
          <Stack.Screen name="Checkout" getComponent={() => require('./src/screens/Checkout').default} options={{ title: 'Checkout' }} />
          <Stack.Screen name="Auth" getComponent={() => require('./src/screens/AuthScreen').default} options={{ headerShown: false }} />
          <Stack.Screen name="ForgotPassword" getComponent={() => require('./src/screens/ForgotPassword').default} options={{ headerShown: false }} />
          <Stack.Screen name="UpdatePassword" component={UpdatePassword} options={{ headerShown: false }} />
          <Stack.Screen name="PrivacyPolicy" options={{ headerShown: false }}>
            {({ navigation }) => <LegalScreen navigation={navigation} route={{ params: { type: 'privacy' } }} />}
          </Stack.Screen>
          <Stack.Screen name="Terms" options={{ headerShown: false }}>
            {({ navigation }) => <LegalScreen navigation={navigation} route={{ params: { type: 'terms' } }} />}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
       {startupComplete && <FullscreenAd />}
       {startupComplete && <PopupAd />}
       <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </SafeAreaProvider>
    </ChallengeVisibilityContext.Provider>
  );
}

export default function App() {
  const [startupComplete, setStartupComplete] = useState(false);
  const finishStartup = React.useCallback(() => {
    setStartupComplete(true);
    SplashScreen.hide();
  }, []);

  return (
    <KeyboardProvider>
      <AppAlertProvider>
        <AuthProvider>
          <CategoryProvider>
            <CartProvider>
              <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
                <AppContent startupComplete={startupComplete} onStartupReady={finishStartup} />
                {Platform.OS === 'web' && !startupComplete && <StartupSplash />}
              </View>
            </CartProvider>
          </CategoryProvider>
        </AuthProvider>
      </AppAlertProvider>
    </KeyboardProvider>
  );
}
