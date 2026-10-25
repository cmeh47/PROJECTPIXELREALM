import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { registerRootComponent } from 'expo';

// Skia runs on CanvasKit (WebAssembly) in the browser, so the web build loads it before mounting.
// This file is web-only: CanvasKit imports Node modules that the phone runtime does not have.
export function boot() {
  LoadSkiaWeb({ locateFile: (file: string) => `./${file}` }).then(() => registerRootComponent(require('../../App').default));
}
