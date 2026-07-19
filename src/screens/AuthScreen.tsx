import React from "react";
import { View, Text, StyleSheet, Pressable, Image, TextInput, ImageBackground, Platform, ActivityIndicator } from "react-native";
import { useTheme } from "../theme";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/Auth";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useAppAlert } from "../components/AppAlert";


export default function AuthScreen() {
  const { colors } = useTheme();
  const { signIn, signUp, loading } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { show: showAlert } = useAppAlert();

  const handleAuthSuccess = () => {
    navigation.goBack();
  };

  const [isLogin, setIsLogin] = React.useState(route.params?.initialMode !== "signup");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [authLoading, setAuthLoading] = React.useState(false);

  const isNative = React.useMemo(() => {
    return Platform.OS !== "web";
  }, []);

  const showAppleLogin = React.useMemo(() => {
    return isNative && Platform.OS === "ios";
  }, [isNative]);

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert({ title: "Error", message: "Please fill in all fields" });
      return;
    }
    setAuthLoading(true);
    const { error } = await signIn(email, password);
    setAuthLoading(false);
    if (error) {
      showAlert({ title: "Login Failed", message: error });
    } else {
      setEmail("");
      setPassword("");
      handleAuthSuccess();
    }
  };

  const handleSignUp = async () => {
    if (!email || !password || !username) {
      showAlert({ title: "Error", message: "Please fill in all fields" });
      return;
    }
    if (password.length < 6) {
      showAlert({ title: "Error", message: "Password must be at least 6 characters" });
      return;
    }
    setAuthLoading(true);
    const { error } = await signUp(email, password, username);
    setAuthLoading(false);
    if (error) {
      showAlert({ title: "Sign Up Failed", message: error });
    } else {
      showAlert({ title: "Success", message: "Account created! Please check your email to confirm." });
      setIsLogin(true);
      setEmail("");
      setPassword("");
      setUsername("");
    }
  };

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require("../../assets/onboarding/bmw1.jpg")}
        style={styles.imageBackground}
      >
        <View style={styles.blendBackground}>
          {isLogin ? (
            <View style={styles.loginContainer}>
              <Text style={[styles.text, { color: colors.surface }]}>
                Welcome Back!
              </Text>
              <Image
                source={require("../../assets/icon.png")}
                style={styles.logo}
              />
              <View style={styles.inputContainer}>
                <Ionicons name="mail" size={24} color={colors.muted} />
                <TextInput
                  style={[styles.input, { color: colors.surface }]}
                  placeholder="Email"
                  placeholderTextColor={colors.surface}
                  value={email}
                  onChangeText={setEmail}
                  editable={!authLoading}
                />
              </View>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed" size={24} color={colors.muted} />
                <TextInput
                  style={[styles.input, { color: colors.surface }]}
                  placeholder="Password"
                  secureTextEntry
                  placeholderTextColor={colors.surface}
                  value={password}
                  onChangeText={setPassword}
                  editable={!authLoading}
                />
              </View>
              <Pressable style={{ marginTop: 20 }}>
                <Text
                  style={{
                    color: colors.primary,
                    alignSelf: "flex-end",
                    marginLeft: 140,
                  }}
                >
                  Forgot Password?
                </Text>
              </Pressable>
              <Pressable
                style={[styles.loginbutton, { backgroundColor: colors.background, opacity: authLoading ? 0.5 : 1 }]}
                onPress={handleLogin}
                disabled={authLoading}
              >
                {authLoading ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Text style={{ color: colors.text, fontWeight: "bold" }}>
                    Login
                  </Text>
                )}
              </Pressable>
              <View style={{ flexDirection: "row", marginTop: 20 }}>
                <Pressable style={{ marginHorizontal: 10 }}>
                  <Ionicons name="logo-google" size={32} color={colors.muted} />
                </Pressable>
                <Pressable style={{ marginHorizontal: 10 }}>
                  <Ionicons name="logo-facebook" size={32} color={colors.muted} />
                </Pressable>
                <Pressable style={{ marginHorizontal: 10 }} disabled={!showAppleLogin}>
                  <Ionicons name="logo-apple" size={32} color={colors.muted} />
                </Pressable>
              </View>
              <Pressable style={{ marginTop: 20 }} onPress={() => setIsLogin(false)}>
                <Text style={{ color: colors.surface }}>
                  Don't have an account? Sign Up
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.loginContainer}>
              <Text style={[styles.text, { color: colors.surface }]}>
                Create New Account
              </Text>
              <Image
                source={require("../../assets/icon.png")}
                style={styles.logo}
              />
              <View style={styles.inputContainer}>
                <Ionicons name="person" size={24} color={colors.muted} />
                <TextInput
                  style={[styles.input, { color: colors.surface }]}
                  placeholder="Username"
                  placeholderTextColor={colors.surface}
                  value={username}
                  onChangeText={setUsername}
                  editable={!authLoading}
                />
              </View>
              <View style={styles.inputContainer}>
                <Ionicons name="mail" size={24} color={colors.muted} />
                <TextInput
                  style={[styles.input, { color: colors.surface }]}
                  placeholder="Email"
                  placeholderTextColor={colors.surface}
                  value={email}
                  onChangeText={setEmail}
                  editable={!authLoading}
                />
              </View>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed" size={24} color={colors.muted} />
                <TextInput
                  style={[styles.input, { color: colors.surface }]}
                  placeholder="Password (min 6 chars)"
                  secureTextEntry
                  placeholderTextColor={colors.surface}
                  value={password}
                  onChangeText={setPassword}
                  editable={!authLoading}
                />
              </View>
              <Pressable
                style={[styles.loginbutton, { backgroundColor: colors.background, opacity: authLoading ? 0.5 : 1 }]}
                onPress={handleSignUp}
                disabled={authLoading}
              >
                {authLoading ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Text style={{ color: colors.text, fontWeight: "bold" }}>
                    Sign Up
                  </Text>
                )}
              </Pressable>
              <View style={{ flexDirection: "row", marginTop: 20 }}>
                <Pressable style={{ marginHorizontal: 10 }}>
                  <Ionicons name="logo-google" size={32} color={colors.muted} />
                </Pressable>
                <Pressable style={{ marginHorizontal: 10 }}>
                  <Ionicons name="logo-facebook" size={32} color={colors.muted} />
                </Pressable>
                <Pressable style={{ marginHorizontal: 10 }} disabled={!showAppleLogin}>
                  <Ionicons name="logo-apple" size={32} color={colors.muted} />
                </Pressable>
              </View>
              <Pressable style={{ marginTop: 20 }} onPress={() => setIsLogin(true)}>
                <Text style={{ color: colors.surface }}>
                  Already have an account? Login
                </Text>
              </Pressable>
            </View>
          )}
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
  text: { fontSize: 34, fontWeight: "bold" },
  loginContainer: {
    width: "90%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 20,
    borderRadius: 30,
  },
  loginbutton: {
    marginTop: 20,
    paddingHorizontal: 80,
    paddingVertical: 15,
    borderRadius: 30,
  },
  logo: { width: 100, height: 100, marginTop: 20, borderRadius: 30 , boxSizing: "border-box"},
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 30,
    paddingHorizontal: 20,
    
  },
  input: {
    width: "70%",
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