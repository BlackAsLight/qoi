/**
 * The options that specify the metadata of the encoding image.
 */
export interface QOIOptions {
  width: number;
  height: number;
  channels: "rgb" | "rgba";
  colorspace: 0 | 1;
}
