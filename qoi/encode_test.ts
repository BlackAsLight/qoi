import { assertEquals } from "@std/assert";
import { encodeQOI } from "./encode.ts";
import { assertThrows } from "@std/assert/throws";

Deno.test("encodeQOI() correctly encoding header", () => {
  assertEquals(
    encodeQOI(new Uint8Array([0, 0, 0, 255, 0, 0, 0, 255]), {
      width: 2,
      height: 1,
      channels: "rgb",
      colorspace: 0,
    }).slice(0, 14),
    new Uint8Array([113, 111, 105, 102, 0, 0, 0, 2, 0, 0, 0, 1, 3, 0]),
  );
  assertEquals(
    encodeQOI(new Uint8Array([0, 0, 0, 255, 0, 0, 0, 255]), {
      width: 2,
      height: 1,
      channels: "rgba",
      colorspace: 1,
    }).slice(0, 14),
    new Uint8Array([113, 111, 105, 102, 0, 0, 0, 2, 0, 0, 0, 1, 4, 1]),
  );
});

Deno.test("encodeQOI() corrctly encoding footer", () => {
  assertEquals(
    encodeQOI(new Uint8Array([0, 0, 0, 255, 0, 0, 0, 255]), {
      width: 2,
      height: 1,
      channels: "rgb",
      colorspace: 0,
    }).slice(-8),
    new Uint8Array([0, 0, 0, 0, 0, 0, 0, 1]),
  );
});

Deno.test("encodeQOI() correct encoding for rgb with black pixel", () => {
  assertEquals(
    encodeQOI(new Uint8Array([0, 0, 0, 255]), {
      width: 1,
      height: 1,
      channels: "rgb",
      colorspace: 0,
    }).slice(14, -8),
    new Uint8Array([(0b11 << 6) + 0]),
  );
});

Deno.test("encodeQOI() correct encoding for rgb with white pixel", () => {
  assertEquals(
    encodeQOI(new Uint8Array([255, 255, 255, 255]), {
      width: 1,
      height: 1,
      channels: "rgb",
      colorspace: 0,
    }).slice(14, -8),
    new Uint8Array([0b11111110, 255, 255, 255]),
  );
});

Deno.test("encodeQOI() correct encoding for rgba with black pixel", () => {
  assertEquals(
    encodeQOI(new Uint8Array([0, 0, 0, 255]), {
      width: 1,
      height: 1,
      channels: "rgba",
      colorspace: 0,
    }).slice(14, -8),
    new Uint8Array([(0b11 << 6) + 0]),
  );
});

Deno.test("encodeQOI() correct encoding for rgba with white pixel", () => {
  assertEquals(
    encodeQOI(new Uint8Array([255, 255, 255, 255]), {
      width: 1,
      height: 1,
      channels: "rgba",
      colorspace: 0,
    }).slice(14, -8),
    new Uint8Array([0b11111111, 255, 255, 255, 255]),
  );
});

Deno.test("encodeQOI() rejecting invalid width", () => {
  assertThrows(
    () =>
      encodeQOI(new Uint8Array([0, 0, 0, 255]), {
        width: -1,
        height: 1,
        channels: "rgb",
        colorspace: 0,
      }),
    RangeError,
    "Width cannot be a negative number or NaN",
  );
});

Deno.test("encodeQOI() rejecting invalid height", () => {
  assertThrows(
    () =>
      encodeQOI(new Uint8Array([0, 0, 0, 255]), {
        width: 1,
        height: -1,
        channels: "rgb",
        colorspace: 0,
      }),
    RangeError,
    "Height cannot be a negative number or NaN",
  );
});

Deno.test("encodeQOI() rejecting due to unexpected number of bytes", () => {
  assertThrows(
    () =>
      encodeQOI(new Uint8Array([0, 0, 0, 255, 0]), {
        width: 1,
        height: 1,
        channels: "rgb",
        colorspace: 0,
      }),
    RangeError,
    "Unexpected number of bytes from input",
  );
});

Deno.test("encodeQOI() rejecting due to width * height not equalling pixels encoded", () => {
  assertThrows(
    () =>
      encodeQOI(new Uint8Array([0, 0, 0, 255]), {
        width: 2,
        height: 2,
        channels: "rgb",
        colorspace: 0,
      }),
    RangeError,
    "Width * height (4) does not equal pixels encoded (1)",
  );
});

Deno.test("encodeQOI() correctly encoding QOI_OP_RUN", () => {
  assertEquals(
    encodeQOI(
      new Uint8Array([0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255]),
      { width: 2, height: 2, channels: "rgb", colorspace: 0 },
    ).slice(14, -8),
    new Uint8Array([(0b11 << 6) + 4 - 1]),
  );
  assertEquals(
    encodeQOI(
      new Uint8Array(100 * 1 * 4).map((_, i) => i % 4 === 3 ? 255 : 0),
      { width: 100, height: 1, channels: "rgb", colorspace: 0 },
    ).slice(14, -8),
    new Uint8Array([(0b11 << 6) + 62 - 1, (0b11 << 6) + 38 - 1]),
  );
  assertEquals(
    encodeQOI(
      new Uint8Array([0, 0, 0, 255, 128, 128, 128, 255]),
      { width: 2, height: 1, channels: "rgb", colorspace: 0 },
    ).slice(14, -8),
    new Uint8Array([(0b11 << 6) + 1 - 1, 0b11111110, 128, 128, 128]),
  );
});

Deno.test("encodeQOI() correctly encoding QOI_OP_LUMA", () => {
  const [a, b, c, d, e, f, g, h] = [128, 128, 128, 255, 128, 135, 128, 255];
  assertEquals(
    encodeQOI(new Uint8Array([a, b, c, d, e, f, g, h]), {
      width: 2,
      height: 1,
      channels: "rgb",
      colorspace: 0,
    }).slice(14, -8),
    new Uint8Array([
      0b11111110,
      a,
      b,
      c,
      (0b10 << 6) + f - b + 32,
      (e - a - f + b + 8 << 4) + g - c - f + b + 8,
    ]),
  );
});

Deno.test("encodeQOI() correctly encoding QOI_OP_DIFF", () => {
  const [a, b, c, d] = [1, 1, 1, 255];
  assertEquals(
    encodeQOI(new Uint8Array([a, b, c, d]), {
      width: 1,
      height: 1,
      channels: "rgb",
      colorspace: 0,
    }).slice(14, -8),
    new Uint8Array([
      (0b01 << 6) + (a - 0 + 2 << 4) + (b - 0 + 2 << 2) + c - 0 + 2,
    ]),
  );
});

Deno.test("encodeQOI() correctly encoding QOI_OP_INDEX", () => {
  const [a, b, c, d] = [128, 128, 128, 255];
  assertEquals(
    encodeQOI(
      new Uint8Array([a, b, c, d, 64, 1, 64, 255, a, b, c, d]),
      { width: 3, height: 1, channels: "rgb", colorspace: 0 },
    ).slice(14, -8),
    new Uint8Array([
      0b11111110,
      a,
      b,
      c,
      0b11111110,
      64,
      1,
      64,
      (0b00 << 6) + ((a * 3 + b * 5 + c * 7 + d * 11) % 64),
    ]),
  );
});
