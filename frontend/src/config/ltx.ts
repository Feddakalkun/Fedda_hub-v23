// LTX Video 2.3 stable aspect / resolution helpers.
// Dimensions snapped to multiples of 32 as required by LTX wrapper nodes.

export type LtxRatio =
  | '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | '21:9' | '3:2' | '2:3';

export const LTX_RATIOS: LtxRatio[] = ['1:1', '4:3', '3:4', '16:9', '9:16', '21:9', '3:2', '2:3'];

const BASE_DIMS: Record<LtxRatio, [number, number]> = {
  '1:1': [768, 768],
  '4:3': [1024, 768],
  '3:4': [768, 1024],
  '16:9': [1280, 704],
  '9:16': [704, 1280],
  '21:9': [1344, 576],
  '3:2': [1152, 768],
  '2:3': [768, 1152],
};

export function getLtxDimensions(ratio: LtxRatio | string) {
  const key = (LTX_RATIOS.includes(ratio as LtxRatio) ? ratio : '16:9') as LtxRatio;
  const [w, h] = BASE_DIMS[key] ?? [1280, 704];
  const snap = (n: number) => Math.max(32, Math.round(n / 32) * 32);
  return { width: snap(w), height: snap(h) };
}
