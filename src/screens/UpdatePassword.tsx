import React from "react";
import { Text, StyleSheet, View } from "react-native";
import { useTheme } from "../theme";
import { useAuth } from "../context/Auth";
import { useAppAlert } from "../components/AppAlert";
import { AuthShell, AuthField, AuthSubmit } from "../components/AuthShell";

export default function UpdatePassword() {
  const { colors } = useTheme();
  const { updatePassword } = useAuth();
  const { show: showAlert } = useAppAlert();

  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const confirmRef = React.useRef<any>(null);

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
      showAlert({
        title: "Success",
        message: "Your password has been updated. You can now sign in.",
      });
    }
  };

  return (
    <AuthShell kicker="ACCOUNT RECOVERY" footer="Choose a password you don't use anywhere else.">
      <Text style={[styles.title, { color: colors.text }]}>Set new password</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>
        Choose a new password for your AUTO-HELP account.
      </Text>

      <View style={styles.form}>
        <AuthField
          label="New password"
          icon="lock-closed-outline"
          value={password}
          onChangeText={setPassword}
          placeholder="Minimum 6 characters"
          editable={!saving}
          secureTextEntry={!showPassword}
          autoComplete="new-password"
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
          inputRef={undefined}
          showPassword={showPassword}
          onTogglePassword={() => setShowPassword((v) => !v)}
        />

        <AuthField
          label="Confirm new password"
          icon="shield-checkmark-outline"
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Re-enter your new password"
          editable={!saving}
          secureTextEntry={!showPassword}
          autoComplete="new-password"
          returnKeyType="go"
          onSubmitEditing={handleUpdate}
          inputRef={confirmRef}
        />

        <AuthSubmit label="Update password" onPress={handleUpdate} loading={saving} />
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: "900", letterSpacing: -0.4 },
  subtitle: { fontSize: 13, fontWeight: "600", marginTop: 6, lineHeight: 19 },
  form: { marginTop: 26, gap: 16 },
});