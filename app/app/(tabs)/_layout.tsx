import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialTopTabs } from '@/components/material-top-tabs';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'dark'];
  const [initialRoute, setInitialRoute] = useState<string | null>(null);

  useEffect(() => {
    const checkFirstLaunch = async () => {
      try {
        const hasLaunched = await AsyncStorage.getItem('hasLaunched');
        if (hasLaunched === null) {
          // First launch
          await AsyncStorage.setItem('hasLaunched', 'true');
          setInitialRoute('index'); // Instructions screen
        } else {
          setInitialRoute('scan'); // Main scan screen
        }
      } catch (error) {
        console.error('Error checking first launch:', error);
        setInitialRoute('scan'); // Fallback
      }
    };
    checkFirstLaunch();
  }, []);

  if (initialRoute === null) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.tint} />
      </View>
    );
  }

  return (
    <MaterialTopTabs
      initialRouteName={initialRoute}
      screenOptions={{
        tabBarStyle: { display: 'none' }, // Hide the tab bar entirely
        swipeEnabled: true,
      }}
    >
      <MaterialTopTabs.Screen name="index" options={{ title: 'Instructions' }} />
      <MaterialTopTabs.Screen name="scan" options={{ title: 'Scan' }} />
      <MaterialTopTabs.Screen name="help" options={{ title: 'Help' }} />
    </MaterialTopTabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
