import { assertEquals } from "@std/assert";
import { QOIDecoderStream } from "./decoder_stream.ts";
import { QOIEncoderStream } from "./encoder_stream.ts";
import { toBytes } from "@std/streams/unstable-to-bytes";
import { assertRejects } from "@std/assert/rejects";

Deno.test("QOIDecoderStream() correctly decoding header", async () => {
  const decoderStream = new QOIDecoderStream();

  const readable = ReadableStream
    .from([new Uint8Array([0, 0, 0, 255])])
    .pipeThrough(
      new QOIEncoderStream({
        width: 1,
        height: 1,
        channels: "rgb",
        colorspace: 0,
      }),
    )
    .pipeThrough(decoderStream);

  assertEquals(await decoderStream.options, {
    width: 1,
    height: 1,
    channels: "rgb",
    colorspace: 0,
  });
  await readable.cancel();
});

Deno.test("QOIDecoderStream() correctly decoding QOI_OP_RGBA", async () => {
  assertEquals(
    await toBytes(
      ReadableStream
        .from([new Uint8Array([128, 128, 128, 128])])
        .pipeThrough(
          new QOIEncoderStream({
            width: 1,
            height: 1,
            channels: "rgba",
            colorspace: 0,
          }),
        )
        .pipeThrough(new QOIDecoderStream()),
    ),
    new Uint8Array([128, 128, 128, 128]),
  );
});

Deno.test("QOIDecoderStream() correctly decoding QOI_OP_RGB", async () => {
  assertEquals(
    await toBytes(
      ReadableStream
        .from([new Uint8Array([128, 128, 128, 128])])
        .pipeThrough(
          new QOIEncoderStream({
            width: 1,
            height: 1,
            channels: "rgb",
            colorspace: 0,
          }),
        )
        .pipeThrough(new QOIDecoderStream()),
    ),
    new Uint8Array([128, 128, 128, 255]),
  );
});

Deno.test("QOIDecoderStream() correctly decoding QOI_OP_INDEX", async () => {
  assertEquals(
    await toBytes(
      ReadableStream
        .from([
          new Uint8Array([
            128,
            128,
            128,
            255,
            64,
            1,
            64,
            255,
            128,
            128,
            128,
            255,
          ]),
        ])
        .pipeThrough(
          new QOIEncoderStream({
            width: 3,
            height: 1,
            channels: "rgb",
            colorspace: 0,
          }),
        )
        .pipeThrough(new QOIDecoderStream()),
    ),
    new Uint8Array([128, 128, 128, 255, 64, 1, 64, 255, 128, 128, 128, 255]),
  );
});

Deno.test("QOIDecoderStream() correctly decoding QOI_OP_DIFF", async () => {
  assertEquals(
    await toBytes(
      ReadableStream
        .from([new Uint8Array([1, 1, 1, 255])])
        .pipeThrough(
          new QOIEncoderStream({
            width: 1,
            height: 1,
            channels: "rgb",
            colorspace: 0,
          }),
        )
        .pipeThrough(new QOIDecoderStream()),
    ),
    new Uint8Array([1, 1, 1, 255]),
  );
});

Deno.test("QOIDecoderStream() correctly decoding QOI_OP_LUMA", async () => {
  assertEquals(
    await toBytes(
      ReadableStream
        .from([new Uint8Array([128, 128, 128, 255, 128, 135, 128, 255])])
        .pipeThrough(
          new QOIEncoderStream({
            width: 2,
            height: 1,
            channels: "rgb",
            colorspace: 0,
          }),
        )
        .pipeThrough(new QOIDecoderStream()),
    ),
    new Uint8Array([128, 128, 128, 255, 128, 135, 128, 255]),
  );
});

Deno.test("QOIDecoderStream() correctly decoding QOI_OP_RUN", async () => {
  assertEquals(
    await toBytes(
      ReadableStream
        .from([
          new Uint8Array([
            0,
            0,
            0,
            255,
            0,
            0,
            0,
            255,
            0,
            0,
            0,
            255,
            0,
            0,
            0,
            255,
          ]),
        ])
        .pipeThrough(
          new QOIEncoderStream({
            width: 2,
            height: 2,
            channels: "rgb",
            colorspace: 0,
          }),
        )
        .pipeThrough(new QOIDecoderStream()),
    ),
    new Uint8Array([0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255]),
  );
});

Deno.test("QOIDecoderStream() rejecting invalid premature exit", async () => {
  const header = (await toBytes(
    ReadableStream
      .from([new Uint8Array([128, 128, 128, 255])])
      .pipeThrough(
        new QOIEncoderStream({
          width: 1,
          height: 1,
          channels: "rgb",
          colorspace: 0,
        }),
      ),
  )).slice(0, 14);

  await assertRejects(
    async () => {
      const decoderStream = new QOIDecoderStream();
      for await (
        const _ of ReadableStream
          .from([header, new Uint8Array([0, 0, 0, 0, 0, 0, 0, 1])])
          .pipeThrough(decoderStream)
        // deno-lint-ignore no-empty
      ) {}
    },
    RangeError,
    "QOI stream received exit code, but pixels (0) decoded does not match width * height (1) in header",
  );
});
