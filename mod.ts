interface Pixel {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface QOIOptions {
  width: number;
  height: number;
  channels: "rgb" | "rgba";
  colorspace: 0 | 1;
}

export class QOIEncoderStream
  implements TransformStream<Uint8Array, Uint8Array> {
  #options: QOIOptions;
  #source: ReadableStreamBYOBReader;
  #readable: ReadableStream<Uint8Array>;
  #writable: WritableStream<Uint8Array>;
  constructor(options: QOIOptions) {
    const { readable, writable } = new TransformStream<
      Uint8Array,
      Uint8Array
    >();
    this.#options = options;
    this.#source = toByteStream(readable).getReader({ mode: "byob" });
    this.#readable = toByteStream(ReadableStream.from(this.#qoi()));
    this.#writable = writable;
  }

  async #read(): Promise<Uint8Array | undefined> {
    const { done, value } = await this.#source.read(new Uint8Array(4), {
      min: 4,
    });
    if (done) return undefined;
    if (value.length !== 4) {
      throw new RangeError(
        "Stream had an unexpected number of bytes. Should have been devisible by 4",
      );
    }
    return value;
  }

  async *#qoi(): AsyncGenerator<Uint8Array> {
    // Heading
    yield new Uint8Array([113, 111, 105, 102]);
    for (const x of [this.#options.width, this.#options.height]) {
      const view = new DataView(new ArrayBuffer(4));
      view.setUint32(0, x);
      yield new Uint8Array(view.buffer);
    }
    yield new Uint8Array([
      this.#options.channels === "rgb" ? 3 : 4,
      this.#options.colorspace,
    ]);

    // Body
    let count = 0;
    let previousPixel: Pixel = { r: 0, g: 0, b: 0, a: 255 };
    let run = 0;
    const seenPixels: Pixel[] = new Array(64)
      .fill({ r: 0, g: 0, b: 0, a: 255 });
    while (true) {
      const currentPixel: Pixel | undefined = await (async () => {
        const pixel = await this.#read();
        if (pixel == undefined) return pixel;
        ++count;
        return { r: pixel[0], g: pixel[1], b: pixel[2], a: pixel[3] };
      })();
      if (currentPixel == undefined) break;

      if (pixelIsEqual(previousPixel, currentPixel)) {
        ++run;
        if (run === 62) {
          yield new Uint8Array([(0b11 << 6) + run - 1]);
          run = 0;
        }
      } else {
        yield new Uint8Array([(0b11 << 6) + run - 1]);
        run = 0;
      }

      const index = hash(currentPixel);
      if (pixelIsEqual(seenPixels[index], currentPixel)) {
        yield new Uint8Array([(0b00 << 6) + index]);
      } else {
        seenPixels[index] = currentPixel;

        const diffPixel: Pixel = {
          r: currentPixel.r - previousPixel.r,
          g: currentPixel.g - previousPixel.g,
          b: currentPixel.b - previousPixel.b,
          a: currentPixel.a - previousPixel.a,
        };
        if (
          -2 <= diffPixel.r && diffPixel.r <= 1 &&
            -2 <= diffPixel.g && diffPixel.g <= 1 &&
            -2 <= diffPixel.b && diffPixel.b <= 1 &&
            this.#options.channels === "rgba"
            ? diffPixel.a === 0
            : true
        ) {
          yield new Uint8Array([
            (0b01 << 6) +
            (diffPixel.r + 2 << 4) +
            (diffPixel.g + 2 << 2) +
            diffPixel.b + 2,
          ]);
        } else if (
          -32 <= diffPixel.g && diffPixel.g <= 31 &&
            -8 <= diffPixel.r - diffPixel.g &&
            diffPixel.r - diffPixel.g <= 7 &&
            -8 <= diffPixel.b - diffPixel.g &&
            diffPixel.b - diffPixel.g <= 7 &&
            this.#options.channels === "rgba"
            ? diffPixel.a === 0
            : true
        ) {
          yield new Uint8Array([
            (0b10 << 6) + diffPixel.g + 32,
            (diffPixel.r - diffPixel.g + 8 << 4) +
            diffPixel.b - diffPixel.g + 8,
          ]);
        } else if (this.#options.channels === "rgb") {
          yield new Uint8Array([
            0b11111110,
            currentPixel.r,
            currentPixel.g,
            currentPixel.b,
          ]);
        } else {
          yield new Uint8Array([
            0b11111111,
            currentPixel.r,
            currentPixel.g,
            currentPixel.b,
            currentPixel.a,
          ]);
        }

        previousPixel = currentPixel;
      }
    }

    // Footing
    if (this.#options.width * this.#options.height !== count) {
      throw new RangeError(
        `Width (${this.#options.width}) * Height (${this.#options.height}) does not match pixels seen (${count})`,
      );
    }
    yield new Uint8Array([0, 0, 0, 0, 0, 0, 0, 1]);
  }

  get readable(): ReadableStream<Uint8Array> {
    return this.#readable;
  }

  get writable(): WritableStream<Uint8Array> {
    return this.#writable;
  }
}

function hash({ r, g, b, a }: Pixel): number {
  return (r * 3 + g * 5 + b * 7 + a * 11) % 64;
}

function pixelIsEqual(p1: Pixel, p2: Pixel): boolean {
  return p1.r === p2.r && p1.g === p2.g && p1.b === p2.b && p1.a === p2.a;
}

function toByteStream(
  readable: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  try {
    const reader = readable.getReader({ mode: "byob" });
    reader.releaseLock();
    return readable;
  } catch {
    const reader = readable.getReader();
    return new ReadableStream({
      type: "bytes",
      async pull(controller) {
        const value = await async function () {
          while (true) {
            const { done, value } = await reader.read();
            if (done) return undefined;
            if (value.length) return value;
          }
        }();

        if (value == undefined) {
          controller.close();
          return controller.byobRequest?.respond(0);
        }

        if (controller.byobRequest?.view) {
          const buffer = new Uint8Array(controller.byobRequest.view.buffer);
          const size = buffer.length;
          if (value.length > size) {
            buffer.set(value.slice(0, size));
            controller.byobRequest.respond(size);
            controller.enqueue(value.slice(size));
          } else {
            buffer.set(value);
            controller.byobRequest.respond(value.length);
          }
        } else controller.enqueue(value);
      },
    });
  }
}
