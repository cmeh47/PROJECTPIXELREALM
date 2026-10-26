import { Nunito_400Regular, Nunito_600SemiBold } from '@expo-google-fonts/nunito';
import { PixelifySans_500Medium, PixelifySans_600SemiBold, PixelifySans_700Bold } from '@expo-google-fonts/pixelify-sans';
import { Silkscreen_400Regular } from '@expo-google-fonts/silkscreen';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BaseScreen } from './src/base/BaseScreen';
import { colors } from './src/theme';

export default function App() {
  const [loaded] = useFonts({
    PixelifySans_500Medium,
    PixelifySans_600SemiBold,
    PixelifySans_700Bold,
    Silkscreen_400Regular,
    Nunito_400Regular,
    Nunito_600SemiBold,
  });

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.parchment }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {loaded ? <BaseScreen /> : <View style={{ flex: 1, backgroundColor: colors.parchment }} />}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
