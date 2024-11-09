import { toByteStream } from "@std/streams/unstable-to-byte-stream";
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
 *   .pipeTo((await Deno.create("image.qoi")).writable);
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
    this.#width = options.width;
    this.#height = options.height;
    this.#isRGB = options.channels === "rgb";
    this.#colorspace = options.colorspace;
    const { readable, writable } = new TransformStream<
      Uint8Array,
      Uint8Array
    >();
    this.#source = toByteStream(readable).getReader({ mode: "byob" });
    this.#readable = toByteStream(ReadableStream.from(this.#qoi()));
    this.#writable = writable;
  }

  async *#qoi(): AsyncGenerator<Uint8Array> {
    // Header
    yield new Uint8Array([113, 111, 105, 102]);
    for (const x of [this.#width, this.#height]) {
      const view = new DataView(new ArrayBuffer(4));
      view.setUint32(0, x);
      yield new Uint8Array(view.buffer);
    }
    yield new Uint8Array([this.#isRGB ? 3 : 4, this.#colorspace]);

    // Body
    let count = 0;
    let run = 0;
    let previousPixel = new Uint8Array([0, 0, 0, 255]);
    const seenPixels: Uint8Array[] = new Array(64)
      .fill(new Uint8Array([0, 0, 0, 0]));
    while (true) {
      const { done, value } = await this.#source
        .read(new Uint8Array(4), { min: 4 });
      if (done) {
        if (value instanceof Uint8Array && value.length) {
          throw new RangeError(
            "Unexpected number of bytes from readable stream",
          );
        }
        if (run) {
          // QOI_OP_RUN
          yield new Uint8Array([(0b11 << 6) + run - 1]);
        }
        break;
      }
      ++count;

      if (this.#isEqual(previousPixel, value)) {
        ++run;
        // QOI_OP_RUN
        if (run === 62) {
          yield new Uint8Array([0b11_111101]);
          run = 0;
        }
      } else {
        if (run) {
          // QOI_OP_RUN
          yield new Uint8Array([(0b11 << 6) + run - 1]);
          run = 0;
        }

        const index = this.#index(value);
        if (this.#isEqual(seenPixels[index], value)) {
          // QOI_OP_INDEX
          yield new Uint8Array([(0b00 << 6) + index]);
        } else {
          seenPixels[index] = value;

          let diff = new Array(this.#isRGB ? 3 : 4).fill(0)
            .map((_, i) => value[i] - previousPixel[i]);
          if (
            -2 <= diff[0] && diff[0] <= 1 &&
            -2 <= diff[1] && diff[1] <= 1 &&
            -2 <= diff[2] && diff[2] <= 1 &&
            !diff[3]
          ) {
            // QOI_OP_DIFF
            yield new Uint8Array([
              (0b01 << 6) + (diff[0] + 2 << 4) + (diff[1] + 2 << 2) + diff[2] +
              2,
            ]);
          } else {
            diff = [diff[0] - diff[1], diff[1], diff[2] - diff[1], diff[3]];
            if (
              -8 <= diff[0] && diff[0] <= 7 &&
              -32 <= diff[1] && diff[1] <= 31 &&
              -8 <= diff[2] && diff[2] <= 7 &&
              !diff[3]
            ) {
              // QOI_OP_LUMA
              yield new Uint8Array([
                (0b10 << 6) + diff[1] + 32,
                (diff[0] + 8 << 4) + diff[2] + 8,
              ]);
            } else if (this.#isRGB) {
              // QOI_OP_RGB
              yield new Uint8Array([0b11111110, value[0], value[1], value[2]]);
            } else {
              // QOI_OP_RGBA
              yield new Uint8Array([
                0b11111111,
                value[0],
                value[1],
                value[2],
                value[3],
              ]);
            }
          }
        }
      }

      previousPixel = value;
    }

    // Footer
    if (this.#width * this.#height !== count) {
      throw new RangeError(
        `Width * height (${
          this.#width * this.#height
        }) does not equal pixels encoded (${count})`,
      );
    }
    yield new Uint8Array([0, 0, 0, 0, 0, 0, 0, 1]);
  }

  #isEqual(a: Uint8Array, b: Uint8Array): boolean {
    for (let i = 0; i < (this.#isRGB ? 3 : 4); ++i) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  #index(a: Uint8Array): number {
    return (a[0] * 3 + a[1] * 5 + a[2] * 7 +
      (this.#isRGB ? 255 * 11 : a[3] * 11)) % 64;
  }

  get readable(): ReadableStream<Uint8Array> {
    return this.#readable;
  }

  get writable(): WritableStream<Uint8Array> {
    return this.#writable;
  }
}
