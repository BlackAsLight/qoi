import { toByteStream } from "@std/streams/unstable-to-byte-stream";
import type { QOIOptions } from "./types.ts";
import { createDecoder } from "./_common.ts";

/**
 * The QOIDecoderStream is a TransformStream that decodes qoi image format into
 * raw image data. The raw data is a sequence of `[ r, g, b, a ]` numbers.
 *
 * @example
 * ```ts ignore
 * import { QOIDecoderStream } from "img/qoi";
 *
 * const rawStream = (await Deno.open("image.qoi"))
 *   .readable
 *   .pipeThrough(new QOIDecoderStream(header => console.log(header)));
 * ```
 *
 * @module
 */
export class QOIDecoderStream
  implements TransformStream<Uint8Array, Uint8Array> {
  #readable: ReadableStream<Uint8Array>;
  #writable: WritableStream<Uint8Array>;
  constructor(cb: (header: QOIOptions) => unknown = () => {}) {
    const { readable, writable } = new TransformStream<
      Uint8Array,
      Uint8Array
    >();
    this.#readable = ReadableStream.from(
      async function* (): AsyncGenerator<Uint8Array> {
        const byteStream = toByteStream(readable);
        const { width, height, isRGB } = await async function (): Promise<
          { width: number; height: number; isRGB: boolean }
        > {
          const reader = byteStream.getReader({ mode: "byob" });
          const { done, value } = await reader
            .read(new Uint8Array(14), { min: 14 });
          try {
            if (done || value.length !== 14) {
              throw new RangeError("QOI stream is too short to be valid");
            }
            if (![113, 111, 105, 102].every((x, i) => x === value[i])) {
              throw new TypeError("QOI stream had invalid magic number");
            }
            if (value[12] !== 3 && value[12] !== 4) {
              throw new TypeError("QOI stream had invalid channels");
            }
            if (value[13] !== 0 && value[13] !== 1) {
              throw new TypeError("QOI stream had invalid colorspace");
            }
          } catch (e) {
            reader.cancel(e);
            throw e;
          }
          const view = new DataView(value.buffer);
          cb({
            width: view.getUint32(4),
            height: view.getUint32(8),
            channels: value[12] === 3 ? "rgb" : "rgba",
            colorspace: value[13],
          });
          reader.releaseLock();
          return {
            width: view.getUint32(4),
            height: view.getUint32(8),
            isRGB: value[12] === 3,
          };
        }();

        const buffer = new Uint8Array(8);
        let offset = 0;
        const decoder = createDecoder();
        let count = 0;
        for await (let chunk of byteStream) {
          const originalSize = chunk.length;
          const maxSize = (offset + originalSize) * 63 * (isRGB ? 4 : 5);
          // deno-lint-ignore no-explicit-any
          chunk = new Uint8Array((chunk.buffer as any).transfer(maxSize));
          chunk.set(chunk.subarray(0, originalSize), maxSize - originalSize);
          if (offset) {
            chunk.set(
              buffer.subarray(0, offset),
              maxSize - originalSize - offset,
            );
          }

          const { i, o, c, isEnd } = decoder(
            chunk,
            maxSize - originalSize - offset,
            0,
          );
          count += c;
          offset = chunk.length - i;
          if (offset) buffer.set(chunk.subarray(i));
          // deno-lint-ignore no-explicit-any
          yield new Uint8Array((chunk.buffer as any).transfer(o));
          if (isEnd) {
            if (count !== width * height) {
              throw new RangeError(
                `QOI stream received exit code, but pixels (${count}) decoded does not match width * height (${
                  width * height
                }) in header`,
              );
            }
            return;
          }
        }
        throw new RangeError("Expected more bytes from stream");
      }(),
    );
    this.#writable = writable;
  }

  get readable(): ReadableStream<Uint8Array> {
    return this.#readable;
  }

  get writable(): WritableStream<Uint8Array> {
    return this.#writable;
  }
}
