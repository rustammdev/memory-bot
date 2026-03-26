import { chatCompletion, parseJsonResponse } from "./client";

export interface ClusterSummary {
  readonly clusterId: number;
  readonly videoTitles: ReadonlyArray<string>;
  readonly sampleContent: string;
  readonly chunkCount: number;
}

export interface ExtractedTopic {
  readonly clusterId: number;
  readonly label: string;
  readonly description: string;
  readonly themes: ReadonlyArray<string>;
}

const MAX_TITLES_PER_CLUSTER = 5;
const MAX_SAMPLE_CHARS = 500;

export async function extractTopicsFromClusters(
  channelName: string,
  category: string,
  clusters: ReadonlyArray<ClusterSummary>,
): Promise<ReadonlyArray<ExtractedTopic>> {
  const clusterBlock = clusters
    .map((c) => {
      const titles = c.videoTitles.slice(0, MAX_TITLES_PER_CLUSTER).join(", ");
      const sample = c.sampleContent.slice(0, MAX_SAMPLE_CHARS);
      return `Cluster ${c.clusterId} (${c.chunkCount} chunks):\n  Videos: ${titles}\n  Sample: "${sample}"`;
    })
    .join("\n\n");

  const content = await chatCompletion(
    [
      {
        role: "system",
        content: `You are a YouTube content analyst. Given clusters of transcript content from the channel "${channelName}" (${category} channel), label each cluster.

For each cluster return:
1. "clusterId" — the cluster number given
2. "label" — concise topic label (2-5 words)
3. "description" — one-sentence description of what the cluster covers
4. "themes" — 3-5 key subtopics within the cluster

Return ONLY valid JSON array: [{ "clusterId": 0, "label": "...", "description": "...", "themes": [...] }, ...]`,
      },
      {
        role: "user",
        content: `Channel: "${channelName}" (${category})\n\n${clusterBlock}`,
      },
    ],
    { maxTokens: 1500 },
  );

  const parsed = parseJsonResponse<ReadonlyArray<ExtractedTopic>>(content);

  return parsed.map((t) => ({
    clusterId: t.clusterId ?? 0,
    label: t.label ?? "Unknown",
    description: t.description ?? "",
    themes: t.themes ?? [],
  }));
}
