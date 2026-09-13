import React from "react";
import { View, Text, StyleSheet, Pressable, Image, TextInput, ImageBackground, ActivityIndicator } from "react-native";
import { useTheme } from "../theme";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/Auth";
import { useAppAlert } from "../components/AppAlert";

export default function UpdatePassword() {
  const { colors } = useTheme();
  const { updatePassword } = useAuth();
  const { show: showAlert } = useAppAlert();

  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const handleUpdate = async () => {
    if (!password || !confirm) {
      showAlert({ title: "Error", message: "Please fill in both fields" });
      return;
    }
    if (password.length < 6) {
      showAlert({ title: "Error", message: "Password must be at least 6 characters" });
      return;
    }
    if (password !== confirm) {
      showAlert({ title: "Error", message: "Passwords do not match" });
      return;
    }
    setSaving(true);
    const { error } = await updatePassword(password);
    setSaving(false);
    if (error) {
      showAlert({ title: "Update Failed", message: error });
    } else {
      showAlert({ title: "Success", message: "Your password has been updated. You can now sign in." });
    }
  };

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require("../../assets/onboarding/bmw1.jpg")}
        style={styles.imageBackground}
      >
        <View style={styles.blendBackground}>
          <View style={styles.card}>
            <Text style={[styles.text, { color: colors.surface }]}>
              Set New Password
            </Text>
            <Image
              source={require("../../assets/icon.png")}
              style={styles.logo}
            />
            <Text style={[styles.info, { color: colors.surface, textAlign: "center", marginTop: 8 }]}>
              Choose a new password for your account.
            </Text>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed" size={24} color={colors.muted} />
              <TextInput
                style={[styles.input, { color: colors.surface }]}
                placeholder="New password (min 6 chars)"
                placeholderTextColor={colors.surface}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!saving}
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} accessibilityRole="button">
                <Ionicons name={showPassword ? "eye-off" : "eye"} size={24} color={colors.muted} />
              </Pressable>
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed" size={24} color={colors.muted} />
              <TextInput
                style={[styles.input, { color: colors.surface }]}
                placeholder="Confirm new password"
                placeholderTextColor={colors.surface}
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!saving}
              />
            </View>

            <Pressable
              style={[styles.button, { backgroundColor: colors.background, opacity: saving ? 0.5 : 1 }]}
              onPress={handleUpdate}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={{ color: colors.text, fontWeight: "bold" }}>
                  Update Password
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  blendBackground: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    width: "100%",
  },
  text: { fontSize: 28, fontWeight: "bold", textAlign: "center" },
  info: { fontSize: 14, fontWeight: "600" },
  card: {
    width: "90%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 20,
    borderRadius: 30,
  },
  button: {
    marginTop: 20,
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 30,
  },
  logo: { width: 90, height: 90, marginTop: 16, borderRadius: 30 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 30,
    paddingHorizontal: 20,
    width: "100%",
  },
  input: {
    flex: 1,
    padding: 12,
    paddingVertical: 15,
    borderColor: "#ccc",
    borderRadius: 30,
  },
  imageBackground: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
});