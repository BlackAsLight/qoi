export function isEqual(
  previousPixel: Uint8Array,
  currentPixel: Uint8Array,
  isRGB: boolean,
): boolean {
  for (let i = 0; i < (isRGB ? 3 : 4); ++i) {
    if (previousPixel[i] !== currentPixel[i]) return false;
  }
  return true;
}

export function calcIndex(pixel: Uint8Array, isRGB: boolean): number {
  return (
    pixel[0] * 3 +
    pixel[1] * 5 +
    pixel[2] * 7 +
    (isRGB ? 255 * 11 : pixel[3] * 11)
  ) % 64;
}
