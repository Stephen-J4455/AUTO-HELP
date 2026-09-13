import React from "react";
import { View, Text, StyleSheet, Pressable, Image, TextInput, ImageBackground, ActivityIndicator } from "react-native";
import { useTheme } from "../theme";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/Auth";
import { useNavigation } from "@react-navigation/native";
import { useAppAlert } from "../components/AppAlert";

export default function ForgotPassword() {
  const { colors } = useTheme();
  const { resetPassword, loading } = useAuth();
  const navigation = useNavigation<any>();
  const { show: showAlert } = useAppAlert();

  const [email, setEmail] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const handleReset = async () => {
    if (!email) {
      showAlert({ title: "Error", message: "Please enter your email address" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showAlert({ title: "Error", message: "Please enter a valid email address" });
      return;
    }
    setSending(true);
    const { error } = await resetPassword(email.trim().toLowerCase());
    setSending(false);
    if (error) {
      showAlert({ title: "Reset Failed", message: error });
    } else {
      setSent(true);
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
            <Pressable
              onPress={() => navigation.goBack()}
              style={{ alignSelf: "flex-start", marginBottom: 8 }}
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={26} color={colors.surface} />
            </Pressable>
            <Text style={[styles.text, { color: colors.surface }]}>
              Reset Password
            </Text>
            <Image
              source={require("../../assets/icon.png")}
              style={styles.logo}
            />

            {sent ? (
              <View style={{ alignItems: "center", marginTop: 10 }}>
                <Ionicons name="checkmark-circle" size={56} color={colors.primary} />
                <Text style={[styles.info, { color: colors.surface, textAlign: "center", marginTop: 12 }]}>
                  If an account exists for {email}, we've sent a password reset link to your email.
                </Text>
                <Text style={[styles.info, { color: colors.surface, textAlign: "center", marginTop: 8, opacity: 0.8 }]}>
                  Tap the link in the email to choose a new password.
                </Text>
                <Pressable
                  style={[styles.button, { backgroundColor: colors.background, marginTop: 24 }]}
                  onPress={() => navigation.goBack()}
                >
                  <Text style={{ color: colors.text, fontWeight: "bold" }}>Back to Login</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={[styles.info, { color: colors.surface, textAlign: "center", marginTop: 8 }]}>
                  Enter your account email and we'll send you a link to reset your password.
                </Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail" size={24} color={colors.muted} />
                  <TextInput
                    style={[styles.input, { color: colors.surface }]}
                    placeholder="Email"
                    placeholderTextColor={colors.surface}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    editable={!sending}
                  />
                </View>
                <Pressable
                  style={[styles.button, { backgroundColor: colors.background, opacity: sending ? 0.5 : 1 }]}
                  onPress={handleReset}
                  disabled={sending}
                >
                  {sending ? (
                    <ActivityIndicator color={colors.text} />
                  ) : (
                    <Text style={{ color: colors.text, fontWeight: "bold" }}>
                      Send Reset Link
                    </Text>
                  )}
                </Pressable>
                <Pressable style={{ marginTop: 20 }} onPress={() => navigation.goBack()}>
                  <Text style={{ color: colors.surface }}>
                    Remembered your password? Login
                  </Text>
                </Pressable>
              </>
            )}
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
  text: { fontSize: 30, fontWeight: "bold", textAlign: "center" },
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