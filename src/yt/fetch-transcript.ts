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

interface ParsedVtt {
  readonly text: string;
  readonly segments: ReadonlyArray<TranscriptSegment>;
}

const TIMESTAMP_RE = /^(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/;

const VTT_SKIP_PREFIXES = ["Kind:", "Language:"];

function parseTimestamp(h: string, m: string, s: string, ms: string): number {
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;
}

function cleanCaptionLine(line: string): string {
  return line
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function isVttMeta(line: string): boolean {
  return line === "" || line === "WEBVTT" || VTT_SKIP_PREFIXES.some((p) => line.startsWith(p));
}

function parseVtt(raw: string): ParsedVtt {
  const lines = raw.split("\n");
  const segments: TranscriptSegment[] = [];
  const textLines: string[] = [];

  let startSec = -1;
  let endSec = -1;
  let captionLines: string[] = [];
  let prevText = "";

  function flushSegment(): void {
    if (startSec < 0 || captionLines.length === 0) return;
    const text = captionLines.join(" ");
    if (text !== prevText) {
      segments.push({ startSec, endSec, text });
      textLines.push(text);
      prevText = text;
    }
    captionLines = [];
    startSec = -1;
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (isVttMeta(trimmed)) {
      flushSegment();
      continue;
    }

    const tsMatch = trimmed.match(TIMESTAMP_RE);
    if (tsMatch) {
      flushSegment();
      startSec = parseTimestamp(tsMatch[1]!, tsMatch[2]!, tsMatch[3]!, tsMatch[4]!);
      endSec = parseTimestamp(tsMatch[5]!, tsMatch[6]!, tsMatch[7]!, tsMatch[8]!);
      continue;
    }

    const cleaned = cleanCaptionLine(trimmed);
    if (cleaned !== "") {
      captionLines.push(cleaned);
    }
  }

  flushSegment();

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
