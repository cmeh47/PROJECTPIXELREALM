import { Canvas, Picture } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { colors, fonts } from '../theme';
import { Framed, haptic, styles as t } from '../ui/pixel';
import { bagPicture, coinPicture, logPicture, meatPicture } from './art';

// Your inventory: one place for everything you carry. 20 slots; each holds a stack of up to 99 of
// one item. The server keeps the same rules (supabase/migrations/*_boar_hunting.sql).
export const INV_SLOTS = 20;
export const INV_STACK = 99;
export const MEAT_PRICE = 5;

export type Carry = { wood: number; meat: number };
export type ItemId = keyof Carry;

const ITEMS: Record<ItemId, { name: string; about: string; pic: (s: number) => ReturnType<typeof logPicture>; w: number; h: number }> = {
  wood: { name: 'Wood', about: 'For building', pic: logPicture, w: 14, h: 9 },
  meat: { name: 'Boar meat', about: `The butcher pays ${MEAT_PRICE} coins`, pic: meatPicture, w: 14, h: 12 },
};

const slotsFor = (n: number) => Math.ceil(n / INV_STACK);
export const slotsUsed = (c: Carry) => slotsFor(c.wood) + slotsFor(c.meat);
// Whether n more of an item fit, filling its last stack first.
export const roomFor = (c: Carry, item: ItemId, n: number) => slotsUsed({ ...c, [item]: c[item] + n }) <= INV_SLOTS;

// The stacks in slot order: wood first, then meat, each split into stacks of 99.
function stacks(c: Carry): { item: ItemId; n: number }[] {
  const out: { item: ItemId; n: number }[] = [];
  for (const item of ['wood', 'meat'] as ItemId[]) {
    let left = c[item];
    while (left > 0) {
      out.push({ item, n: Math.min(INV_STACK, left) });
      left -= INV_STACK;
    }
  }
  return out;
}

// The pack button under the base panel. It squashes a pixel when something goes in (bump changes),
// pops open for a beat, and shakes when there's no room (full changes).
export function PackButton({ count, bump, full, onPress }: { count: number; bump: number; full: number; onPress: () => void }) {
  const reduceMotion = useReducedMotion();
  const dy = useSharedValue(0);
  const dx = useSharedValue(0);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!bump) return;
    setOpen(true);
    const id = setTimeout(() => setOpen(false), 250);
    if (!reduceMotion) dy.value = withSequence(withTiming(3, { duration: 83 }), withTiming(0, { duration: 166 }));
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bump]);
  useEffect(() => {
    if (!full || reduceMotion) return;
    dx.value = withSequence(withTiming(-3, { duration: 40 }), withTiming(3, { duration: 80 }), withTiming(-2, { duration: 80 }), withTiming(0, { duration: 60 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: dx.value }, { translateY: dy.value }] }));
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Inventory, ${count} ${count === 1 ? "item" : "items"}`} onPress={onPress} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
      <Animated.View style={style}>
        <Framed depth={1}>
          <View style={st.pack}>
            <Canvas style={{ width: 32, height: 32 }}>
              <Picture picture={bagPicture(open, 2)} />
            </Canvas>
          </View>
        </Framed>
        {count > 0 ? (
          <View style={st.badge}>
            <Text style={st.badgeText}>{count}</Text>
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

// Coins, shown in the base panel.
export function CoinCounter({ coins }: { coins: number }) {
  return (
    <View style={st.counter} accessibilityLabel={`${coins} coins`}>
      <Canvas style={{ width: 18, height: 18 }}>
        <Picture picture={coinPicture(2)} />
      </Canvas>
      <Text style={t.stat}>{coins}</Text>
    </View>
  );
}

// The inventory sheet: slides up from the bottom. Tap a slot to see what it is.
export function InventorySheet({ carry, onClose, bottom }: { carry: Carry; onClose: () => void; bottom: number }) {
  const reduceMotion = useReducedMotion();
  const rise = useSharedValue(reduceMotion ? 0 : 1);
  const [sel, setSel] = useState<number | null>(null);
  useEffect(() => {
    rise.value = withTiming(0, { duration: 333, easing: Easing.out(Easing.quad) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: rise.value * 420 }] }));
  const list = stacks(carry);
  const picked = sel != null ? list[sel] : undefined;
  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={[StyleSheet.absoluteFill, st.dim]} onPress={onClose} accessibilityLabel="Close inventory" />
      <Animated.View style={[st.sheetWrap, { bottom: bottom }, style]}>
        <Framed fill={colors.parchment}>
          <View style={st.sheet}>
            <View style={st.head}>
              <Text style={t.statSoft}>INVENTORY</Text>
              <Text style={t.statSoft}>
                {list.length} / {INV_SLOTS}
              </Text>
            </View>
            <View style={st.grid}>
              {Array.from({ length: INV_SLOTS }, (_, i) => {
                const it = list[i];
                const on = sel === i && !!it;
                return (
                  <Pressable
                    key={i}
                    onPress={() => {
                      if (!it) return;
                      haptic('light');
                      setSel(on ? null : i);
                    }}
                    accessibilityLabel={it ? `${ITEMS[it.item].name}, ${it.n}` : 'Empty slot'}
                    style={[st.slot, on && st.slotOn]}
                  >
                    {it ? (
                      <>
                        <Canvas style={{ width: ITEMS[it.item].w * 2, height: ITEMS[it.item].h * 2 }}>
                          <Picture picture={ITEMS[it.item].pic(2)} />
                        </Canvas>
                        <Text style={st.n}>{it.n}</Text>
                      </>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
            <View style={st.about}>
              {picked ? (
                <>
                  <Text style={[t.caption, { fontSize: 15 }]}>{ITEMS[picked.item].name}</Text>
                  <Text style={[t.statSoft, { color: colors.lavenderDeep }]}>{ITEMS[picked.item].about.toUpperCase()}</Text>
                </>
              ) : (
                <Text style={[t.body, { fontSize: 13, color: colors.inkSoft }]}>Tap a slot to look at it.</Text>
              )}
            </View>
          </View>
        </Framed>
      </Animated.View>
    </View>
  );
}

const SLOT = 52;
const st = StyleSheet.create({
  pack: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', right: -4, bottom: -2, minWidth: 20, paddingHorizontal: 3, backgroundColor: colors.butter, borderWidth: 2, borderColor: colors.ink, alignItems: 'center' },
  badgeText: { fontFamily: fonts.stat, fontSize: 10, lineHeight: 13, color: colors.ink },
  counter: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  dim: { backgroundColor: 'rgba(59,42,74,0.35)' },
  sheetWrap: { position: 'absolute', left: 12, right: 12, alignItems: 'center' },
  sheet: { padding: 12, gap: 8, width: SLOT * 5 + 4 * 6 + 24 },
  head: { flexDirection: 'row', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  slot: { width: SLOT, height: SLOT, borderWidth: 2, borderColor: colors.stoneDeep, backgroundColor: colors.vellum, alignItems: 'center', justifyContent: 'center' },
  slotOn: { borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.butter },
  n: { position: 'absolute', right: 2, bottom: 0, fontFamily: fonts.stat, fontSize: 11, lineHeight: 14, color: colors.ink },
  about: { minHeight: 40, justifyContent: 'center' },
});
