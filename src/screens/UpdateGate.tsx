import React from "react";
import { View, Text, StyleSheet, Pressable, Image, Linking, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme";
import { Ionicons } from "@expo/vector-icons";
import { AppUpdate } from "../utils/updateCheck";

type Props = {
  decision: Extract<
    { kind: "maintenance" | "force" | "optional"; update: AppUpdate },
    { kind: "maintenance" | "force" | "optional" }
  >;
  onDismiss: () => void;
};

export default function UpdateGate({ decision, onDismiss }: Props) {
  const { colors } = useTheme();
  const { kind, update } = decision;

  const openUpdate = async () => {
    const url = (update.update_url || "").trim();
    if (url) {
      try {
        await Linking.openURL(url);
      } catch {
        /* no-op */
      }
    }
  };

  const isBlocked = kind === "maintenance" || kind === "force";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor:
                kind === "maintenance"
                  ? "rgba(245,158,11,0.15)"
                  : kind === "force"
                  ? "rgba(239,68,68,0.15)"
                  : "rgba(16,185,129,0.15)",
            },
          ]}
        >
          <Ionicons
            name={
              kind === "maintenance"
                ? "construct-outline"
                : kind === "force"
                ? "warning-outline"
                : "cloud-download-outline"
            }
            size={34}
            color={
              kind === "maintenance"
                ? "#F59E0B"
                : kind === "force"
                ? "#EF4444"
                : "#10B981"
            }
          />
        </View>

        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{update.title}</Text>
        <Text style={[styles.version, { color: colors.muted }]}>
          Version {update.version}
        </Text>

        <ScrollView
          style={styles.messageWrap}
          contentContainerStyle={styles.messageInner}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.message, { color: colors.muted }]}>
            {update.message}
          </Text>
          {update.release_notes ? (
            <Text style={[styles.notes, { color: colors.muted }]}>
              {update.release_notes}
            </Text>
          ) : null}
        </ScrollView>

        {isBlocked ? (
          <Pressable
            accessibilityRole="button"
            style={[styles.button, styles.blockingButton, { backgroundColor: colors.primary }]}
            onPress={openUpdate}
          >
            <Text style={styles.buttonText}>Update now</Text>
          </Pressable>
        ) : (
          <View style={styles.row}>
            <Pressable
              accessibilityRole="button"
              style={[styles.secondary, { borderColor: colors.border }]}
              onPress={onDismiss}
            >
              <Text style={[styles.secondaryText, { color: colors.muted }]}>
                Later
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={[styles.button, { backgroundColor: colors.primary, flex: 1 }]}
              onPress={openUpdate}
            >
              <Text style={styles.buttonText}>Update</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
    padding: 28,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  version: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
    marginBottom: 14,
  },
  messageWrap: {
    maxHeight: 160,
    width: "100%",
  },
  messageInner: {
    alignItems: "center",
  },
  message: {
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 22,
  },
  notes: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
    marginTop: 12,
    opacity: 0.85,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    marginTop: 22,
    width: "100%",
  },
  blockingButton: { marginTop: 22, width: "100%" },
  button: {
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  secondary: {
    paddingVertical: 15,
    paddingHorizontal: 22,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    fontSize: 16,
    fontWeight: "700",
  },
});