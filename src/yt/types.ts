export interface VideoInfo {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly viewCount: number | null;
  readonly duration: number | null;
  readonly durationFormatted: string | null;
}

export interface ChannelVideosResponse {
  readonly channelName: string;
  readonly channelId: string;
  readonly handle: string;
  readonly totalVideos: number;
  readonly videos: ReadonlyArray<VideoInfo>;
}
