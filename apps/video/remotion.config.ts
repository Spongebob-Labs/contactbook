import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// The hero loop is a flat-colour vector scene with large gradient fields; chroma
// subsampling on those is what produces the muddy banding you see in most web hero
// loops, so the encoder keeps full colour resolution.
Config.setPixelFormat("yuv420p");
export {};
