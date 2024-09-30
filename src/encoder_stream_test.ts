import { assertEquals } from "@std/assert";
import { toBytes } from "@std/streams/unstable-to-bytes";
import { QOIEncoderStream } from "./encoder_stream.ts";
import { assertRejects } from "@std/assert/rejects";

Deno.test("QOIEncodeStream() correct encoding for rgb with black pixel", async () => {
  assertEquals(
    await toBytes(
      ReadableStream.from([new Uint8Array([0, 0, 0, 255])]).pipeThrough(
        new QOIEncoderStream({
          width: 1,
          height: 1,
          channels: "rgb",
          colorspace: 0,
        }),
      ),
    ),
    new Uint8Array([
      // Header
      [[113, 111, 105, 102], [0, 0, 0, 1], [0, 0, 0, 1], 3, 0],
      // Body
      (0b11 << 6) + 0,
      // Footer
      [0, 0, 0, 0, 0, 0, 0, 1],
    ].flat(2)),
  );
});

Deno.test("QOIEncodeStream() correct encoding for rgb with white pixel", async () => {
  assertEquals(
    await toBytes(
      ReadableStream.from([new Uint8Array([255, 255, 255, 255])]).pipeThrough(
        new QOIEncoderStream({
          width: 1,
          height: 1,
          channels: "rgb",
          colorspace: 0,
        }),
      ),
    ),
    new Uint8Array([
      // Header
      [[113, 111, 105, 102], [0, 0, 0, 1], [0, 0, 0, 1], 3, 0],
      // Body
      [0b11111110, 255, 255, 255],
      // Footer
      [0, 0, 0, 0, 0, 0, 0, 1],
    ].flat(2)),
  );
});

Deno.test("QOIEncoderStream() correct encoding for rgba with black pixel", async () => {
  assertEquals(
    await toBytes(
      ReadableStream.from([new Uint8Array([0, 0, 0, 255])]).pipeThrough(
        new QOIEncoderStream({
          width: 1,
          height: 1,
          channels: "rgba",
          colorspace: 0,
        }),
      ),
    ),
    new Uint8Array(
      [
        // Header
        [[113, 111, 105, 102], [0, 0, 0, 1], [0, 0, 0, 1], 4, 0],
        // Body
        (0b11 << 6) + 0,
        // Footer
        [0, 0, 0, 0, 0, 0, 0, 1],
      ].flat(2),
    ),
  );
});

Deno.test("QOIEncoderStream() correct encoding for rgba with white pixel", async () => {
  assertEquals(
    await toBytes(
      ReadableStream.from([new Uint8Array([255, 255, 255, 255])]).pipeThrough(
        new QOIEncoderStream({
          width: 1,
          height: 1,
          channels: "rgba",
          colorspace: 0,
        }),
      ),
    ),
    new Uint8Array(
      [
        // Header
        [[113, 111, 105, 102], [0, 0, 0, 1], [0, 0, 0, 1], 4, 0],
        // Body
        [0b11111111, 255, 255, 255, 255],
        // Footer
        [0, 0, 0, 0, 0, 0, 0, 1],
      ].flat(2),
    ),
  );
});

Deno.test("QOIEncoderStream() rejecting invalid width", async () => {
  await assertRejects(
    async () => {
      await toBytes(
        ReadableStream.from([new Uint8Array([0, 0, 0, 255])]).pipeThrough(
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
        ReadableStream.from([new Uint8Array([0, 0, 0, 255])]).pipeThrough(
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
        ReadableStream.from([new Uint8Array([0, 0, 0, 0, 0])]).pipeThrough(
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
    "Unexpected number of bytes from readable stream",
  );
});

Deno.test("QOIEncoderStream() rejecting due to width * height not equalling pixels encoded", async () => {
  await assertRejects(
    async () => {
      await toBytes(
        ReadableStream.from([new Uint8Array([0, 0, 0, 255])]).pipeThrough(
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
