# ScanDex

Point your phone at a Pokémon card, get back what it is.

ScanDex runs ML Kit text recognition on the live camera feed, extracts the
collector number printed in the card's bottom corner (e.g. `025/198`,
`TG12/TG30`, `SWSH039`), and resolves it against the free
[TCGdex](https://tcgdex.dev) API — no image matching needed for the fast path.

## How identification works

```
camera frame ──▶ ML Kit OCR (on-device, ~5 fps)
            ──▶ collector-number parser        src/lib/collectorNumber.ts
            ──▶ multi-frame majority vote      src/lib/scanStabilizer.ts
            ──▶ TCGdex lookup                  src/lib/tcgdex.ts
            ──▶ card name + image overlay
```

- **Parser** handles modern fractions (`025/198`), vintage (`4/102`), secret
  rares (`194/182`), gallery/vault prefixes (`TG`, `GG`, `SV`, `RC`), promo
  numbers (`SWSH039`, `SM210`, `XY67`), and repairs common OCR digit
  confusions (`O→0`, `I/l→1`).
- **Stabilizer** only accepts a result once it wins a majority of recent
  frames, which is what makes holo glare and motion blur survivable.
- **Lookup** uses the SV-era set code (`PAL EN` → Paldea Evolved) when OCR
  catches it; otherwise it matches the printed denominator against each set's
  official card count and ranks ambiguous hits by whether the card's name also
  appears in the OCR text.

## Stack

- [Expo](https://expo.dev) (dev client — **not** Expo Go) + React Native + TypeScript
- [react-native-vision-camera](https://react-native-vision-camera.com) v4 frame processors
- [react-native-vision-camera-text-recognition](https://github.com/gev2002/react-native-vision-camera-text-recognition) (ML Kit, on-device)
- [TCGdex](https://tcgdex.dev) REST API for card data and images

## Running it

Frame processors require native code, so this app cannot run in Expo Go.

```sh
npm install

# Android (device or emulator with a camera)
npx expo prebuild --platform android
npx expo run:android

# iOS
npx expo prebuild --platform ios
npx expo run:ios --device
```

`android/` and `ios/` are generated (continuous native generation) and stay
out of git; `app.json` is the source of truth for native config.

## Development

```sh
npm run typecheck   # tsc --noEmit
npm test            # jest — parser, stabilizer, and lookup are pure TS with unit tests
```

## Roadmap

- [ ] **pHash fallback** — perceptual-hash matching against the CC0 card-image
      dataset for worn cards, vintage cards without set codes, and glare
      that defeats OCR. Hashes live in SQLite on-device; works offline.
- [ ] **Collection tracking** — the actually useful feature: "which of these
      do I already have", stored locally.
- [ ] **Variant disambiguation** — reverse holo / promo stamps for pricing.
- [ ] **Multilingual cards** — TCGdex serves 14 languages; Ximilar API as a
      last-resort fallback.

## Troubleshooting

**`JvmVendorSpec does not have member field 'IBM_SEMERU'` during the Android
build** — Gradle couldn't find a local JDK 17 and fell back to its toolchain
auto-download plugin, whose pinned version (foojay-resolver 0.5.0, from React
Native's gradle plugin) is incompatible with Gradle 9
([facebook/react-native#55781](https://github.com/facebook/react-native/issues/55781)).
Fix: install JDK 17 and build with it —

```sh
sudo apt install openjdk-17-jdk          # or brew install openjdk@17
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
npx expo run:android
```

**Build targets an emulator instead of your USB phone** — run
`adb devices` to confirm the phone is authorized, then
`npx expo run:android --device` to pick it explicitly.

## Known limitations

- Online-only for now (lookups hit the TCGdex API live).
- Vintage cards (pre-2002) lack set codes; the denominator fallback usually
  still works (`4/102` → Base Set) but worn cards may need the pHash path.
- Heavy foil glare can defeat OCR even with frame voting — angle the card.
