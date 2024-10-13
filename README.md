# qoi

This is a TypeScript implementation of the `.qoi` image format. The module
provides two TransformStream classes to encode and decode
`ReadableStream<Uint8Array>` in the desired format. The raw pixel format pipped
into the encoder is expected to be a repeating sequence of `[ r, g, b, a ]`.
This is also the format that is pipped out of the decoder. This implementation
is based off the
[QOI Specification](https://qoiformat.org/qoi-specification.pdf). You can find
about more about QOI at their website: https://qoiformat.org/.

## Example

```ts
import { QOIEncoderStream } from "@img/qoi";

await ReadableStream
  .from(async function* () {
    for (let r = 0; r < 256; ++r) {
      for (let c = 0; c < 256; ++c) {
        yield Uint8Array.from([255 - r, c, r, 255]);
      }
    }
  }())
  .pipeThrough(
    new QOIEncoderStream({
      width: 256,
      height: 256,
      channels: "rgb",
      colorspace: 0,
    }),
  )
  .pipeTo((await Deno.create("image.qoi")).writable);
```
