import { router } from 'expo-router'
import {Button, ScrollView, StyleSheet, Pressable} from "react-native"
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedIcon } from '@/components/animated-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView
      style={styles.container}
      edges={["top", "left", "right"]}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.heroSection}>
            <AnimatedIcon/>

            <ThemedText type="subtitle" style={styles.centerText}>Report Assistant</ThemedText>

            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              Start with a document or paste your reports text</ThemedText>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.actions}>
              <ThemedText type="smallBold">Add a report</ThemedText>

              <Button
                title="Upload document"
                disabled
                />
                
               <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/paste-text')}
                style={({ pressed }) => [
                  styles.pasteButton,
                  pressed && styles.buttonPressed,
                ]}
                >
                  <ThemedText style={styles.pasteButtontext}>
                    Paste text here
                  </ThemedText>
                </Pressable>
            </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    width: "100%",
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.five
  },
  heroSection: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.four
  },
  centerText:{
    textAlign: "center",
  },
  actions: {
    padding: Spacing.four,
    gap: Spacing.three,
    borderRadius: Spacing.four
  },
  pasteButton: {
    minHeight: 48,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: "center",
    justifyContent: "center",
  },
  pasteButtontext: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  buttonPressed:{
    opacity: 0.8,
  },
});
