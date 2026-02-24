import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";
import {
  GestureHandlerRootView,
  PanGestureHandler,
} from "react-native-gesture-handler";

const PRIMARY_COLOR = "#00BCD4";

export default function Help() {
  const onGestureEvent = (event: any) => {
    const { translationX } = event.nativeEvent;

    // 👉 Swipe RIGHT → Go Back
    if (translationX > 80) {
      router.back();
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PanGestureHandler onEnded={onGestureEvent}>
        <View style={styles.container}>
          {/* HEADER */}
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back to home screen"
            >
              <Text style={styles.backArrow}>←</Text>
            </Pressable>

            <Text style={styles.headerTitle}>Help & Instructions</Text>

            <View style={{ width: 24 }} />
          </View>

          {/* CONTENT */}
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            <Section title="Getting Started">
              <InstructionItem number="1" text="Swipe right on the home screen to open the scanner." />
              <InstructionItem number="2" text="Hold your phone steady in one hand." />
            </Section>

            <Section title="While Scanning">
              <InstructionItem number="3" text="Place the currency note about 6 inches from the camera." />
              <InstructionItem number="4" text="Make sure the note is fully visible on the screen." />
              <InstructionItem number="5" text="Wait for the vibration and voice confirmation." />
            </Section>

            <Section title="Gestures & Controls">
              <InstructionItem number="6" text="Swipe right to go back to the previous screen." />
              <InstructionItem number="7" text="Use physical volume buttons to control voice output." />
            </Section>

            <Section title="Troubleshooting">
              <InstructionItem number="8" text="If detection fails, improve lighting and try again." />
              <InstructionItem number="9" text="Avoid shadows covering the note." />
              <InstructionItem number="10" text="Clean your camera lens if the image is blurry." />
            </Section>

            <Section title="Safety Tips">
              <InstructionItem number="11" text="Always scan currency in a safe, stable environment." />
              <InstructionItem number="12" text="Do not scan currency while walking or crossing roads." />
            </Section>

            <Text style={styles.hint} accessibilityLabel="Swipe right to go back">
              Swipe right to go back
            </Text>
          </ScrollView>
        </View>
      </PanGestureHandler>
    </GestureHandlerRootView>
  );
}

/* ---------- COMPONENTS ---------- */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text
        style={styles.sectionTitle}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function InstructionItem({
  number,
  text,
}: {
  number: string;
  text: string;
}) {
  return (
    <View
      style={styles.instructionRow}
      accessible
      accessibilityLabel={`Step ${number}. ${text}`}
    >
      <View style={styles.circle}>
        <Text style={styles.circleText}>{number}</Text>
      </View>

      <Text style={styles.instructionText}>{text}</Text>
    </View>
  );
}

/* ---------- STYLES ---------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
  backArrow: {
    fontSize: 26,
    color: PRIMARY_COLOR,
    fontWeight: "700",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: PRIMARY_COLOR,
  },

  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  section: {
    marginTop: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: PRIMARY_COLOR,
    marginBottom: 20,
  },

  instructionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 22,
  },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 18,
  },
  circleText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 18,
  },
  instructionText: {
    flex: 1,
    fontSize: 18,
    color: "#111",
    lineHeight: 28,
  },

  hint: {
    marginTop: 40,
    textAlign: "center",
    fontSize: 16,
    color: "#666",
  },
});
