export interface VideoInfo {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly viewCount: number | null;
  readonly duration: number | null;
  readonly durationFormatted: string | null;
}

export interface ChannelMetadataSummary {
  readonly version: number;
  readonly overview: string | null;
  readonly associatedVideoTypes: string | null;
  readonly category: string;
  readonly language: string;
}

export interface ChannelVideosResponse {
  readonly channelName: string;
  readonly channelId: string;
  readonly handle: string;
  readonly totalVideos: number;
  readonly metadata: ChannelMetadataSummary | null;
  readonly videos: ReadonlyArray<VideoInfo>;
}
