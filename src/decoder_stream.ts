import { toByteStream } from "@std/streams/unstable-to-byte-stream";
import type { QOIOptions } from "./types.ts";

/**
 * The QOIDecoderStream is a TransformStream that decodes qoi image format into
 * raw image data. The raw data is a sequence of `[ r, g, b, a ]` numbers.
 *
 * @example
 * ```ts ignore
 * import { QOIDecoderStream } from "img/qoi";
 *
 * const decoderStream = new QOIDecoderStream();
 *
 * const rawStream = (await Deno.open("image.qoi"))
 *   .readable
 *   .pipeThrough(decoderStream);
 *
 * console.log(await decoderStream.option);
 * ```
 */
export class QOIDecoderStream
  implements TransformStream<Uint8Array, Uint8Array> {
  #options: QOIOptions | undefined | Error;
  #buffer: number[] = [];
  #source: ReadableStreamBYOBReader;
  #readable: ReadableStream<Uint8Array>;
  #writable: WritableStream<Uint8Array>;
  constructor() {
    const { readable, writable } = new TransformStream<
      Uint8Array,
      Uint8Array
    >();
    this.#source = toByteStream(readable).getReader({ mode: "byob" });
    this.#header();
    this.#readable = toByteStream(
      ReadableStream
        .from(this.#qoi())
        .pipeThrough(
          new TransformStream({
            cancel: async (reason) => await this.#source.cancel(reason),
          }),
        ),
    );
    this.#writable = writable;
  }

  async #read(bytes: number): Promise<Uint8Array> {
    const { done, value } = await this.#source
      .read(new Uint8Array(bytes), { min: bytes });
    if (done || value.length !== bytes) {
      this.#source.cancel("Unexpected number of bytes from readable stream");
      throw new RangeError("Unexpected number of bytes from readable stream");
    }
    this.#buffer.push(...value);
    return Uint8Array.from(this.#buffer.splice(0, this.#buffer.length - 8));
  }

  async *#qoi(): AsyncGenerator<Uint8Array> {
    // Check Header
    while (this.#options == undefined) {
      await new Promise((a) => setTimeout(a, 0));
    }
    if (this.#options instanceof Error) {
      this.#source.cancel(this.#options.message);
      throw this.#options;
    }

    // Load Buffer
    {
      const { done, value } = await this.#source
        .read(new Uint8Array(8), { min: 8 });
      if (done || value.length !== 8) {
        this.#source.cancel("QOI stream was too short to be valid");
        throw new RangeError("QOI stream was too short to be valid");
      }
      this.#buffer.push(...value);
    }

    let count = 0;
    let previousPixel = new Uint8Array([0, 0, 0, 255]);
    const seenPixels: Uint8Array[] = new Array(64)
      .fill(new Uint8Array([0, 0, 0, 0]));
    while (true) {
      // Premature Exit
      if ([0, 0, 0, 0, 0, 0, 0, 1].every((x, i) => x === this.#buffer[i])) {
        if (count !== this.#options.width * this.#options.height) {
          this.#source.cancel(
            `QOI stream received exit code, but pixels (${count}) decoded does not match width * height (${
              this.#options.width * this.#options.height
            }) in header`,
          );
          throw new RangeError(
            `QOI stream received exit code, but pixels (${count}) decoded does not match width * height (${
              this.#options.width * this.#options.height
            }) in header`,
          );
        }
        await this.#source.cancel("QOI stream finished");
        return;
      }

      const value = await this.#read(1);
      ++count;

      if (value[0] === 0b11111111) {
        // QOI_OP_RGBA
        const pixel = await this.#read(4);
        previousPixel = pixel;
        seenPixels[this.#index(previousPixel)] = previousPixel;
        yield previousPixel.slice();
      } else if (value[0] === 0b11111110) {
        // QOI_OP_RGB
        const pixel = await this.#read(3);
        previousPixel = new Uint8Array([...pixel, 255]);
        seenPixels[this.#index(previousPixel)] = previousPixel;
        yield previousPixel.slice();
      } else {
        switch (value[0] >> 6 & 0xFF) {
          case 0:
            yield seenPixels[value[0] & 0b00_111111].slice();
            break;
          case 1: {
            // QOI_OP_DIFF
            previousPixel = new Uint8Array([
              (value[0] >> 4 & 0b11) + previousPixel[0] - 2,
              (value[0] >> 2 & 0b11) + previousPixel[1] - 2,
              (value[0] & 0b11) + previousPixel[2] - 2,
              previousPixel[3],
            ]);
            seenPixels[this.#index(previousPixel)] = previousPixel;
            yield previousPixel.slice();
            break;
          }
          case 2: {
            // QOI_OP_LUMA
            const next = await this.#read(1);
            const greenDiff = (value[0] & 0b00_111111) - 32;
            previousPixel = new Uint8Array([
              (next[0] >> 4) + greenDiff + previousPixel[0] - 8,
              greenDiff + previousPixel[1],
              (next[0] & 0b0000_1111) + greenDiff + previousPixel[2] - 8,
              previousPixel[3],
            ]);
            seenPixels[this.#index(previousPixel)] = previousPixel;
            yield previousPixel.slice();
            break;
          }
          default: // 3
            // QOI_OP_RUN
            count += value[0] & 0b00_111111;
            yield new Uint8Array(4 * (value[0] & 0b00_111111) + 4)
              .map((_, i) => previousPixel[i % 4]);
        }
      }
    }
  }

  async #header(): Promise<void> {
    const { done, value } = await this.#source
      .read(new Uint8Array(14), { min: 14 });

    if (done || value.length !== 14) {
      this.#options = new RangeError("QOI stream was too short to be valid");
    } else if (![113, 111, 105, 102].every((x, i) => x === value[i])) {
      this.#options = new TypeError("QOI stream had invalid magic number");
    } else if (value[12] !== 3 && value[12] !== 4) {
      this.#options = new TypeError("QOI stream had invalid channels");
    } else if (value[13] !== 0 && value[13] !== 1) {
      this.#options = new TypeError("QOI stream had invalid colorspace");
    } else {
      const view = new DataView(value!.buffer);
      this.#options = {
        width: view.getUint32(4),
        height: view.getUint32(8),
        channels: value![12] === 3 ? "rgb" : "rgba",
        colorspace: value![13] as 0,
      };
    }
  }

  get options(): Promise<QOIOptions> | QOIOptions {
    if (this.#options == undefined) {
      return (async () => {
        while (this.#options == undefined) {
          await new Promise((a) => setTimeout(a, 0));
        }
        if (this.#options instanceof Error) throw this.#options;
        return this.#options;
      })();
    } else if (this.#options instanceof Error) throw this.#options;
    else return this.#options;
  }

  #index(a: Uint8Array): number {
    return (a[0] * 3 + a[1] * 5 + a[2] * 7 + a[3] * 11) % 64;
  }

  get readable(): ReadableStream<Uint8Array> {
    return this.#readable;
  }

  get writable(): WritableStream<Uint8Array> {
    return this.#writable;
  }
}
