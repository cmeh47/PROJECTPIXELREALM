import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

// Skia runs on CanvasKit (WebAssembly) in the browser, so the web build loads it before mounting.
if (Platform.OS === 'web') {
  const { LoadSkiaWeb } = require('@shopify/react-native-skia/lib/module/web');
  LoadSkiaWeb({ locateFile: (file: string) => `/${file}` }).then(() => registerRootComponent(require('./App').default));
} else {
  registerRootComponent(require('./App').default);
}
