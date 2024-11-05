import { assertEquals, assertThrows } from "@std/assert";
import { concat } from "@std/bytes";
import { encodeQOI } from "./encode.ts";
import { decodeQOI } from "./decode.ts";

Deno.test("decodeQOI() correctly decoding header", () => {
  assertEquals(
    decodeQOI(encodeQOI(new Uint8Array([128, 128, 128, 255]), {
      width: 1,
      height: 1,
      channels: "rgb",
      colorspace: 0,
    })).header,
    { width: 1, height: 1, channels: "rgb", colorspace: 0 },
  );
});

Deno.test("decodeQOI() correctly decoding QOI_OP_RGBA", () => {
  assertEquals(
    decodeQOI(
      encodeQOI(new Uint8Array([128, 128, 128, 128]), {
        width: 1,
        height: 1,
        channels: "rgba",
        colorspace: 0,
      }),
    ).body,
    new Uint8Array([128, 128, 128, 128]),
  );
});

Deno.test("decodeQOI() correctly decoding QOI_RGB", () => {
  assertEquals(
    decodeQOI(
      encodeQOI(new Uint8Array([128, 128, 128, 128]), {
        width: 1,
        height: 1,
        channels: "rgb",
        colorspace: 0,
      }),
    ).body,
    new Uint8Array([128, 128, 128, 255]),
  );
});

Deno.test("decodeQOI() correctly decoding QOI_OP_INDEX", () => {
  assertEquals(
    decodeQOI(
      encodeQOI(
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
        { width: 3, height: 1, channels: "rgb", colorspace: 0 },
      ),
    ).body,
    new Uint8Array([128, 128, 128, 255, 64, 1, 64, 255, 128, 128, 128, 255]),
  );
});

Deno.test("decodeQOI() correctly decoding QOI_OP_DIFF", () => {
  assertEquals(
    decodeQOI(
      encodeQOI(new Uint8Array([1, 1, 1, 255]), {
        width: 1,
        height: 1,
        channels: "rgb",
        colorspace: 0,
      }),
    ).body,
    new Uint8Array([1, 1, 1, 255]),
  );
});

Deno.test("decodeQOI() correctly decoding QOI_OP_LUMA", () => {
  assertEquals(
    decodeQOI(
      encodeQOI(new Uint8Array([128, 128, 128, 255, 128, 135, 128, 255]), {
        width: 2,
        height: 1,
        channels: "rgb",
        colorspace: 0,
      }),
    ).body,
    new Uint8Array([128, 128, 128, 255, 128, 135, 128, 255]),
  );
});

Deno.test("decodeQOI() correctly decoding QOI_OP_RUN", () => {
  assertEquals(
    decodeQOI(
      encodeQOI(
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
        { width: 2, height: 2, channels: "rgb", colorspace: 0 },
      ),
    ).body,
    new Uint8Array([0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255]),
  );
});

Deno.test("decodeQOI() rejecting due to shortness", () => {
  assertThrows(
    () => decodeQOI(new Uint8Array(13)),
    RangeError,
    "QOI input is too short to be valid",
  );
});

Deno.test("decodeQOI() rejecting due to magic number", () => {
  assertThrows(
    () => decodeQOI(new Uint8Array(100)),
    TypeError,
    "QOI input had invalid magic number",
  );
});

Deno.test("decodeQOI() rejecting due to channels", () => {
  assertThrows(
    () =>
      decodeQOI(
        new Uint8Array([
          113,
          111,
          105,
          102,
          0,
          0,
          0,
          1,
          0,
          0,
          0,
          1,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
        ]),
      ),
    TypeError,
    "QOI input had invalid channels",
  );
});

Deno.test("decodeQOI() rejecting due to colorspace", () => {
  assertThrows(
    () =>
      decodeQOI(
        new Uint8Array([
          113,
          111,
          105,
          102,
          0,
          0,
          0,
          1,
          0,
          0,
          0,
          1,
          3,
          2,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
        ]),
      ),
    TypeError,
    "QOI input had invalid colorspace",
  );
});

Deno.test("decodeQOI() rejecting due to receiving exit code", () => {
  const encoded = encodeQOI(new Uint8Array([128, 128, 128, 255]), {
    width: 1,
    height: 1,
    channels: "rgb",
    colorspace: 0,
  });

  assertThrows(
    () => decodeQOI(concat([encoded.slice(0, 14), encoded.slice(-8)])),
    RangeError,
    "QOI input received exit code, but pixels (0) decoded does not match width * height (1) in header",
  );
});

Deno.test("decodeQOI() rejecting due to expecting more bytes", () => {
  const encoded = encodeQOI(new Uint8Array([128, 128, 128, 255]), {
    width: 1,
    height: 1,
    channels: "rgb",
    colorspace: 0,
  });
  encoded[encoded.length - 1] = 0;

  assertThrows(
    () => decodeQOI(encoded),
    RangeError,
    "Expected more bytes from input",
  );
});
