export interface VideoSource {
  readonly videoId: string;   // YouTube video ID (empty if unavailable)
  readonly title: string;     // Video title (empty if only videoId is known)
  readonly channelName?: string; // For multi-channel context
}

export type SseEvent =
  | { readonly type: "token"; readonly text: string }
  | { readonly type: "thinking"; readonly text: string }
  | { readonly type: "tool_start"; readonly name: string; readonly input: Record<string, unknown> }
  | { readonly type: "tool_end"; readonly name: string }
  | { readonly type: "sources"; readonly videos: ReadonlyArray<VideoSource> }
  | { readonly type: "done" }
  | { readonly type: "error"; readonly message: string };

export function serializeSseEvent(event: SseEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
