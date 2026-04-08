import { tmpdir } from "node:os";
import { join } from "node:path";
import { ExternalServiceError, NotFoundError } from "../lib/errors";

export interface TranscriptSegment {
  readonly startSec: number;
  readonly endSec: number;
  readonly text: string;
}

export interface RawTranscript {
  readonly videoId: string;
  readonly language: string;
  readonly text: string;
  readonly segments: ReadonlyArray<TranscriptSegment>;
}

const TIMESTAMP_RE = /^(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/;

function parseTimestamp(h: string, m: string, s: string, ms: string): number {
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;
}

function cleanLine(line: string): string {
  return line
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

interface ParsedVtt {
  readonly text: string;
  readonly segments: ReadonlyArray<TranscriptSegment>;
}

function parseVtt(raw: string): ParsedVtt {
  const lines = raw.split("\n");
  const segments: TranscriptSegment[] = [];
  const textLines: string[] = [];

  let currentStart = -1;
  let currentEnd = -1;
  let currentLines: string[] = [];
  let prevText = "";

  for (const line of lines) {
    const trimmed = line.trim();

    if (
      trimmed === "" ||
      trimmed === "WEBVTT" ||
      trimmed.startsWith("Kind:") ||
      trimmed.startsWith("Language:")
    ) {
      // Flush current segment on blank line
      if (currentStart >= 0 && currentLines.length > 0) {
        const text = currentLines.join(" ");
        if (text !== prevText) {
          segments.push({ startSec: currentStart, endSec: currentEnd, text });
          textLines.push(text);
          prevText = text;
        }
        currentLines = [];
        currentStart = -1;
      }
      continue;
    }

    const tsMatch = trimmed.match(TIMESTAMP_RE);
    if (tsMatch) {
      // Flush previous segment if any text accumulated
      if (currentStart >= 0 && currentLines.length > 0) {
        const text = currentLines.join(" ");
        if (text !== prevText) {
          segments.push({ startSec: currentStart, endSec: currentEnd, text });
          textLines.push(text);
          prevText = text;
        }
        currentLines = [];
      }
      currentStart = parseTimestamp(tsMatch[1]!, tsMatch[2]!, tsMatch[3]!, tsMatch[4]!);
      currentEnd = parseTimestamp(tsMatch[5]!, tsMatch[6]!, tsMatch[7]!, tsMatch[8]!);
      continue;
    }

    const cleaned = cleanLine(trimmed);
    if (cleaned !== "") {
      currentLines.push(cleaned);
    }
  }

  // Flush last segment
  if (currentStart >= 0 && currentLines.length > 0) {
    const text = currentLines.join(" ");
    if (text !== prevText) {
      segments.push({ startSec: currentStart, endSec: currentEnd, text });
      textLines.push(text);
    }
  }

  return { text: textLines.join(" "), segments };
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

    const { text, segments } = parseVtt(vttContent);
    if (text.length === 0) {
      throw new NotFoundError(
        `Subtitles empty for video ${youtubeVideoId} (lang: ${language})`,
      );
    }

    return { videoId: youtubeVideoId, language, text, segments };
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
