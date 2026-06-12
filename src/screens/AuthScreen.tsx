import React from "react";
import { View, Text, StyleSheet,Pressable, Image, TextInput , ImageBackground, Platform} from "react-native";
import { useTheme } from "../theme";
import { Ionicons} from "@expo/vector-icons";


export default function AuthScreen() {
  const { colors } = useTheme();

  {/* toggle between login and sign up page */ }
  const [isLogin, setIsLogin] = React.useState(true);

  {/* identify native platform */ }
  const isNative = React.useMemo(() => {
    return Platform.OS !== "web";
  }, []);
{/* if android , dont show apple login option */}
  const showAppleLogin = React.useMemo(() => {
    return isNative && Platform.OS === "ios";
  }, [isNative]);


  return (
    <View style={styles.container}>
      <ImageBackground
        source={require("../../assets/onboarding/bmw1.jpg")}
        style={styles.imageBackground}
      >
        <View style={styles.blendBackground}>
          {/* login page section */}
{isLogin ? (
          <View style={styles.loginContainer}>
            <Text style={[styles.text, { color: colors.surface }]}>
              {" "}
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
              />
            </View>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed" size={24} color={colors.muted} />
              <TextInput
                style={[styles.input, { color: colors.surface }]}
                placeholder="Password"
                secureTextEntry
                placeholderTextColor={colors.surface}
              />
            </View>
            {/*fogot password link*/}
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
              style={[styles.loginbutton, { backgroundColor: colors.background }]}
            >
              <Text style={{ color: colors.text, fontWeight: "bold" }}>
                Login
              </Text>
              </Pressable>
              {/*social login*/}
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

            {/*sign up page link*/}
            <Pressable style={{ marginTop: 20 }} onPress={() => setIsLogin(false)}>
              <Text style={{ color: colors.surface }}>
                Don't have an account? Sign Up
              </Text>
            </Pressable>
          </View>) : (

        
          <View style={styles.loginContainer}>
            <Text style={[styles.text, { color: colors.surface }]}>
              {" "}
              Create New Account
            </Text>
            <Image
              source={require("../../assets/icon.png")}
              style={styles.logo}
            />
            <View style={styles.inputContainer}>
              <Ionicons name="person" size={24} color={colors.muted } />
              <TextInput
                style={[styles.input, { color: colors.surface }]}
                placeholder="Username"
                placeholderTextColor={colors.surface}
              />
            </View>
            <View style={styles.inputContainer}>
              <Ionicons name="mail" size={24} color={colors.muted} />
              <TextInput
                style={[styles.input, { color: colors.surface }]}
                placeholder="Email"
                placeholderTextColor={colors.surface}
              />
            </View>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed" size={24} color={colors.muted} />
              <TextInput
                style={[styles.input, { color: colors.surface }]}
                placeholder="Password"
                secureTextEntry
                placeholderTextColor={colors.surface}
              />
                </View>
            <Pressable
              style={[styles.loginbutton, { backgroundColor: colors.background }]}
            >
              <Text style={{ color: colors.text, fontWeight: "bold" }}>
                Sign Up
              </Text>
                </Pressable>
                {/*social sign up*/}
              <View style={{ flexDirection: "row", marginTop: 20 }}>
              <Pressable style={{ marginHorizontal: 10 }}>
                <Ionicons name="logo-google" size={32} color={colors.muted} />
              </Pressable>
              <Pressable style={{ marginHorizontal: 10 }}>
                <Ionicons name="logo-facebook" size={32} color={colors.muted} />
                  </Pressable>  
                  {/* make apple pressable disappear if platform is not ios */}
              <Pressable style={{ marginHorizontal: 10 }} disabled={!showAppleLogin}>
                <Ionicons name="logo-apple" size={32} color={colors.muted} />
              </Pressable>
            </View>

            {/*login page link*/}
            <Pressable style={{ marginTop: 20 }} onPress={() => setIsLogin(true)}>
              <Text style={{ color: colors.surface }}>
                Already have an account? Login
              </Text>
            </Pressable>
        </View>
          )}
          {/*end of containers*/}
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