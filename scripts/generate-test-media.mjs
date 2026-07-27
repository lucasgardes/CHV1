import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const outputDirectory = path.resolve("assets/test");
const videoPath = path.join(outputDirectory, "test-video.mp4");
const funscriptPath = path.join(outputDirectory, "test-video.funscript");

await mkdir(outputDirectory, { recursive: true });

const ffmpeg = spawnSync(
  "ffmpeg",
  [
    "-hide_banner",
    "-loglevel", "error",
    "-y",
    "-f", "lavfi",
    "-i", "color=c=black:s=640x360:r=30:d=4",
    "-f", "lavfi",
    "-i", "sine=frequency=440:sample_rate=44100:duration=4",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-shortest",
    "-movflags", "+faststart",
    videoPath
  ],
  { encoding: "utf8" }
);

if (ffmpeg.error?.code === "ENOENT") {
  throw new Error("FFmpeg est requis pour générer la vidéo de test. Installe FFmpeg puis relance npm run test:media.");
}

if (ffmpeg.status !== 0) {
  throw new Error(`La génération de la vidéo de test a échoué.\n${ffmpeg.stderr || ffmpeg.stdout}`);
}

const funscript = {
  version: "1.0",
  inverted: false,
  range: 90,
  actions: [
    { at: 0, pos: 10 },
    { at: 500, pos: 90 },
    { at: 1000, pos: 20 },
    { at: 1500, pos: 80 },
    { at: 2000, pos: 30 },
    { at: 2500, pos: 70 },
    { at: 3000, pos: 40 },
    { at: 3500, pos: 60 },
    { at: 3950, pos: 50 }
  ]
};

await writeFile(funscriptPath, `${JSON.stringify(funscript, null, 2)}\n`, "utf8");

console.log(`Média de test généré : ${path.relative(process.cwd(), videoPath)}`);
console.log(`Funscript de test généré : ${path.relative(process.cwd(), funscriptPath)}`);
