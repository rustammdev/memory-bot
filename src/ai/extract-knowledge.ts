import { chatCompletion, parseJsonResponse } from "./client";
import { NODE_TYPES, RELATIONSHIP_TYPES, type NodeType, type RelationshipType } from "../repositories/knowledge.repo";

export interface ExtractedEntity {
  readonly label: string;
  readonly type: NodeType;
  readonly description: string;
}

export interface ExtractedRelationship {
  readonly source: string;
  readonly target: string;
  readonly type: RelationshipType;
  readonly context: string;
}

export interface ExtractionResult {
  readonly entities: ReadonlyArray<ExtractedEntity>;
  readonly relationships: ReadonlyArray<ExtractedRelationship>;
}

const VALID_NODE_TYPES: ReadonlySet<string> = new Set(NODE_TYPES);
const VALID_RELATIONSHIP_TYPES: ReadonlySet<string> = new Set(RELATIONSHIP_TYPES);

const MAX_CHUNK_CHARS = 3000;
const MAX_ENTITIES_PER_BATCH = 30;

export async function extractKnowledge(
  videoTitle: string,
  channelCategory: string,
  chunks: ReadonlyArray<{ content: string; chunkId: string }>,
): Promise<ExtractionResult> {
  const combinedContent = chunks
    .map((c) => c.content)
    .join("\n---\n")
    .slice(0, MAX_CHUNK_CHARS);

  const content = await chatCompletion(
    [
      {
        role: "system",
        content: `You are a knowledge extraction expert. Analyze the video transcript and extract KEY CONCEPTS and their RELATIONSHIPS.

Rules:
- Extract only SUBSTANTIVE concepts (technologies, methods, ideas, tools, people, patterns)
- Do NOT extract generic words ("video", "today", "example", "code", "file", "function")
- Each entity label: 1-4 words, capitalized properly (e.g. "React Hooks", "TypeScript")
- Maximum ${MAX_ENTITIES_PER_BATCH} entities per extraction
- Focus on concepts a LEARNER would want to understand and navigate between

Entity types: concept, tool, framework, method, person, pattern, language, library, platform
Relationship types: requires, part_of, related_to, alternative_to, extends, used_with, implements

Return ONLY valid JSON:
{
  "entities": [{ "label": "...", "type": "...", "description": "one sentence" }],
  "relationships": [{ "source": "entity label", "target": "entity label", "type": "...", "context": "why related" }]
}`,
      },
      {
        role: "user",
        content: `Video: "${videoTitle}" (${channelCategory} channel)\n\nTranscript:\n${combinedContent}`,
      },
    ],
    { maxTokens: 2000 },
  );

  const raw = parseJsonResponse<{ entities: ExtractedEntity[]; relationships: ExtractedRelationship[] }>(content);

  const entities = (raw.entities ?? [])
    .filter((e) => e.label && e.label.length >= 2 && e.label.length <= 60)
    .filter((e) => VALID_NODE_TYPES.has(e.type))
    .map((e) => ({
      label: e.label.trim(),
      type: e.type as NodeType,
      description: (e.description ?? "").slice(0, 200),
    }));

  const entityLabels = new Set(entities.map((e) => e.label.toLowerCase()));

  const relationships = (raw.relationships ?? [])
    .filter((r) => r.source && r.target && r.source !== r.target)
    .filter((r) => VALID_RELATIONSHIP_TYPES.has(r.type))
    .filter(
      (r) =>
        entityLabels.has(r.source.toLowerCase()) &&
        entityLabels.has(r.target.toLowerCase()),
    )
    .map((r) => ({
      source: r.source.trim(),
      target: r.target.trim(),
      type: r.type as RelationshipType,
      context: (r.context ?? "").slice(0, 200),
    }));

  return { entities, relationships };
}
