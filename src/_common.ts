export function toByteStream(
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
