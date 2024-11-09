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

export function createEncoder(isRGB: boolean): (
  data: Uint8Array,
  i: number,
  o: number,
) => { i: number; o: number } {
  let run = 0;
  const previousPixel = new Uint8Array([0, 0, 0, 255]);
  const seenPixels: Uint8Array[] = new Array(64)
    .fill(0)
    .map((_) => new Uint8Array([0, 0, 0, 0]));
  return function (
    data: Uint8Array,
    i: number,
    o: number,
  ): { i: number; o: number } {
    for (; i <= data.length - 4; i += 4) {
      const currentPixel = data.subarray(i, i + 4);
      if (isEqual(previousPixel, currentPixel, isRGB)) {
        ++run;
        // QOI_OP_RUN
        if (run === 62) {
          data[o++] = 0b11_111101;
          run = 0;
        }
      } else {
        // QOI_OP_RUN
        if (run) {
          data[o++] = 0b11 << 6 + run - 1;
          run = 0;
        }

        const index = calcIndex(currentPixel, isRGB);
        if (isEqual(seenPixels[index], currentPixel, isRGB)) {
          // QOI_OP_INDEX
          data[o++] = (0b00 << 6) + index;
          previousPixel.set(currentPixel);
        } else {
          seenPixels[index].set(currentPixel);

          const diff = new Array(isRGB ? 3 : 4)
            .fill(0)
            .map((_, i) => currentPixel[i] - previousPixel[i]);
          previousPixel.set(currentPixel);
          if (
            -2 <= diff[0] && diff[0] <= 1 &&
            -2 <= diff[1] && diff[1] <= 1 &&
            -2 <= diff[2] && diff[2] <= 1 &&
            !diff[3]
          ) {
            // QOI_OP_DIFF
            data[o++] = (0b01 << 6) +
              (diff[0] + 2 << 4) +
              (diff[1] + 2 << 2) +
              diff[2] + 2;
          } else {
            diff[0] -= diff[1];
            diff[2] -= diff[1];
            if (
              -8 <= diff[0] && diff[0] <= 7 &&
              -32 <= diff[1] && diff[1] <= 31 &&
              -8 <= diff[2] && diff[2] <= 7 &&
              !diff[3]
            ) {
              // QOI_OP_LUMA
              data[o++] = (0b10 << 6) + diff[1] + 32;
              data[o++] = (diff[0] + 8 << 4) + diff[2] + 8;
            } else if (isRGB) {
              // QOI_OP_RGB
              data.set(currentPixel.subarray(0, 3), o + 1);
              data[o] = 0b11111110;
              o += 4;
            } else {
              // QOI_OP_RGBA
              data.set(currentPixel, o + 1);
              data[o] = 0b11111111;
              o += 5;
            }
          }
        }
      }
    }
    if (run) {
      // QOI_OP_RUN
      data[o++] = (0b11 << 6) + run - 1;
    }
    return { i, o };
  };
}
