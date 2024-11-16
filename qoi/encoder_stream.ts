import { createEncoder } from "./_common.ts";
import type { QOIOptions } from "./types.ts";

/**
 * The QOIEncoderStream is a TransformStream that encodes raw image data into
 * the QOI image format. The raw data is expected to be a sequence of
 * `[ r, g, b, a ]` numbers.
 *
 * @example
 * ```ts
 * import { QOIEncoderStream } from "@img/qoi";
 *
 * await Deno.mkdir(".output/", { recursive: true });
 *
 * await ReadableStream
 *   .from(async function* () {
 *     for (let r = 0; r < 256; ++r) {
 *       for (let c = 0; c < 256; ++c) {
 *         yield Uint8Array.from([255 - r, c, r, 255]);
 *       }
 *     }
 *   }())
 *   .pipeThrough(
 *     new QOIEncoderStream({
 *       width: 256,
 *       height: 256,
 *       channels: "rgb",
 *       colorspace: 0,
 *     }),
 *   )
 *   .pipeTo((await Deno.create(".output/image.qoi")).writable);
 * ```
 *
 * @module
 */
export class QOIEncoderStream extends TransformStream<Uint8Array, Uint8Array> {
  constructor(options: QOIOptions) {
    if (options.width < 0 || Number.isNaN(options.width)) {
      throw new RangeError("Width cannot be a negative number or NaN");
    }
    if (options.height < 0 || Number.isNaN(options.height)) {
      throw new RangeError("Height cannot be a negative number or NaN");
    }
    const isRGB = options.channels === "rgb";
    const buffer = new Uint8Array(3);
    let offset = 0;
    const encoder = createEncoder(isRGB);
    let count = 0;
    super({
      start(controller): void {
        const header = new Uint8Array(14);
        header.set([113, 111, 105, 102]);
        const view = new DataView(header.buffer);
        view.setUint32(4, options.width);
        view.setUint32(8, options.height);
        header[12] = isRGB ? 3 : 4;
        header[13] = options.colorspace;
        controller.enqueue(header);
      },
      transform(chunk, controller): void {
        const originalSize = chunk.length;
        const maxSize = Math.ceil(offset + originalSize / 4) * (isRGB ? 4 : 5);
        // deno-lint-ignore no-explicit-any
        chunk = new Uint8Array((chunk.buffer as any).transfer(maxSize));
        chunk.set(chunk.subarray(0, originalSize), maxSize - originalSize);
        if (offset) {
          chunk.set(
            buffer.subarray(0, offset),
            maxSize - originalSize - offset,
          );
        }
        const { i, o } = encoder(chunk, maxSize - originalSize - offset, 0);
        count += (i - (maxSize - originalSize - offset)) / 4;
        offset = chunk.length - i;
        if (offset) buffer.set(chunk.subarray(i));
        // deno-lint-ignore no-explicit-any
        controller.enqueue(new Uint8Array((chunk.buffer as any).transfer(o)));
      },
      flush(controller): void {
        if (offset) {
          throw new RangeError("Unexpected number of bytes from stream");
        }
        if (options.width * options.height !== count) {
          throw new RangeError(
            `Width * height (${
              options.width * options.height
            }) does not equal pixels encoded (${count}))`,
          );
        }
        controller.enqueue(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 1]));
      },
    });
  }
}
