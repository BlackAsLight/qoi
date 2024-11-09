import { createDecoder } from "./_common.ts";
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
  output.set(output.subarray(0, originalSize), maxSize - originalSize);

  const decoder = createDecoder();
  const { o, c, isEnd } = decoder(output, maxSize - originalSize + 14, 0);
  if (isEnd) {
    if (c !== header.width * header.height) {
      throw new RangeError(
        `QOI input received exit code, but pixels (${c}) decoded does not match width * height (${
          header.width * header.height
        }) in header`,
      );
    }
    // deno-lint-ignore no-explicit-any
    return { header, body: new Uint8Array((output.buffer as any).transfer(o)) };
  }
  throw new RangeError("Expected more bytes from input");
}
