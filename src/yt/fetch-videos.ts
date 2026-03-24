import { ExternalServiceError, NotFoundError } from "../lib/errors";
import { parseChannelInput } from "./parse-channel";
import type { ChannelVideosResponse, VideoInfo } from "./types";

interface YtDlpEntry {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly webpage_url: string;
  readonly view_count: number | null;
  readonly duration: number | null;
  readonly duration_string: string | null;
  readonly playlist_title: string;
  readonly playlist_channel_id: string;
  readonly playlist_uploader_id: string;
  readonly n_entries: number;
}

function toVideoInfo(entry: YtDlpEntry): VideoInfo {
  return {
    id: entry.id,
    title: entry.title,
    url: entry.webpage_url ?? entry.url,
    viewCount: entry.view_count ?? null,
    duration: entry.duration ?? null,
    durationFormatted: entry.duration_string ?? null,
  };
}

function parseEntries(stdout: string): ReadonlyArray<YtDlpEntry> {
  return stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as YtDlpEntry);
}

export async function fetchChannelVideos(
  channelInput: string,
): Promise<ChannelVideosResponse> {
  const channelUrl = parseChannelInput(channelInput);

  const proc = Bun.spawn(
    ["yt-dlp", "--flat-playlist", "-j", channelUrl],
    { stdout: "pipe", stderr: "pipe" },
  );

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    throw new ExternalServiceError("yt-dlp", stderr.trim());
  }

  const entries = parseEntries(stdout);
  const first = entries[0];

  if (!first) {
    throw new NotFoundError(`No videos found for: ${channelInput}`);
  }

  return {
    channelName: first.playlist_title.replace(" - Videos", ""),
    channelId: first.playlist_channel_id,
    handle: first.playlist_uploader_id,
    totalVideos: first.n_entries,
    videos: entries.map(toVideoInfo),
  };
}
