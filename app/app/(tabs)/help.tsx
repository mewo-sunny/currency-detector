import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import * as Speech from "expo-speech";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../context/ThemeContext";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Data ────────────────────────────────────────────────────────────────────

const NOTES_SUPPORTED = [
  { denom: "₹10",  color: "#D4A853", hint: "Brown" },
  { denom: "₹20",  color: "#C47A2B", hint: "Orange yellow" },
  { denom: "₹50",  color: "#6B7FC4", hint: "Blue" },
  { denom: "₹100", color: "#5A8A5A", hint: "Lavender" },
  { denom: "₹200", color: "#E8A040", hint: "Bright yellow" },
  { denom: "₹500", color: "#6BA3BE", hint: "Greyed out Green" },
];

const FAQ = [
  {
    q: "Why isn't my note being detected?",
    a: "The most common reason is low light or a crumpled note. Move to a brighter spot and smooth out the note on a flat surface. The camera needs to clearly see the Gandhi portrait on the front.",
  },
  {
    q: "Can it detect two notes at once?",
    a: "Yes. Lay both notes side by side without overlapping. The app will draw a separate box and speak each denomination.",
  },
  {
    q: "It keeps saying the wrong denomination.",
    a: "Make sure the front side (with Gandhi's face) is facing up. Flipped or back-facing notes can confuse the model. Also check there's no strong glare from a light source directly above.",
  },
  {
    q: "The box appears in the wrong spot on screen.",
    a: "This can happen if the phone is tilted more than 45°. Hold it as flat as possible, directly above the note.",
  },
];

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function HelpScreen() {
  const { theme, isDarkMode } = useAppTheme();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const speakHelp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Speech.stop();
    Speech.speak(
      "Hold the note on a flat surface under bright light. Keep Gandhi's face pointing up. " +
      "The app supports 10, 20, 50, 100, 200, and 500 rupee notes. " +
      "Swipe right to go back to the scanner.",
      { language: "en-IN", rate: 0.85 }
    );
  };

  const toggleFaq = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Haptics.selectionAsync();
    setOpenFaq(openFaq === index ? null : index);
  };

  const s = makeStyles(theme, isDarkMode);

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <Text style={s.eyebrow}>NoteVision</Text>
          <Text style={s.title}>How to use</Text>
          <Pressable
            onPress={speakHelp}
            style={({ pressed }) => [s.listenBtn, pressed && { opacity: 0.7 }]}
            accessibilityLabel="Read help aloud"
          >
            <Ionicons name="ear-outline" size={20} color={theme.background} />
            <Text style={s.listenText}>Read aloud</Text>
          </Pressable>
        </View>

        {/* ── Quick steps ── */}
        <View style={s.steps}>
          {[
            { n: "1", heading: "Find good light", body: "Stand near a window or under a ceiling light. Avoid shadows falling across the note." },
            { n: "2", heading: "Lay the note flat", body: "Smooth it out on a table or your palm. Crumpled corners cause the model to miss edges." },
            { n: "3", heading: "Hold the phone steady", body: "Point the camera straight down, about 20–30 cm above. Wait for the green box to appear." },
            { n: "4", heading: "Listen for the result", body: "The app speaks the denomination automatically. No button needed." },
          ].map((step) => (
            <View key={step.n} style={s.stepRow}>
              <View style={s.stepNum}>
                <Text style={s.stepNumText}>{step.n}</Text>
              </View>
              <View style={s.stepBody}>
                <Text style={s.stepHeading}>{step.heading}</Text>
                <Text style={s.stepDesc}>{step.body}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Supported notes ── */}
        <Text style={s.sectionLabel}>Supported notes</Text>
        <View style={s.notesGrid}>
          {NOTES_SUPPORTED.map((note) => (
            <View key={note.denom} style={[s.noteChip, { borderColor: note.color }]}>
              <Text style={[s.noteDenom, { color: note.color }]}>{note.denom}</Text>
              <Text style={s.noteHint}>{note.hint}</Text>
            </View>
          ))}
        </View>

        {/* ── Gestures ── */}
        <Text style={s.sectionLabel}>Gestures</Text>
        <View style={s.gestureBlock}>
          <GestureRow icon="arrow-forward-outline" label="Swipe left" desc="Go to scanner" theme={theme} isDark={isDarkMode} />
          <View style={s.divider} />
          <GestureRow icon="arrow-back-outline" label="Swipe right" desc="Open this screen" theme={theme} isDark={isDarkMode} />
        </View>

        {/* ── FAQ ── */}
        <Text style={s.sectionLabel}>Common questions</Text>
        <View style={s.faqBlock}>
          {FAQ.map((item, i) => (
            <Pressable
              key={i}
              onPress={() => toggleFaq(i)}
              style={[s.faqItem, i < FAQ.length - 1 && s.faqBorder]}
              accessibilityRole="button"
              accessibilityLabel={item.q}
            >
              <View style={s.faqHeader}>
                <Text style={s.faqQ}>{item.q}</Text>
                <Ionicons
                  name={openFaq === i ? "remove" : "add"}
                  size={20}
                  color={theme.tint}
                />
              </View>
              {openFaq === i && (
                <Text style={s.faqA}>{item.a}</Text>
              )}
            </Pressable>
          ))}
        </View>

    
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GestureRow({ icon, label, desc, theme, isDark }: any) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: theme.tint + "18", alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={18} color={theme.tint} />
      </View>
      <View>
        <Text style={{ color: theme.text, fontWeight: "700", fontSize: 15 }}>{label}</Text>
        <Text style={{ color: theme.subtext, fontSize: 13, marginTop: 1 }}>{desc}</Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(theme: any, isDark: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.background },
    scroll: { paddingHorizontal: 22, paddingTop: 64, paddingBottom: 60 },

    // Header
    header: { marginBottom: 36 },
    eyebrow: { fontSize: 12, fontWeight: "700", letterSpacing: 2, color: theme.tint, textTransform: "uppercase", marginBottom: 6 },
    title: { fontSize: 38, fontWeight: "900", color: theme.text, letterSpacing: -0.5, lineHeight: 42 },
    listenBtn: {
      marginTop: 18,
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: theme.tint,
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 50,
    },
    listenText: { color: theme.background, fontWeight: "700", fontSize: 14 },

    // Steps
    steps: { gap: 24, marginBottom: 40 },
    stepRow: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
    stepNum: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: theme.tint,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
      flexShrink: 0,
    },
    stepNumText: { color: theme.background, fontWeight: "900", fontSize: 15 },
    stepBody: { flex: 1 },
    stepHeading: { fontSize: 17, fontWeight: "800", color: theme.text, marginBottom: 3 },
    stepDesc: { fontSize: 15, color: theme.subtext, lineHeight: 22 },

    // Section label
    sectionLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 2,
      color: theme.subtext,
      textTransform: "uppercase",
      marginBottom: 14,
      marginTop: 10,
    },

    // Notes grid
    notesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 36 },
    noteChip: {
      borderWidth: 1.5,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      width: "47%",
    },
    noteDenom: { fontSize: 20, fontWeight: "900", marginBottom: 3 },
    noteHint: { fontSize: 12, color: theme.subtext, lineHeight: 16 },

    // Gestures
    gestureBlock: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 18,
      gap: 14,
      marginBottom: 36,
    },
    divider: { height: 1, backgroundColor: theme.border },

    // FAQ
    faqBlock: {
      backgroundColor: theme.card,
      borderRadius: 16,
      overflow: "hidden",
      marginBottom: 36,
    },
    faqItem: { padding: 18 },
    faqBorder: { borderBottomWidth: 1, borderBottomColor: theme.border },
    faqHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
    faqQ: { flex: 1, fontSize: 15, fontWeight: "700", color: theme.text, lineHeight: 21 },
    faqA: { marginTop: 10, fontSize: 14, color: theme.subtext, lineHeight: 22 },

    // Footer
    footer: {
      fontSize: 13,
      color: theme.subtext,
      lineHeight: 20,
      textAlign: "center",
      paddingHorizontal: 10,
    },
  });
}