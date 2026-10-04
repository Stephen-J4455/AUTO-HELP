import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme";

/**
 * Shared chrome for the customer-facing auth screens (sign in / sign up,
 * forgot password, set new password).
 *
 * Design notes (mirrors the admin console):
 *  - No photographic background. Depth comes from layered solid shapes: a soft
 *    brand-tinted glow behind a hairline-ruled card. That keeps the page legible
 *    in both themes and avoids depending on a bundled photo.
 *  - Everything is theme-derived, never hard-coded, so the screens follow the
 *    active light/dark scheme.
 */

const CARD_MAX_WIDTH = 440;

/** Colours the shared chrome derives from the active theme. */
export function useAuthPalette() {
  const { colors, scheme } = useTheme();
  const isDark = scheme === "dark";

  return {
    colors,
    isDark,
    borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.10)",
    fieldColor: isDark ? "#18181b" : "#f6f7f9",
    accentRing: isDark ? "rgba(128,0,32,0.35)" : "rgba(128,0,32,0.14)",
    kickerColor: isDark ? "rgba(255,255,255,0.55)" : "#5b6472",
    glowColor: isDark ? "rgba(128,0,32,0.30)" : "rgba(128,0,32,0.10)",
  };
}

type FieldProps = {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  editable?: boolean;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoComplete?: "email" | "current-password" | "new-password" | "username" | "off";
  keyboardType?: "default" | "email-address";
  returnKeyType?: "next" | "go" | "done";
  onSubmitEditing?: () => void;
  /** Renders the show/hide toggle when supplied. */
  showPassword?: boolean;
  onTogglePassword?: () => void;
  inputRef?: React.RefObject<any>;
};

/** Labelled input row matching the admin console field styling. */
export function AuthField({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  editable = true,
  secureTextEntry,
  autoCapitalize = "none",
  autoComplete = "off",
  keyboardType = "default",
  returnKeyType,
  onSubmitEditing,
  showPassword,
  onTogglePassword,
  inputRef,
}: FieldProps) {
  const { colors } = useTheme();
  const { borderColor, fieldColor, kickerColor } = useAuthPalette();

  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: kickerColor }]}>{label}</Text>
      <View style={[styles.field, { backgroundColor: fieldColor, borderColor }]}>
        <Ionicons name={icon} size={18} color={colors.muted} />
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: colors.text }]}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          value={value}
          onChangeText={onChangeText}
          editable={editable}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          keyboardType={keyboardType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
        />
        {onTogglePassword ? (
          <Pressable
            onPress={onTogglePassword}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? "Hide password" : "Show password"}
          >
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={19}
              color={colors.muted}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

type SubmitProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

/** Primary call-to-action button matching the admin console. */
export function AuthSubmit({ label, onPress, disabled = false, loading = false }: SubmitProps) {
  const { colors } = useTheme();
  const canSubmit = !disabled && !loading;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.submit,
        { backgroundColor: colors.primary, opacity: !canSubmit ? 0.55 : pressed ? 0.85 : 1 },
      ]}
      onPress={onPress}
      disabled={!canSubmit}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          <Text style={styles.submitText}>{label}</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </>
      )}
    </Pressable>
  );
}

type ShellProps = {
  /** Small uppercase line under the wordmark, e.g. "AUTO-HELP GH". */
  kicker: string;
  /** Optional back arrow rendered above the wordmark. */
  onBack?: () => void;
  /** Rows rendered between the two hairline rules. */
  children: React.ReactNode;
  /** Text rendered in the footer rule area. */
  footer?: string;
};

export function AuthShell({ kicker, onBack, children, footer }: ShellProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { borderColor, accentRing, kickerColor, glowColor } = useAuthPalette();

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Soft brand glow anchored behind the card. Plain Views, no image. */}
      <View pointerEvents="none" style={[styles.glow, { backgroundColor: glowColor }]} />
      <View pointerEvents="none" style={[styles.glowSmall, { backgroundColor: glowColor }]} />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.cardWrap}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={({ pressed }) => [styles.back, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </Pressable>
          ) : null}

          <View style={styles.brandRow}>
            <View style={[styles.logoRing, { borderColor: accentRing }]}>
              <Image source={require("../../assets/icon.png")} style={styles.logo} />
            </View>
            <View style={styles.brandTextWrap}>
              <Text style={[styles.brandName, { color: colors.text }]}>AUTO-HELP</Text>
              <Text style={[styles.kicker, { color: kickerColor }]}>{kicker}</Text>
            </View>
          </View>

          <View style={[styles.rule, { backgroundColor: borderColor }]} />

          {children}

          <View style={[styles.rule, { backgroundColor: borderColor }]} />

          <View style={styles.footRow}>
            <View style={styles.footDot} />
            <Text style={[styles.footText, { color: colors.muted }]}>
              {footer ?? "Fast parts delivery across Ghana."}
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Login / Sign up switch rendered under the form. */
export function AuthSwitch({
  question,
  action,
  onPress,
}: {
  question: string;
  action: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const { borderColor } = useAuthPalette();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={action}
      style={({ pressed }) => [
        styles.switchRow,
        { borderColor, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Text style={[styles.switchText, { color: colors.muted }]}>{question}</Text>
      <Text style={[styles.switchAction, { color: colors.primary }]}>{action}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  // Large, very soft brand-tinted circles that build depth without an image.
  glow: {
    position: "absolute",
    top: -140,
    left: -110,
    width: 340,
    height: 340,
    borderRadius: 170,
  },
  glowSmall: {
    position: "absolute",
    bottom: -90,
    right: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.7,
  },
  cardWrap: {
    width: "100%",
    maxWidth: CARD_MAX_WIDTH,
  },
  back: { marginBottom: 18, alignSelf: "flex-start" },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  logoRing: {
    width: 58,
    height: 58,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logo: { width: 46, height: 46, borderRadius: 14 },
  brandTextWrap: { flex: 1 },
  brandName: { fontSize: 19, fontWeight: "900", letterSpacing: 1.4 },
  kicker: { fontSize: 10, fontWeight: "800", letterSpacing: 2.2, marginTop: 3 },
  rule: { height: 1, marginVertical: 22 },
  form: { marginTop: 26, gap: 16 },
  fieldGroup: { gap: 7 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    paddingVertical: 0,
  },
  submit: {
    marginTop: 10,
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 22,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 10, fontWeight: "800", letterSpacing: 1.6 },
  socialRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 18,
    marginTop: 16,
  },
  socialBtn: {
    width: 50,
    height: 50,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  forgotRow: { alignSelf: "flex-end" },
  forgotText: { fontSize: 12, fontWeight: "800" },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 18,
  },
  switchText: { fontSize: 13, fontWeight: "600" },
  switchAction: { fontSize: 13, fontWeight: "800" },
  footRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  footDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#800020" },
  footText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3, flex: 1 },
  successWrap: { alignItems: "center", gap: 12, marginTop: 10 },
  successIcon: {
    width: 66,
    height: 66,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: { fontSize: 20, fontWeight: "900", textAlign: "center" },
  successBody: { fontSize: 13, fontWeight: "600", textAlign: "center", lineHeight: 20 },
});

/** "OR CONTINUE WITH" rule used above the provider buttons. */
export function AuthDivider({ color, borderColor }: { color: string; borderColor: string }) {
  return (
    <View style={styles.divider}>
      <View style={[styles.dividerLine, { backgroundColor: borderColor }]} />
      <Text style={[styles.dividerText, { color }]}>OR CONTINUE WITH</Text>
      <View style={[styles.dividerLine, { backgroundColor: borderColor }]} />
    </View>
  );
}

/** Circular provider (Google / Apple) button. */
export function AuthSocialButton({
  icon,
  onPress,
  disabled,
  borderColor,
  iconColor,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  disabled?: boolean;
  borderColor: string;
  iconColor: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.socialBtn,
        { borderColor, opacity: !disabled ? (pressed ? 0.6 : 1) : 0.55 },
      ]}
    >
      <Ionicons name={icon} size={22} color={iconColor} />
    </Pressable>
  );
}

export { styles as authStyles };