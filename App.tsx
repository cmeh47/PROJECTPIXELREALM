import { Nunito_400Regular, Nunito_600SemiBold } from '@expo-google-fonts/nunito';
import { PixelifySans_500Medium, PixelifySans_600SemiBold, PixelifySans_700Bold } from '@expo-google-fonts/pixelify-sans';
import { Silkscreen_400Regular } from '@expo-google-fonts/silkscreen';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BaseScreen } from './src/base/BaseScreen';
import { CharacterCreation } from './src/create/CharacterCreation';
import { useHero } from './src/net/useHero';
import { colors } from './src/theme';
import { PixelButton, styles as t } from './src/ui/pixel';

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
        {loaded ? <Game /> : <View style={{ flex: 1, backgroundColor: colors.parchment }} />}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// First launch opens character creation; once the hero exists, the base.
function Game() {
  const { status, hero, create, retry, playOffline } = useHero();
  if (status === 'ready' && hero) {
    return (
      <Animated.View entering={FadeIn.duration(300)} style={{ flex: 1 }}>
        <BaseScreen player={hero} />
      </Animated.View>
    );
  }
  if (status === 'none') return <CharacterCreation onCreate={create} />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.parchment, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
      {status === 'error' ? (
        <>
          <Text style={[t.heading, { textAlign: 'center' }]}>Couldn't reach the realm.</Text>
          <Text style={[t.body, { textAlign: 'center' }]}>Check your connection and try again, or play offline. Offline, your hero stays on this device.</Text>
          <PixelButton onPress={retry} accessibilityLabel="Try again" style={{ width: 220 }}>
            <Text style={[t.button, { textAlign: 'center' }]}>TRY AGAIN</Text>
          </PixelButton>
          <PixelButton onPress={playOffline} fill={colors.vellum} shadow={colors.ink} accessibilityLabel="Play offline" style={{ width: 220 }}>
            <Text style={[t.button, { textAlign: 'center' }]}>PLAY OFFLINE</Text>
          </PixelButton>
        </>
      ) : (
        <Text style={t.stat}>LOADING...</Text>
      )}
    </View>
  );
}
