import { FilterMode, Image, MipmapMode } from '@shopify/react-native-skia';
import { memo, useEffect, useState } from 'react';

import { windImages, type Baked } from './art';
import { LEANS, WIND_BANDS, WIND_TICK, windLean, type Lean } from './ground';

const STILL: Lean[] = new Array(WIND_BANDS).fill(0);

// The meadow's grass and flowers, swaying as gusts roll across it. Each band of the map shows the
// picture for its current lean, stepped on the 12 fps sprite tick; only bands that change redraw.
// With active off (in battle, in the arena, or with Reduce Motion on) everything stands upright.
export const WindLayer = memo(function WindLayer({ s, active }: { s: number; active: boolean }) {
  const pics = windImages();
  const [leans, setLeans] = useState<Lean[]>(STILL);

  useEffect(() => {
    if (!active) {
      setLeans(STILL);
      return;
    }
    const step = () => {
      const now = performance.now();
      setLeans((prev) => {
        const next = prev.map((_, b) => windLean(b, now));
        return next.some((l, b) => l !== prev[b]) ? next : prev;
      });
    };
    step();
    const id = setInterval(step, WIND_TICK);
    return () => clearInterval(id);
  }, [active]);

  return (
    <>
      {pics.map((frames, b) => {
        const f = frames[LEANS.indexOf(leans[b])];
        return f ? <BakedImage key={b} baked={f} s={s} /> : null;
      })}
    </>
  );
});

const NEAREST = { filter: FilterMode.Nearest, mipmap: MipmapMode.None };

// A baked ground layer, scaled up to the map's pixel size without smoothing.
export function BakedImage({ baked, s }: { baked: Baked; s: number }) {
  return <Image image={baked.image} x={baked.x * s} y={baked.y * s} width={baked.w * s} height={baked.h * s} fit="fill" sampling={NEAREST} />;
}
