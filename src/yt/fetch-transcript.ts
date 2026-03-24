import { tmpdir } from "node:os";
import { join } from "node:path";
import { ExternalServiceError, NotFoundError } from "../lib/errors";

export interface RawTranscript {
  readonly videoId: string;
  readonly language: string;
  readonly text: string;
}

function parseVtt(raw: string): string {
  const lines = raw.split("\n");
  const textLines: string[] = [];
  let prevLine = "";

  for (const line of lines) {
    const trimmed = line.trim();

    if (
      trimmed === "" ||
      trimmed === "WEBVTT" ||
      trimmed.startsWith("Kind:") ||
      trimmed.startsWith("Language:") ||
      trimmed.includes("-->")
    ) {
      continue;
    }

    const cleaned = trimmed
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .trim();

    if (cleaned === "" || cleaned === prevLine) continue;

    textLines.push(cleaned);
    prevLine = cleaned;
  }

  return textLines.join(" ");
}

export async function fetchTranscript(
  youtubeVideoId: string,
  language = "en",
): Promise<RawTranscript> {
  const dir = join(tmpdir(), `yt-sub-${youtubeVideoId}-${Date.now()}`);
  const outputTemplate = join(dir, "%(id)s");
  const videoUrl = `https://www.youtube.com/watch?v=${youtubeVideoId}`;

  const proc = Bun.spawn(
    [
      "yt-dlp",
      "--write-auto-sub",
      "--write-sub",
      "--sub-lang", language,
      "--sub-format", "vtt",
      "--skip-download",
      "-o", outputTemplate,
      videoUrl,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );

  const [stderr, exitCode] = await Promise.all([
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    throw new ExternalServiceError("yt-dlp", stderr.trim());
  }

  const vttPath = join(dir, `${youtubeVideoId}.${language}.vtt`);

  try {
    const vttContent = await Bun.file(vttPath).text();

    const text = parseVtt(vttContent);
    if (text.length === 0) {
      throw new NotFoundError(
        `Subtitles empty for video ${youtubeVideoId} (lang: ${language})`,
      );
    }

    return { videoId: youtubeVideoId, language, text };
  } catch (err) {
    if (err instanceof NotFoundError) throw err;
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new NotFoundError(
        `No subtitles found for video ${youtubeVideoId} (lang: ${language})`,
      );
    }
    throw err;
  } finally {
    await Bun.$`rm -rf ${dir}`.quiet();
  }
}
