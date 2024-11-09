import { assertEquals, assertRejects } from "@std/assert";
import { toBytes } from "@std/streams/unstable-to-bytes";
import { QOIEncoderStream } from "./encoder_stream.ts";

Deno.test("QOIEncoderStream() correctly encoding header", async () => {
  assertEquals(
    (await toBytes(
      ReadableStream
        .from([new Uint8Array([0, 0]), new Uint8Array([0, 255, 0, 0, 0, 255])])
        .pipeThrough(
          new QOIEncoderStream({
            width: 2,
            height: 1,
            channels: "rgb",
            colorspace: 0,
          }),
        ),
    )).slice(0, 14),
    new Uint8Array([113, 111, 105, 102, 0, 0, 0, 2, 0, 0, 0, 1, 3, 0]),
  );
  assertEquals(
    (await toBytes(
      ReadableStream
        .from([new Uint8Array([0, 0, 0, 255, 0, 0, 0, 255])])
        .pipeThrough(
          new QOIEncoderStream({
            width: 1,
            height: 2,
            channels: "rgba",
            colorspace: 1,
          }),
        ),
    )).slice(0, 14),
    new Uint8Array([113, 111, 105, 102, 0, 0, 0, 1, 0, 0, 0, 2, 4, 1]),
  );
});

Deno.test("QOIEncoderStream() correctly encoding footer", async () => {
  assertEquals(
    (await toBytes(
      ReadableStream
        .from([new Uint8Array([0, 0, 0, 255, 0, 0, 0, 255])])
        .pipeThrough(
          new QOIEncoderStream({
            width: 2,
            height: 1,
            channels: "rgb",
            colorspace: 0,
          }),
        ),
    )).slice(-8),
    new Uint8Array([0, 0, 0, 0, 0, 0, 0, 1]),
  );
});

Deno.test("QOIEncoderStream() correct encoding for rgb with black pixel", async () => {
  assertEquals(
    (await toBytes(
      ReadableStream
        .from([new Uint8Array([0, 0, 0, 255])])
        .pipeThrough(
          new QOIEncoderStream({
            width: 1,
            height: 1,
            channels: "rgb",
            colorspace: 0,
          }),
        ),
    )).slice(14, -8),
    new Uint8Array([(0b11 << 6) + 0]),
  );
});

Deno.test("QOIEncoderStream() correct encoding for rgb with white pixel", async () => {
  assertEquals(
    (await toBytes(
      ReadableStream
        .from([new Uint8Array([255, 255, 255, 255])])
        .pipeThrough(
          new QOIEncoderStream({
            width: 1,
            height: 1,
            channels: "rgb",
            colorspace: 0,
          }),
        ),
    )).slice(14, -8),
    new Uint8Array([0b11111110, 255, 255, 255]),
  );
});

Deno.test("QOIEncoderStream() correct encoding for rgba with black pixel", async () => {
  assertEquals(
    (await toBytes(
      ReadableStream
        .from([new Uint8Array([0, 0, 0, 255])])
        .pipeThrough(
          new QOIEncoderStream({
            width: 1,
            height: 1,
            channels: "rgba",
            colorspace: 0,
          }),
        ),
    )).slice(14, -8),
    new Uint8Array([(0b11 << 6) + 0]),
  );
});

Deno.test("QOIEncoderStream() correct encoding for rgba with white pixel", async () => {
  assertEquals(
    (await toBytes(
      ReadableStream
        .from([new Uint8Array([255, 255, 255, 255])])
        .pipeThrough(
          new QOIEncoderStream({
            width: 1,
            height: 1,
            channels: "rgba",
            colorspace: 0,
          }),
        ),
    )).slice(14, -8),
    new Uint8Array([0b11111111, 255, 255, 255, 255]),
  );
});

Deno.test("QOIEncoderStream() rejecting invalid width", async () => {
  await assertRejects(
    async () => {
      await toBytes(
        ReadableStream
          .from([new Uint8Array([0, 0, 0, 255])])
          .pipeThrough(
            new QOIEncoderStream({
              width: -1,
              height: 1,
              channels: "rgb",
              colorspace: 0,
            }),
          ),
      );
    },
    RangeError,
    "Width cannot be a negative number",
  );
});

Deno.test("QOIEncoderStream() rejecting invalid height", async () => {
  await assertRejects(
    async () => {
      await toBytes(
        ReadableStream
          .from([new Uint8Array([0, 0, 0, 255])])
          .pipeThrough(
            new QOIEncoderStream({
              width: 1,
              height: -1,
              channels: "rgb",
              colorspace: 0,
            }),
          ),
      );
    },
    RangeError,
    "Height cannot be a negative number",
  );
});

Deno.test("QOIEncoderStream() rejecting due to unexpected number of bytes", async () => {
  await assertRejects(
    async () => {
      await toBytes(
        ReadableStream
          .from([new Uint8Array([0, 0, 0, 0, 0])])
          .pipeThrough(
            new QOIEncoderStream({
              width: 1,
              height: 1,
              channels: "rgb",
              colorspace: 0,
            }),
          ),
      );
    },
    RangeError,
    "Unexpected number of bytes from stream",
  );
});

Deno.test("QOIEncoderStream() rejecting due to width * height not equalling pixels encoded", async () => {
  await assertRejects(
    async () => {
      await toBytes(
        ReadableStream
          .from([new Uint8Array([0, 0, 0, 255])])
          .pipeThrough(
            new QOIEncoderStream({
              width: 2,
              height: 2,
              channels: "rgb",
              colorspace: 0,
            }),
          ),
      );
    },
    RangeError,
    "Width * height (4) does not equal pixels encoded (1)",
  );
});

Deno.test("QOIEncoderStream() correctly encoding QOI_OP_RUN", async () => {
  assertEquals(
    (await toBytes(
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
        ),
    )).slice(14, -8),
    new Uint8Array([0b11_000000 + 4 - 1]),
  );
  assertEquals(
    (await toBytes(
      ReadableStream
        .from([
          new Uint8Array(100 * 1 * 4).map((_, i) => i % 4 === 3 ? 255 : 0),
        ])
        .pipeThrough(
          new QOIEncoderStream({
            width: 100,
            height: 1,
            channels: "rgb",
            colorspace: 0,
          }),
        ),
    )).slice(14, -8),
    new Uint8Array([0b11_000000 + 62 - 1, 0b11_000000 + 38 - 1]),
  );
  assertEquals(
    (await toBytes(
      ReadableStream
        .from([new Uint8Array([0, 0, 0, 255, 128, 128, 128, 255])])
        .pipeThrough(
          new QOIEncoderStream({
            width: 2,
            height: 1,
            channels: "rgb",
            colorspace: 0,
          }),
        ),
    )).slice(14, -8),
    new Uint8Array([
      0b11_000000 + 1 - 1,
      0b11111110,
      128,
      128,
      128,
    ]),
  );
});

Deno.test("QOIEncoderStream() correctly encoding QOI_OP_LUMA", async () => {
  assertEquals(
    (await toBytes(
      ReadableStream
        .from([new Uint8Array([128, 128, 128, 255, 128, 135, 128, 255])])
        .pipeThrough(
          new QOIEncoderStream({
            width: 2,
            height: 1,
            channels: "rgb",
            colorspace: 0,
          }),
        ),
    )).slice(14, -8),
    new Uint8Array([
      0b11111110,
      128,
      128,
      128,
      0b10_000000 + 135 - 128 + 32,
      (128 - 128 - 135 + 128 + 8 << 4) + 128 - 128 - 135 + 128 + 8,
    ]),
  );
});

Deno.test("QOIEncoderStream() correctly encoding QOI_OP_DIFF", async () => {
  assertEquals(
    (await toBytes(
      ReadableStream
        .from([new Uint8Array([1, 1, 1, 255])])
        .pipeThrough(
          new QOIEncoderStream({
            width: 1,
            height: 1,
            channels: "rgb",
            colorspace: 0,
          }),
        ),
    )).slice(14, -8),
    new Uint8Array([
      0b01_000000 + (1 - 0 + 2 << 4) + (1 - 0 + 2 << 2) + 1 - 0 + 2,
    ]),
  );
});

Deno.test("QOIEncoderStream() correctly encoding QOI_OP_INDEX", async () => {
  assertEquals(
    (await toBytes(
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
        ),
    )).slice(14, -8),
    new Uint8Array([
      0b11111110,
      128,
      128,
      128,
      0b11111110,
      64,
      1,
      64,
      0b00_000000 + ((128 * 3 + 128 * 5 + 128 * 7 + 255 * 11) % 64),
    ]),
  );
});
