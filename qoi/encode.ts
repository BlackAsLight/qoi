import { createEncoder } from "./_common.ts";
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
 * await Deno.mkdir(".output/", { recursive: true });
 *
 * const rawData = await new Response(ReadableStream.from(async function* () {
 *   for (let r = 0; r < 256; ++r) {
 *     for (let c = 0; c < 256; ++c) {
 *       yield Uint8Array.from([255 - r, c, r, 255]);
 *     }
 *   }
 * }())).bytes();
 *
 * await Deno.writeFile(".output/image.qoi", encodeQOI(rawData, {
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
  const isRGB = options.channels === "rgb";

  const originalSize = input.length;
  const maxSize = 14 + originalSize + (isRGB ? 0 : originalSize / 4) + 8;
  // deno-lint-ignore no-explicit-any
  const output = new Uint8Array((input.buffer as any).transfer(maxSize));
  output.set(output.subarray(0, originalSize), maxSize - originalSize);

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

  const encoder = createEncoder(isRGB);
  const { i, o } = encoder(output, maxSize - originalSize, 14);
  const count = (i - (maxSize - originalSize)) / 4;
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
