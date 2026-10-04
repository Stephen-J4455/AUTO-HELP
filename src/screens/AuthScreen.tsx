import React from "react";
import { Text, StyleSheet, Platform, View } from "react-native";
import { useTheme } from "../theme";
import { useAuth } from "../context/Auth";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useAppAlert } from "../components/AppAlert";
import {
  AuthShell,
  AuthField,
  AuthSubmit,
  AuthSwitch,
  AuthDivider,
  AuthSocialButton,
  useAuthPalette,
} from "../components/AuthShell";

/**
 * Customer sign in / sign up.
 *
 * Design notes:
 *  - Chrome (glow, wordmark, rules, fields, CTA) comes from the shared
 *    `AuthShell`, which mirrors the admin console's design language.
 *  - Google/Apple sign-in is kept (unlike the admin console) because customers
 *    do get a real OAuth flow here, so removing it would be a behaviour change.
 */
export default function AuthScreen() {
  const { colors } = useTheme();
  const { borderColor } = useAuthPalette();
  const { signIn, signUp, signInWithProvider } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { show: showAlert } = useAppAlert();

  const [isLogin, setIsLogin] = React.useState(route.params?.initialMode !== "signup");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [authLoading, setAuthLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const passwordRef = React.useRef<any>(null);

  const showAppleLogin = Platform.OS === "ios";

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      showAlert({ title: "Error", message: "Please fill in all fields" });
      return;
    }
    setAuthLoading(true);
    const { error } = await signIn(email.trim(), password);
    setAuthLoading(false);
    if (error) {
      showAlert({ title: "Login Failed", message: error });
    } else {
      setEmail("");
      setPassword("");
      navigation.goBack();
    }
  };

  const handleSignUp = async () => {
    if (!email.trim() || !password || !username.trim()) {
      showAlert({ title: "Error", message: "Please fill in all fields" });
      return;
    }
    if (password.length < 6) {
      showAlert({ title: "Error", message: "Password must be at least 6 characters" });
      return;
    }
    setAuthLoading(true);
    const { error } = await signUp(email.trim(), password, username.trim());
    setAuthLoading(false);
    if (error) {
      showAlert({ title: "Sign Up Failed", message: error });
    } else {
      showAlert({
        title: "Success",
        message: "Account created! Please check your email to confirm.",
      });
      setIsLogin(true);
      setEmail("");
      setPassword("");
      setUsername("");
    }
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    setAuthLoading(true);
    const { error } = await signInWithProvider(provider);
    setAuthLoading(false);
    if (error) {
      showAlert({ title: "Sign In Failed", message: error });
    } else {
      navigation.goBack();
    }
  };

  const canSubmitLogin = email.trim().length > 0 && password.length > 0 && !authLoading;
  const canSubmitSignUp =
    email.trim().length > 0 && password.length > 0 && username.trim().length > 0 && !authLoading;

  return (
    <AuthShell kicker="AUTO-HELP GH">
      <Text style={[styles.title, { color: colors.text }]}>
        {isLogin ? "Sign in" : "Create account"}
      </Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>
        {isLogin
          ? "Welcome back. Sign in to track orders and check out faster."
          : "Create an account to check out faster and track your orders."}
      </Text>

      <View style={styles.form}>
        {!isLogin ? (
          <AuthField
            label="Username"
            icon="person-outline"
            value={username}
            onChangeText={setUsername}
            placeholder="e.g. kwabena"
            editable={!authLoading}
            autoComplete="username"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
        ) : null}

        <AuthField
          label="Email"
          icon="mail-outline"
          value={email}
          onChangeText={setEmail}
          placeholder="you@autohelp.gh"
          editable={!authLoading}
          autoComplete="email"
          keyboardType="email-address"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />

        <AuthField
          label="Password"
          icon="lock-closed-outline"
          value={password}
          onChangeText={setPassword}
          placeholder={isLogin ? "Enter your password" : "Minimum 6 characters"}
          editable={!authLoading}
          secureTextEntry={!showPassword}
          autoComplete={isLogin ? "current-password" : "new-password"}
          returnKeyType="go"
          onSubmitEditing={isLogin ? handleLogin : undefined}
          inputRef={passwordRef}
          showPassword={showPassword}
          onTogglePassword={() => setShowPassword((v) => !v)}
        />

        {isLogin ? (
          <View style={styles.forgotRow}>
            <Text
              style={[styles.forgotText, { color: colors.primary }]}
              onPress={() => navigation.navigate("ForgotPassword")}
              accessibilityRole="button"
            >
              Forgot password?
            </Text>
          </View>
        ) : null}

        <AuthSubmit
          label={isLogin ? "Sign in" : "Create account"}
          onPress={isLogin ? handleLogin : handleSignUp}
          disabled={isLogin ? !canSubmitLogin : !canSubmitSignUp}
          loading={authLoading}
        />
      </View>

      <AuthDivider color={colors.muted} borderColor={borderColor} />

      <View style={styles.socialRow}>
        <AuthSocialButton
          icon="logo-google"
          onPress={() => handleOAuth("google")}
          disabled={authLoading}
          borderColor={borderColor}
          iconColor={colors.text}
        />
        {showAppleLogin ? (
          <AuthSocialButton
            icon="logo-apple"
            onPress={() => handleOAuth("apple")}
            disabled={authLoading}
            borderColor={borderColor}
            iconColor={colors.text}
          />
        ) : null}
      </View>

      <AuthSwitch
        question={isLogin ? "New to AUTO-HELP?" : "Already have an account?"}
        action={isLogin ? "Create one" : "Sign in"}
        onPress={() => setIsLogin((v) => !v)}
      />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: "900", letterSpacing: -0.4 },
  subtitle: { fontSize: 13, fontWeight: "600", marginTop: 6, lineHeight: 19 },
  form: { marginTop: 26, gap: 16 },
  forgotRow: { alignSelf: "flex-end" },
  forgotText: { fontSize: 12, fontWeight: "800" },
  socialRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 18,
    marginTop: 16,
  },
});