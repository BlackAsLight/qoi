# qoi

This is a TypeScript implementation of the QOI image format. The module offers
both sync and streaming versions to encode and decode to and from the QOI image
format. The raw pixel format/ the decoded format is a repeating sequence of
`[ r, g, b, a ]` in a `Uint8Array`, `Uint8ClampedArray`, or a
`ReadableStream<Uint8Array>`.

This implementationis based off the
[QOI Specification](https://qoiformat.org/qoi-specification.pdf). You can find
about more about QOI at their website: https://qoiformat.org/.

## Example

```ts
import { encodeQOI } from "@img/qoi";

const rawData = await new Response(ReadableStream.from(async function* () {
  for (let r = 0; r < 256; ++r) {
    for (let c = 0; c < 256; ++c) {
      yield Uint8Array.from([255 - r, c, r, 255]);
    }
  }
}())).bytes();

await Deno.writeFile(
  "image.qoi",
  encodeQOI(rawData, {
    width: 256,
    height: 256,
    channels: "rgb",
    colorspace: 0,
  }),
);
```
