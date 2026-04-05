export interface VideoInfo {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly viewCount: number | null;
  readonly duration: number | null;
  readonly durationFormatted: string | null;
  readonly uploadedAt: Date | null;
}

export interface VideoThumbnails {
  readonly default: string | null;
  readonly medium: string | null;
  readonly high: string | null;
  readonly maxres: string | null;
}

export interface VideoApiItem extends VideoInfo {
  readonly thumbnails: VideoThumbnails;
  readonly tags: ReadonlyArray<string>;
  readonly hasTranscript: boolean;
}

export interface ChannelMetadataSummary {
  readonly version: number;
  readonly overview: string | null;
  readonly associatedVideoTypes: string | null;
  readonly category: string;
  readonly language: string;
}

export interface RawChannelData {
  readonly channelName: string;
  readonly channelId: string;
  readonly handle: string;
  readonly totalVideos: number;
  readonly videos: ReadonlyArray<VideoInfo>;
}

export interface ChannelVideosResponse {
  readonly channelName: string;
  readonly channelId: string;
  readonly handle: string;
  readonly avatarUrl: string | null;
  readonly bannerUrl: string | null;
  readonly totalVideos: number;
  readonly metadata: ChannelMetadataSummary | null;
  readonly videos: ReadonlyArray<VideoApiItem>;
  readonly page: number;
  readonly limit: number;
  readonly hasMore: boolean;
}
