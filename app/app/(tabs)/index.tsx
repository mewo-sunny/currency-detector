import React, { useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const instructionsText = "Welcome to MoneyLens. This app helps you identify Indian currency notes. To use the app, swipe left to reach the scanner. Hold your phone steady, point the camera at the currency note, and make sure it is fully visible. Tap the screen to scan. The result will be read aloud. Swipe left again for more help.";

export default function InstructionsScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'dark'];

  useFocusEffect(
    useCallback(() => {
      // Speak instructions when screen comes into focus
      Speech.speak(instructionsText, {
        language: 'en-IN',
        pitch: 1.0,
        rate: 0.9,
      });

      return () => {
        // Stop speaking if the user navigates away
        Speech.stop();
      };
    }, [])
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.tint }]}>Welcome to MoneyLens</Text>
        </View>

        <View style={styles.card}>
          <Text style={[styles.instructionStep, { color: theme.text }]}>1. <Text style={{ color: theme.tint }}>Swipe left</Text> to access the Scanner.</Text>
          <Text style={[styles.instructionStep, { color: theme.text }]}>2. Hold the phone steady, about 6 inches from the note.</Text>
          <Text style={[styles.instructionStep, { color: theme.text }]}>3. <Text style={{ color: theme.tint }}>Tap the screen</Text> or the big button to scan.</Text>
          <Text style={[styles.instructionStep, { color: theme.text }]}>4. Listen for the voice confirmation of the currency value.</Text>
          <Text style={[styles.instructionStep, { color: theme.text }]}>5. <Text style={{ color: theme.tint }}>Swipe left again</Text> for detailed help and tips.</Text>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.hint, { color: theme.icon }]}>Swipe Left to Start Scanning 👉</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  card: {
    backgroundColor: 'rgba(18, 18, 18, 0.6)',
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  instructionStep: {
    fontSize: 20,
    lineHeight: 32,
    marginBottom: 20,
    fontWeight: '500',
  },
  footer: {
    marginTop: 50,
    alignItems: 'center',
  },
  hint: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 1,
    animation: 'pulse 2s infinite',
  }
});