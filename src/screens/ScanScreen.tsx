import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Camera,
  runAtTargetFps,
  useCameraDevice,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { useTextRecognition } from 'react-native-vision-camera-text-recognition';
import { useRunOnJS } from 'react-native-worklets-core';
import { CardResult } from '../components/CardResult';
import { useCardLookup } from '../hooks/useCardLookup';
import {
  CollectorCandidate,
  parseCollectorNumber,
} from '../lib/collectorNumber';
import { extractOcrText } from '../lib/ocrText';
import { ScanStabilizer } from '../lib/scanStabilizer';

/** OCR passes per second; full 30fps wastes battery for no extra accuracy. */
const OCR_FPS = 5;

export function ScanScreen() {
  const device = useCameraDevice('back');
  const { scanText } = useTextRecognition({ language: 'latin' });

  const stabilizer = useRef(new ScanStabilizer()).current;
  // Latest candidate seen per key, so a stable key maps back to its details.
  const candidatesByKey = useRef(new Map<string, CollectorCandidate>()).current;
  const [stableCandidate, setStableCandidate] =
    useState<CollectorCandidate | null>(null);
  const [ocrText, setOcrText] = useState('');

  const handleOcr = useCallback(
    (data: unknown) => {
      const text = extractOcrText(data);
      const candidates = parseCollectorNumber(text);
      const best = candidates[0] ?? null;
      if (best) {
        candidatesByKey.set(best.key, best);
        setOcrText(text);
      }
      const stableKey = stabilizer.observe(best?.key ?? null);
      setStableCandidate(
        stableKey ? (candidatesByKey.get(stableKey) ?? null) : null,
      );
    },
    [stabilizer, candidatesByKey],
  );

  const onOcrJS = useRunOnJS(handleOcr, [handleOcr]);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      runAtTargetFps(OCR_FPS, () => {
        'worklet';
        const result = scanText(frame);
        onOcrJS(result);
      });
    },
    [scanText, onOcrJS],
  );

  const lookup = useCardLookup(stableCandidate, ocrText);

  if (!device) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>No camera available on this device.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        frameProcessor={frameProcessor}
        pixelFormat="yuv"
        enableZoomGesture
      />
      <View style={styles.topBar} pointerEvents="none">
        <Text style={styles.title}>ScanDex</Text>
        <Text style={styles.hint}>
          {stableCandidate
            ? `#${stableCandidate.localId}${
                stableCandidate.printedTotal
                  ? `/${stableCandidate.printedTotal}`
                  : ''
              }`
            : 'Point at the bottom corner of a card'}
        </Text>
      </View>
      <CardResult lookup={lookup} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 64,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 4,
  },
  hint: {
    color: '#fff',
    fontSize: 14,
    marginTop: 6,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 4,
  },
});
