import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import Onboarding from './src/screens/Onboarding';
import Home from './src/screens/Home';
import Search from './src/screens/Search';
import Cart from './src/screens/Cart';
import Account from './src/screens/Account';
import BottomNav from './src/components/BottomNav';
import { useTheme } from './src/theme';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useNavigation, NavigationContainer, StackActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthScreen from './src/screens/AuthScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [showOnboarding, setShowOnboarding] = useState(true);
  const { scheme } = useTheme();

  if (showOnboarding) {
    return (
      <SafeAreaProvider>
        <Onboarding onFinish={() => setShowOnboarding(false)} />
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
          <Stack.Screen name="Main" options={{ headerShown: false }} >
            {() => <BottomNav routes={routes} />}
          </Stack.Screen>
          <Stack.Screen name="AuthScreen" component={AuthScreen}  options={{headerShown: false}}/>
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style={scheme === 'dark' ? 'light' : 'light'} />
    </SafeAreaProvider>
  );
}

