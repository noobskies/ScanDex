module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Required by vision-camera frame processors: embeds worklet function
    // source at build time so Hermes release builds can compile them on the
    // camera thread (otherwise: "Compiling JS failed: invalid empty
    // parentheses '( )'" crash on the first frame).
    plugins: ['react-native-worklets-core/plugin'],
  };
};
