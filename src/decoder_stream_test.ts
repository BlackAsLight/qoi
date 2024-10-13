import { assertEquals } from "@std/assert";
import { QOIDecoderStream } from "./decoder_stream.ts";
import { QOIEncoderStream } from "./encoder_stream.ts";
import { toBytes } from "@std/streams/unstable-to-bytes";
import { assertRejects } from "@std/assert/rejects";

Deno.test("QOIDecoderStream() correctly decoding header", async () => {
  const decoderStream = new QOIDecoderStream();

  const readable = ReadableStream
    .from([new Uint8Array([128, 128, 128, 255])])
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

Deno.test("QOIDecoderStream() getting options after decoding body", async () => {
  const decoderStream = new QOIDecoderStream();

  const readable = ReadableStream
    .from([new Uint8Array([128, 128, 128, 255])])
    .pipeThrough(
      new QOIEncoderStream({
        width: 1,
        height: 1,
        channels: "rgb",
        colorspace: 0,
      }),
    )
    .pipeThrough(decoderStream);

  // deno-lint-ignore no-empty
  for await (const _ of readable) {}
  assertEquals(await decoderStream.options, {
    width: 1,
    height: 1,
    channels: "rgb",
    colorspace: 0,
  });
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

Deno.test("QOIDecoderStream() rejecting header due to shortness", async () => {
  const decoderStream = new QOIDecoderStream();

  await assertRejects(
    async () => {
      for await (
        const _ of ReadableStream
          .from([new Uint8Array(13)])
          .pipeThrough(decoderStream)
        // deno-lint-ignore no-empty
      ) {}
    },
    RangeError,
    "QOI stream was too short to be valid",
  );

  await assertRejects(
    async () => {
      await decoderStream.options;
    },
    RangeError,
    "QOI stream was too short to be valid",
  );
});

Deno.test("QOIDecoderStream() rejecting header due to magic number", async () => {
  const decoderStream = new QOIDecoderStream();

  const options = decoderStream.options;
  await assertRejects(
    async () => {
      for await (
        const _ of ReadableStream
          .from([new Uint8Array(14)])
          .pipeThrough(decoderStream)
        // deno-lint-ignore no-empty
      ) {}
    },
    TypeError,
    "QOI stream had invalid magic number",
  );

  await assertRejects(
    async () => {
      await options;
    },
    TypeError,
    "QOI stream had invalid magic number",
  );
});

Deno.test("QOIDecoderStream() rejecting header due to channels", async () => {
  await assertRejects(
    async () => {
      for await (
        const _ of ReadableStream
          .from([
            new Uint8Array([113, 111, 105, 102, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0]),
          ])
          .pipeThrough(new QOIDecoderStream())
        // deno-lint-ignore no-empty
      ) {}
    },
    TypeError,
    "QOI stream had invalid channels",
  );
});

Deno.test("QOIDecoderStream() rejecting header due to colorspace", async () => {
  await assertRejects(
    async () => {
      for await (
        const _ of ReadableStream
          .from([
            new Uint8Array([113, 111, 105, 102, 0, 0, 0, 1, 0, 0, 0, 1, 3, 2]),
          ])
          .pipeThrough(new QOIDecoderStream())
        // deno-lint-ignore no-empty
      ) {}
    },
    TypeError,
    "QOI stream had invalid colorspace",
  );
});

Deno.test("QOIDecoderStream() rejecting invalid premature exit", async () => {
  const bytes = await toBytes(
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
  );

  await assertRejects(
    async () => {
      for await (
        const _ of ReadableStream
          .from([bytes.slice(0, 14), bytes.slice(-8)])
          .pipeThrough(new QOIDecoderStream())
        // deno-lint-ignore no-empty
      ) {}
    },
    RangeError,
    "QOI stream received exit code, but pixels (0) decoded does not match width * height (1) in header",
  );
});

Deno.test("QOIDecoderStream() rejecting invalid buffer loading", async () => {
  const bytes = (await toBytes(
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
  )).slice(0, 15);

  await assertRejects(
    async () => {
      for await (
        const _ of ReadableStream
          .from([bytes])
          .pipeThrough(new QOIDecoderStream())
        // deno-lint-ignore no-empty
      ) {}
    },
    RangeError,
    "QOI stream was too short to be valid",
  );
});

Deno.test("QOIDecodedStream() rejecting invalid length", async () => {
  const bytes = await toBytes(
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
  );
  bytes[bytes.length - 1] = 0;

  await assertRejects(
    async () => {
      for await (
        const _ of ReadableStream
          .from([bytes])
          .pipeThrough(new QOIDecoderStream())
        // deno-lint-ignore no-empty
      ) {}
    },
    RangeError,
    "Unexpected number of bytes from readable stream",
  );
});
