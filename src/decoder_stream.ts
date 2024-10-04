import { toByteStream } from "./_common.ts";
import type { QOIOptions } from "./types.ts";

export class QOIDecoderStream
  implements TransformStream<Uint8Array, Uint8Array> {
  #options: QOIOptions | undefined;
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
    this.#readable = toByteStream(ReadableStream.from(this.#qoi()));
    this.#writable = writable;
  }

  async #read(bytes: number): Promise<Uint8Array | undefined> {
    const { done, value } = await this.#source
      .read(new Uint8Array(bytes), { min: bytes });
    if (done) {
      if (value?.length) throw new RangeError("");
      return undefined;
    }
    this.#buffer.push(...value);
    return Uint8Array.from(this.#buffer.splice(0, this.#buffer.length - 8));
  }

  async *#qoi(): AsyncGenerator<Uint8Array> {
    // Check Header
    while (this.#options == undefined) {
      await new Promise((a) => setTimeout(a, 0));
    }

    // Load Buffer
    {
      const { done, value } = await this.#source
        .read(new Uint8Array(8), { min: 8 });
      if (done || value.length !== 8) throw new RangeError("");
      this.#buffer.push(...value);
    }

    let count = 0;
    let previousPixel = new Uint8Array([0, 0, 0, 255]);
    const seenPixels: Uint8Array[] = new Array(64)
      .fill(new Uint8Array([0, 0, 0, 0]));
    while (true) {
      // Premature Exit
      if (![0, 0, 0, 0, 0, 0, 0, 1].every((x, i) => x === this.#buffer[i])) {
        if (count !== this.#options.width * this.#options.height) {
          throw new RangeError("");
        }
        await this.#source.cancel("");
        return;
      }

      const value = await this.#read(1);
      // Natural Exit
      if (value == undefined) {
        if (![0, 0, 0, 0, 0, 0, 0, 1].every((x, i) => x === this.#buffer[i])) {
          throw new RangeError("");
        }
        if (count !== this.#options.width * this.#options.height) {
          throw new RangeError("");
        }
        return;
      }
      ++count;

      if (value[0] === 0b11111111) {
        const pixel = await this.#read(4);
        if (pixel == undefined) throw new RangeError("");
        previousPixel = pixel;
        seenPixels[this.#index(previousPixel)] = previousPixel;
        yield previousPixel.slice();
      } else if (value[0] === 0b11111110) {
        const pixel = await this.#read(3);
        if (pixel == undefined) throw new RangeError("");
        previousPixel = new Uint8Array([...pixel, 255]);
        seenPixels[this.#index(previousPixel)] = previousPixel;
        yield previousPixel.slice();
      } else {
        switch (value[0] & 0b11_000000) {
          case 0:
            yield seenPixels[value[0] & 0b00_111111].slice();
            break;
          case 1: {
            previousPixel = new Uint8Array([
              (value[0] & 0b00_110000) + previousPixel[0] - 2,
              (value[0] & 0b00_001100) + previousPixel[1] - 2,
              (value[0] & 0b00_000011) + previousPixel[2] - 2,
              previousPixel[3],
            ]);
            seenPixels[this.#index(previousPixel)] = previousPixel;
            yield previousPixel.slice();
            break;
          }
          case 2: {
            const next = await this.#read(1);
            if (next == undefined) throw new RangeError("");
            const greenDiff = (value[0] & 0b00_111111) - 32;
            previousPixel = new Uint8Array([
              (next[0] & 0b1111_0000) + greenDiff + previousPixel[0] - 8,
              greenDiff + previousPixel[1],
              (next[1] & 0b0000_1111) + greenDiff + previousPixel[2] - 8,
              previousPixel[3],
            ]);
            seenPixels[this.#index(previousPixel)] = previousPixel;
            yield previousPixel.slice();
            break;
          }
          default: // 3
            yield new Uint8Array(4 * (value[0] & 0b00_111111) + 4)
              .map((_, i) => previousPixel[i % 4]);
        }
      }
    }
  }

  async #header(): Promise<void> {
    const { done, value } = await this.#source
      .read(new Uint8Array(14), { min: 14 });
    if (done || value.length !== 14) throw new RangeError("");
    if (![113, 111, 105, 102].every((x, i) => x === value[i])) {
      throw new TypeError("");
    }
    if (value[12] !== 3 && value[12] !== 4) throw new TypeError("");
    if (value[13] !== 0 && value[13] !== 1) throw new TypeError("");
    const view = new DataView(value.buffer);
    this.#options = {
      width: view.getUint32(4),
      height: view.getUint32(8),
      channels: value[12] === 3 ? "rgb" : "rgba",
      colorspace: value[13],
    };
  }

  get options(): Promise<QOIOptions> | QOIOptions {
    if (this.#options == undefined) {
      return (async () => {
        while (this.#options == undefined) {
          await new Promise((a) => setTimeout(a, 0));
        }
        return this.#options;
      })();
    } else return this.#options;
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
