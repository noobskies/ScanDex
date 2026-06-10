import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import type { CardLookupState } from '../hooks/useCardLookup';
import { cardImageUrl } from '../lib/tcgdex';

export function CardResult({ lookup }: { lookup: CardLookupState }) {
  if (lookup.status === 'idle') return null;

  return (
    <View style={styles.sheet}>
      {lookup.status === 'searching' && (
        <View style={styles.row}>
          <ActivityIndicator color="#fff" />
          <Text style={styles.name}>  Looking up card…</Text>
        </View>
      )}
      {lookup.status === 'not_found' && (
        <Text style={styles.name}>No match — try steadying the card</Text>
      )}
      {lookup.status === 'found' && lookup.result && (
        <View style={styles.row}>
          {cardImageUrl(lookup.result.card, 'low') && (
            <Image
              source={{ uri: cardImageUrl(lookup.result.card, 'low')! }}
              style={styles.thumb}
              resizeMode="contain"
            />
          )}
          <View style={styles.info}>
            <Text style={styles.name}>{lookup.result.card.name}</Text>
            <Text style={styles.meta}>
              {lookup.result.card.set?.name ?? 'Unknown set'} · #
              {lookup.result.card.localId}
            </Text>
            {lookup.result.card.rarity && (
              <Text style={styles.meta}>{lookup.result.card.rarity}</Text>
            )}
            {lookup.result.alternatives.length > 0 && (
              <Text style={styles.meta}>
                +{lookup.result.alternatives.length} other possible{' '}
                {lookup.result.alternatives.length === 1 ? 'set' : 'sets'}
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 24,
    borderRadius: 16,
    backgroundColor: 'rgba(20,20,28,0.92)',
    padding: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 72, height: 100, borderRadius: 6, marginRight: 12 },
  info: { flex: 1 },
  name: { color: '#fff', fontSize: 18, fontWeight: '700' },
  meta: { color: '#b9bdc7', fontSize: 13, marginTop: 2 },
});
