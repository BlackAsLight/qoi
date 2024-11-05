import { calcIndex } from "./_common.ts";
import type { QOIOptions } from "./types.ts";

/**
 * decodeQOI is a function that decodes a QOI image into raw image data. The raw
 * image data is a sequence of `[ r, g, b, a ]` numbers.
 *
 * ```ts
 * import { decodeQOI, encodeQOI } from "@img/qoi";
 *
 * const encodedData = encodeQOI(
 *   await new Response(ReadableStream.from(async function* () {
 *     for (let r = 0; r < 256; ++r) {
 *       for (let c = 0; c < 256; ++c) {
 *         yield new Uint8Array([255 - r, c, r, 255]);
 *       }
 *     }
 *   }())).bytes(),
 *   { width: 256, height: 256, channels: "rgb", colorspace: 0 },
 * );
 *
 * console.log(decodeQOI(encodedData).header)
 * ```
 *
 * @param input The encoded image data to be decoded.
 * @returns The raw/decoded image data.
 *
 * @module
 */
export function decodeQOI(
  input: Uint8Array | Uint8ClampedArray,
): { header: QOIOptions; body: Uint8Array } {
  if (input.length < 14 + 8) {
    throw new RangeError("QOI input is too short to be valid");
  }
  if (![113, 111, 105, 102].every((x, i) => x === input[i])) {
    throw new TypeError("QOI input had invalid magic number");
  }
  if (input[12] !== 3 && input[12] !== 4) {
    throw new TypeError("QOI input had invalid channels");
  }
  if (input[13] !== 0 && input[13] !== 1) {
    throw new TypeError("QOI input had invalid colorspace");
  }
  const view = new DataView(input.buffer);
  const header: QOIOptions = {
    width: view.getUint32(4),
    height: view.getUint32(8),
    channels: input[12] === 3 ? "rgb" : "rgba",
    colorspace: input[13],
  };

  const originalSize = input.length;
  const maxSize = 14 +
    4 * header.width * header.height * (header.channels === "rgb" ? 1 : 1.25) +
    8;
  // deno-lint-ignore no-explicit-any
  const output = new Uint8Array((input.buffer as any).transfer(maxSize));
  if (maxSize > originalSize) {
    output.set(output.subarray(0, originalSize), maxSize - originalSize);
  }

  let i = 14 + maxSize - originalSize;
  let o = 0;
  let count = 0;
  const previousPixel = new Uint8Array([0, 0, 0, 255]);
  const seenPixels: Uint8Array[] = new Array(64)
    .fill(0)
    .map((_) => new Uint8Array(4));
  while (i <= output.length - 8) {
    if ([0, 0, 0, 0, 0, 0, 0, 1].every((x, j) => x === output[i + j])) {
      if (count !== header.width * header.height) {
        throw new RangeError(
          `QOI input received exit code, but pixels (${count}) decoded does not match width * height (${
            header.width * header.height
          }) in header`,
        );
      }
      return {
        header,
        body: new Uint8Array(
          // deno-lint-ignore no-explicit-any
          (output.buffer as any).transfer(4 * header.width * header.height),
        ),
      };
    }
    ++count;

    if (output[i] === 0b11111111) {
      // QOI_OP_RGBA
      previousPixel.set(output.subarray(i + 1, i + 5));
      seenPixels[calcIndex(previousPixel, false)].set(previousPixel);
      output.set(previousPixel, o++ * 4);
      i += 5;
    } else if (output[i] === 0b11111110) {
      // QOI_OP_RGB
      previousPixel.set(output.subarray(i + 1, i + 4));
      previousPixel[3] = 255;
      seenPixels[calcIndex(previousPixel, true)].set(previousPixel);
      output.set(previousPixel, o++ * 4);
      i += 4;
    } else {
      switch (output[i] >> 6) {
        case 0:
          // QOI_OP_INDEX
          previousPixel.set(seenPixels[output[i++] & 0b00111111]);
          output.set(previousPixel, o++ * 4);
          break;
        case 1:
          // QOI_OP_DIFF
          previousPixel[0] += (output[i] >> 4 & 0b11) - 2;
          previousPixel[1] += (output[i] >> 2 & 0b11) - 2;
          previousPixel[2] += (output[i++] & 0b11) - 2;
          seenPixels[calcIndex(previousPixel, false)].set(previousPixel);
          output.set(previousPixel, o++ * 4);
          break;
        case 2: {
          // QOI_OP_LUMA
          const greenDiff = (output[i] & 0b00111111) - 32;
          previousPixel[0] += (output[++i] >> 4) + greenDiff - 8;
          previousPixel[1] += greenDiff;
          previousPixel[2] += (output[i++] & 0b00001111) + greenDiff - 8;
          seenPixels[calcIndex(previousPixel, false)].set(previousPixel);
          output.set(previousPixel, o++ * 4);
          break;
        }
        default: { // 3
          // QOI_OP_RUN
          const run = output[i++] & 0b00111111;
          count += run;
          for (let j = 0; j < run; ++j) output.set(previousPixel, o++ * 4);
          output.set(previousPixel, o++ * 4);
        }
      }
    }
  }
  throw new RangeError("Expected more bytes from input");
}
