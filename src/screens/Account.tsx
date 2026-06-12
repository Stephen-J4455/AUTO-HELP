import React from 'react';
import { View, Text, StyleSheet,Pressable } from 'react-native';
import { useTheme } from '../theme';
import AuthScreen from '../screens/AuthScreen';
import { useNavigation, NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';


export default function Account() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const screen = AuthScreen;

function goToLogin() {
  navigation.navigate('AuthScreen' as never);
}
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <Text style={[styles.text, { color: colors.text }]}> Login or Create Account</Text>
      <Pressable style={[styles.loginbutton, { backgroundColor: colors.primary }]} onPress={goToLogin} >
        <Text style={{ color: colors.surface }}>Go to Login</Text>
        
      </Pressable>
    </View>
  );
}
 
const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  text: { fontSize: 18 },
  loginbutton: { marginTop: 20, padding: 12, borderRadius: 30 },
});
