import React, { useState, useEffect } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
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
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthScreen from './src/screens/AuthScreen';
import ForgotPassword from './src/screens/ForgotPassword';
import UpdatePassword from './src/screens/UpdatePassword';
import LegalScreen from './src/screens/LegalScreen';
import { AuthProvider, useAuth } from './src/context/Auth';
import { storage } from './src/utils/storage';
import { CartProvider } from './src/context/Cart';
import { CategoryProvider } from './src/context/Categories';
import { AppAlertProvider } from './src/components/AppAlert';
import LoadingScreen from './src/components/LoadingScreen';
import { addPushNotificationListeners, registerAndSaveToken } from './src/utils/pushNotifications';
import { PopupAd, FullscreenAd } from './src/utils/remoteContent';
import ChatBotLauncher from './src/components/ChatBotLauncher';
import { fetchUpdateDecision, UpdateDecision } from './src/utils/updateCheck';
import UpdateGate from './src/screens/UpdateGate';
import { navigationRef } from './src/utils/navigation';

// Lets the Account screen toggle whether the floating chat assistant is shown.
export const ChatFabContext = React.createContext<{
  hidden: boolean;
  setHidden: (value: boolean) => void;
}>({ hidden: false, setHidden: () => {} });

const FAB_HIDDEN_KEY = 'chatbot_fab_hidden';
const Stack = createNativeStackNavigator();

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
  const { session, loading, recoveryMode } = useAuth();

  // Check the admin-controlled `app_updates` table once the app is ready,
  // so we can show maintenance / force-update / optional-update prompts.
  const [updateDecision, setUpdateDecision] = React.useState<UpdateDecision | null>(null);
  React.useEffect(() => {
    if (onboardingLoaded && !loading) {
      void fetchUpdateDecision().then(setUpdateDecision).catch(() => setUpdateDecision({ kind: "none" }));
    }
  }, [onboardingLoaded, loading]);

  // Track the active tab + current stack screen so we can decide whether to
  // show the floating chat assistant. Must be declared before any early
  // return to comply with the Rules of Hooks. It should only appear on the
  // home, search, cart and account tabs (and not on other stacked screens).
  const [activeTab, setActiveTab] = useState('home');
  const [currentRouteName, setCurrentRouteName] = useState('Main');
  const [chatFabHidden, setChatFabHiddenState] = useState(false);
  const TABS_WITH_CHAT = ['home', 'search', 'cart', 'account'];

  // Load the user's preference for hiding the chat FAB from storage.
  React.useEffect(() => {
    void storage.getItem(FAB_HIDDEN_KEY).then((v) => {
      if (v === 'true') setChatFabHiddenState(true);
    });
  }, []);

  const setChatFabHidden = React.useCallback((value: boolean) => {
    setChatFabHiddenState(value);
    void storage.setItem(FAB_HIDDEN_KEY, value ? 'true' : 'false');
  }, []);

  // Fired on every navigation state change; reliably reflects the focused
  // stack route so we can hide the FAB on non-main screens.
  const handleNavigationStateChange = React.useCallback(() => {
    setCurrentRouteName(navigationRef.current?.getCurrentRoute()?.name ?? 'Main');
  }, []);

  const showChat =
    currentRouteName === 'Main' &&
    TABS_WITH_CHAT.includes(activeTab) &&
    !chatFabHidden;

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
    return <LoadingScreen />;
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

  // Content is shown to everyone; the Account screen handles the logged-out state.
  const routes = [
    { key: 'home', label: 'Home', icon: 'home', component: Home },
    { key: 'search', label: 'Search', icon: 'search', component: Search },
    { key: 'vehicle', label: 'Vehicle', icon: 'car-sport', component: Vehicle },
    { key: 'cart', label: 'Cart', icon: 'cart', component: Cart },
    { key: 'account', label: 'Account', icon: 'person', component: Account },
  ];

  return (
       <ChatFabContext.Provider value={{ hidden: chatFabHidden, setHidden: setChatFabHidden }}>
       <SafeAreaProvider>
         <NavigationContainer ref={navigationRef} onStateChange={handleNavigationStateChange}>
        <PushInit />
        <Stack.Navigator>
          <Stack.Screen name="Main" options={{ headerShown: false }}>
            {({ navigation }) => (
              <BottomNav
                routes={routes}
                navigation={navigation}
                active={activeTab}
                onActiveChange={setActiveTab}
              />
            )}
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
          <Stack.Screen name="ForgotPassword" component={ForgotPassword} options={{ headerShown: false }} />
          <Stack.Screen name="UpdatePassword" component={UpdatePassword} options={{ headerShown: false }} />
          <Stack.Screen name="PrivacyPolicy" options={{ headerShown: false }}>
            {({ navigation }) => <LegalScreen navigation={navigation} route={{ params: { type: 'privacy' } }} />}
          </Stack.Screen>
          <Stack.Screen name="Terms" options={{ headerShown: false }}>
            {({ navigation }) => <LegalScreen navigation={navigation} route={{ params: { type: 'terms' } }} />}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
       <FullscreenAd />
       <PopupAd />
       {showChat ? <ChatBotLauncher /> : null}
       <StatusBar style="dark" />
    </SafeAreaProvider>
    </ChatFabContext.Provider>
  );
}

export default function App() {
  return (
    <KeyboardProvider>
      <AppAlertProvider>
        <AuthProvider>
          <CategoryProvider>
            <CartProvider>
              <AppContent />
            </CartProvider>
          </CategoryProvider>
        </AuthProvider>
      </AppAlertProvider>
    </KeyboardProvider>
  );
}
