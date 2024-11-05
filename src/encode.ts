import { calcIndex, isEqual } from "./_common.ts";
import type { QOIOptions } from "./types.ts";

/**
 * encodeQOI is a function that encodes raw image data into the QOI image
 * format. The raw image data is expected to be in a sequence of
 * `[ r, g, b, a ]` numbers.
 *
 * @example
 * ```ts
 * import { encodeQOI } from "@img/qoi";
 *
 * const rawData = await new Response(ReadableStream.from(async function* () {
 *   for (let r = 0; r < 256; ++r) {
 *     for (let c = 0; c < 256; ++c) {
 *       yield Uint8Array.from([255 - r, c, r, 255]);
 *     }
 *   }
 * }())).bytes();
 *
 * await Deno.writeFile("image.qoi", encodeQOI(rawData, {
 *   width: 256,
 *   height: 256,
 *   channels: "rgb",
 *   colorspace: 0,
 * }));
 * ```
 *
 * @param input The raw image data to be encoded.
 * @returns The encoded image data.
 *
 * @module
 */
export function encodeQOI(
  input: Uint8Array | Uint8ClampedArray,
  options: QOIOptions,
): Uint8Array {
  if (options.width < 0 || Number.isNaN(options.width)) {
    throw new RangeError("Width cannot be a negative number or NaN");
  }
  if (options.height < 0 || Number.isNaN(options.height)) {
    throw new RangeError("Height cannot be a negative number or NaN");
  }
  if (input.length % 4 !== 0) {
    throw new RangeError("Unexpected number of bytes from input");
  }

  const originalSize = input.length;
  const maxSize = 14 + originalSize +
    (options.channels === "rgb" ? 0 : originalSize / 4) + 8;
  const isRGB = options.channels === "rgb";
  // deno-lint-ignore no-explicit-any
  const output = new Uint8Array((input.buffer as any).transfer(maxSize));
  output.set(output.subarray(0, originalSize), 14);
  output.set([113, 111, 105, 102]);
  {
    const view = new DataView(new ArrayBuffer(4));
    view.setUint32(0, options.width);
    output.set(new Uint8Array(view.buffer), 4);
    view.setUint32(0, options.height);
    output.set(new Uint8Array(view.buffer), 8);
  }
  output[12] = isRGB ? 3 : 4;
  output[13] = options.colorspace;

  let offset = 14;
  let o = offset;
  let run = 0;
  let count = 0;
  const previousPixel = new Uint8Array([0, 0, 0, 255]);
  const seenPixels: Uint8Array[] = new Array(64)
    .fill(0)
    .map((_) => new Uint8Array([0, 0, 0, 0]));
  for (let i = offset; i < originalSize + offset; i += 4) {
    const currentPixel = output.subarray(i, i + 4);
    ++count;
    if (isEqual(previousPixel, currentPixel, isRGB)) {
      ++run;
      // QOI_OP_RUN
      if (run === 62) {
        output[o++] = 0b11_111101;
        run = 0;
      }
    } else {
      // QOI_OP_RUN
      if (run) {
        output[o++] = (0b11 << 6) + run - 1;
        run = 0;
      }

      const index = calcIndex(currentPixel, isRGB);
      if (isEqual(seenPixels[index], currentPixel, isRGB)) {
        // QOI_OP_INDEX
        output[o++] = (0b00 << 6) + index;
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
          output[o++] = (0b01 << 6) +
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
            output[o++] = (0b10 << 6) + diff[1] + 32;
            output[o++] = (diff[0] + 8 << 4) + diff[2] + 8;
          } else if (isRGB) {
            // QOI_OP_RGB
            output.set(currentPixel.subarray(0, 3), o + 1);
            output[o] = 0b11111110;
            o += 4;
          } else {
            // QOI_OP_RGBA
            if (o >= i) {
              output.set(output.subarray(i, originalSize + offset++), ++i);
            }
            output.set(output.subarray(i, i + 4), o + 1);
            output[o] = 0b11111111;
            o += 5;
          }
        }
      }
    }
  }
  if (run) {
    // QOI_OP_RUN
    output[o++] = (0b11 << 6) + run - 1;
  }
  if (options.width * options.height !== count) {
    throw new RangeError(
      `Width * height (${
        options.width * options.height
      }) does not equal pixels encoded (${count}))`,
    );
  }

  output.set([0, 0, 0, 0, 0, 0, 0, 1], o);
  // deno-lint-ignore no-explicit-any
  return new Uint8Array((output.buffer as any).transfer(o + 8));
}
