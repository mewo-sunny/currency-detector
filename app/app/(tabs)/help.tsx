import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function HelpScreen() {
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? "dark"];

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: theme.tint }]}>Help & Tips</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <Section title="Getting Started" theme={theme}>
                    <InstructionItem
                        number="1"
                        text="Swipe left or right to switch between Instructions, Scan, and Help screens."
                        theme={theme}
                    />
                    <InstructionItem
                        number="2"
                        text="Hold your phone steady in one hand."
                        theme={theme}
                    />
                </Section>

                <Section title="While Scanning" theme={theme}>
                    <InstructionItem
                        number="3"
                        text="Place the currency note about 6 inches from the camera."
                        theme={theme}
                    />
                    <InstructionItem
                        number="4"
                        text="Make sure the note is fully visible on the screen."
                        theme={theme}
                    />
                    <InstructionItem
                        number="5"
                        text="Wait for the vibration and voice confirmation."
                        theme={theme}
                    />
                </Section>

                <Section title="Troubleshooting" theme={theme}>
                    <InstructionItem
                        number="6"
                        text="If detection fails, improve lighting and try again."
                        theme={theme}
                    />
                    <InstructionItem
                        number="7"
                        text="Avoid shadows covering the note."
                        theme={theme}
                    />
                    <InstructionItem
                        number="8"
                        text="Clean your camera lens if the image is blurry."
                        theme={theme}
                    />
                </Section>

                <Text style={[styles.hint, { color: theme.icon }]} accessibilityLabel="Swipe left to go back to Scanner">
                    👈 Swipe right to go back to Scanner
                </Text>
            </ScrollView>
        </View>
    );
}

/* ---------- COMPONENTS ---------- */

function Section({
    title,
    children,
    theme,
}: {
    title: string;
    children: React.ReactNode;
    theme: any;
}) {
    return (
        <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.tint }]} accessibilityRole="header">
                {title}
            </Text>
            {children}
        </View>
    );
}

function InstructionItem({
    number,
    text,
    theme,
}: {
    number: string;
    text: string;
    theme: any;
}) {
    return (
        <View style={styles.instructionRow} accessible accessibilityLabel={`Step ${number}. ${text}`}>
            <View style={[styles.circle, { backgroundColor: theme.tint }]}>
                <Text style={styles.circleText}>{number}</Text>
            </View>
            <Text style={[styles.instructionText, { color: theme.text }]}>{text}</Text>
        </View>
    );
}

/* ---------- STYLES ---------- */

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 24,
        paddingTop: 40,
        paddingBottom: 20,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 229, 255, 0.1)',
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: "800",
    },
    scroll: {
        paddingHorizontal: 24,
        paddingBottom: 60,
    },
    section: {
        marginTop: 35,
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: "700",
        marginBottom: 20,
        letterSpacing: 0.5,
    },
    instructionRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: 22,
        backgroundColor: 'rgba(18, 18, 18, 0.4)',
        padding: 15,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    circle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 15,
        marginTop: 2,
        shadowColor: '#00E5FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 4,
    },
    circleText: {
        color: "#121212",
        fontWeight: "800",
        fontSize: 16,
    },
    instructionText: {
        flex: 1,
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '500',
        marginTop: 6,
    },
    hint: {
        marginTop: 50,
        textAlign: "center",
        fontSize: 16,
        fontWeight: '600',
    },
});
