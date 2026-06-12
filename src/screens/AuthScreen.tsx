import React from "react";
import { View, Text, StyleSheet,Pressable } from "react-native";
import { useTheme } from "../theme";

export default function AuthScreen() {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <Text style={[styles.text, { color: colors.text }]}> This is the Auth Screen</Text>
    </View>
  );
}
 
const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  text: { fontSize: 18 },
  loginbutton: { marginTop: 20, padding: 12, borderRadius: 30 },
});