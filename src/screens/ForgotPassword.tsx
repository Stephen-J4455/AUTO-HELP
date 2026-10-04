import React from "react";
import { Text, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";
import { useAuth } from "../context/Auth";
import { useNavigation } from "@react-navigation/native";
import { useAppAlert } from "../components/AppAlert";
import { AuthShell, AuthField, AuthSubmit, AuthSwitch, useAuthPalette } from "../components/AuthShell";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const { colors } = useTheme();
  const { borderColor } = useAuthPalette();
  const { resetPassword } = useAuth();
  const navigation = useNavigation<any>();
  const { show: showAlert } = useAppAlert();

  const [email, setEmail] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const handleReset = async () => {
    if (!email.trim()) {
      showAlert({ title: "Error", message: "Please enter your email address" });
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
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
    <AuthShell kicker="PASSWORD RESET" onBack={() => navigation.goBack()} footer="We never share your email.">
      {sent ? (
        <View style={styles.successWrap}>
          <View style={[styles.successIcon, { borderColor, backgroundColor: colors.surface }]}>
            <Ionicons name="checkmark" size={30} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Check your inbox</Text>
          <Text style={[styles.successBody, { color: colors.muted }]}>
            If an account exists for {email.trim().toLowerCase()}, we&apos;ve sent a password reset link to
            your email. Tap the link to choose a new password.
          </Text>
          <View style={styles.successCta}>
            <AuthSubmit label="Back to sign in" onPress={() => navigation.goBack()} />
          </View>
        </View>
      ) : (
        <>
          <Text style={[styles.title, { color: colors.text }]}>Reset password</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Enter your account email and we&apos;ll send you a link to set a new password.
          </Text>

          <View style={styles.form}>
            <AuthField
              label="Email"
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              placeholder="you@autohelp.gh"
              editable={!sending}
              autoComplete="email"
              keyboardType="email-address"
              returnKeyType="go"
              onSubmitEditing={handleReset}
            />
            <AuthSubmit label="Send reset link" onPress={handleReset} loading={sending} />
          </View>

          <AuthSwitch
            question="Remembered your password?"
            action="Sign in"
            onPress={() => navigation.goBack()}
          />
        </>
      )}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: "900", letterSpacing: -0.4 },
  subtitle: { fontSize: 13, fontWeight: "600", marginTop: 6, lineHeight: 19 },
  form: { marginTop: 26, gap: 16 },
  successWrap: { alignItems: "center", gap: 12 },
  successCta: { alignSelf: "stretch", marginTop: 10 },
  successIcon: {
    width: 66,
    height: 66,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  successBody: { fontSize: 13, fontWeight: "600", textAlign: "center", lineHeight: 20 },
});