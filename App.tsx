import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { useCameraPermission } from 'react-native-vision-camera';
import { ScanScreen } from './src/screens/ScanScreen';

export default function App() {
  const { hasPermission, requestPermission } = useCameraPermission();

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {hasPermission ? (
        <ScanScreen />
      ) : (
        <View style={styles.center}>
          <Text style={styles.text}>
            ScanDex needs the camera to scan your cards.
          </Text>
          <Button title="Grant camera access" onPress={requestPermission} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  text: { color: '#fff', fontSize: 16, textAlign: 'center' },
});
