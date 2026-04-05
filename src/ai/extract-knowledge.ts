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

export interface VideoInput {
  readonly title: string;
  readonly summary: string;
}

const VALID_NODE_TYPES: ReadonlySet<string> = new Set(NODE_TYPES);
const VALID_RELATIONSHIP_TYPES: ReadonlySet<string> = new Set(RELATIONSHIP_TYPES);

const MAX_INPUT_CHARS = 12_000;
const MAX_ENTITIES_PER_BATCH = 40;

function buildSystemPrompt(): string {
  return `You are a knowledge graph extraction specialist for technical video content.

ENTITY TYPES — use only these:
- person: Named real individuals
- tool: Named software tools, editors, CLIs, IDEs
- language: Programming or markup languages
- framework: Named frameworks and runtimes
- library: Named packages and libraries
- concept: Specific technical concepts with a clear definition
- method: Named algorithms, patterns, techniques
- platform: Named services, clouds, hosting platforms
- pattern: Named architectural or design patterns

RELATIONSHIP TYPES — use only these:
requires, part_of, related_to, alternative_to, extends, used_with, implements

EXTRACTION RULES:
1. Every entity must be a specific proper noun or named technical term
2. Every entity must have a description — one precise sentence explaining what it is
3. An entity without a meaningful description is too generic — omit it
4. Relationships must reflect real technical connections, not just co-occurrence
5. Use consistent labels — the same entity must always have the same label
6. Extract at most ${MAX_ENTITIES_PER_BATCH} entities; prefer fewer high-quality entities

OUTPUT — valid JSON only:
{
  "entities": [{ "label": "...", "type": "...", "description": "..." }],
  "relationships": [{ "source": "entity label", "target": "entity label", "type": "...", "context": "..." }]
}`;
}

interface RawExtractionResult {
  readonly entities: ReadonlyArray<ExtractedEntity>;
  readonly relationships: ReadonlyArray<ExtractedRelationship>;
}

function normalizeLabel(label: string): string {
  return label.toLowerCase().trim().replace(/\s+/g, " ");
}

function parseExtractionResponse(response: string): RawExtractionResult {
  const raw = parseJsonResponse<{ entities: unknown[]; relationships: unknown[] }>(response);

  const entities: ExtractedEntity[] = [];
  for (const item of raw.entities ?? []) {
    if (typeof item !== "object" || item === null) continue;
    const e = item as Record<string, unknown>;
    const label = typeof e["label"] === "string" ? e["label"].trim() : "";
    const type = typeof e["type"] === "string" ? e["type"] : "";
    const description = typeof e["description"] === "string" ? e["description"].trim() : "";
    if (label.length < 2 || label.length > 60) continue;
    if (!VALID_NODE_TYPES.has(type)) continue;
    if (description.length < 10) continue;
    entities.push({ label, type: type as NodeType, description: description.slice(0, 200) });
  }

  const relationships: ExtractedRelationship[] = [];
  for (const item of raw.relationships ?? []) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    const source = typeof r["source"] === "string" ? r["source"].trim() : "";
    const target = typeof r["target"] === "string" ? r["target"].trim() : "";
    const type = typeof r["type"] === "string" ? r["type"] : "";
    const context = typeof r["context"] === "string" ? r["context"].trim() : "";
    if (!source || !target || source === target) continue;
    if (!VALID_RELATIONSHIP_TYPES.has(type)) continue;
    relationships.push({ source, target, type: type as RelationshipType, context: context.slice(0, 200) });
  }

  return { entities, relationships };
}

function mergeEntities(
  entities: ReadonlyArray<ExtractedEntity>,
): ReadonlyArray<ExtractedEntity> {
  const seen = new Map<string, ExtractedEntity>();
  for (const entity of entities) {
    const key = normalizeLabel(entity.label);
    const existing = seen.get(key);
    if (!existing || entity.description.length > existing.description.length) {
      seen.set(key, entity);
    }
  }
  return Array.from(seen.values());
}

function mergeRelationships(
  relationships: ReadonlyArray<ExtractedRelationship>,
): ReadonlyArray<ExtractedRelationship> {
  const seen = new Set<string>();
  const result: ExtractedRelationship[] = [];
  for (const rel of relationships) {
    const key = `${normalizeLabel(rel.source)}|${normalizeLabel(rel.target)}|${rel.type}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(rel);
    }
  }
  return result;
}

export async function extractKnowledge(
  videos: ReadonlyArray<VideoInput>,
  channelCategory: string,
): Promise<ExtractionResult> {
  const formatted = videos
    .map((v, i) => `[${i + 1}] "${v.title}"\n${v.summary}`)
    .join("\n\n");
  const trimmed = formatted.slice(0, MAX_INPUT_CHARS);

  const systemMessage = { role: "system" as const, content: buildSystemPrompt() };
  const userMessage = {
    role: "user" as const,
    content: `${channelCategory} channel — ${videos.length} video summaries:\n\n${trimmed}`,
  };

  // Pass 1: Initial extraction
  const pass1Response = await chatCompletion([systemMessage, userMessage], { maxTokens: 3000 });
  const pass1 = parseExtractionResponse(pass1Response);

  // Pass 2: Gleaning — catch missed named entities (GraphRAG pattern)
  const gleanMessage = {
    role: "user" as const,
    content: `Review your extraction. Are there specific named tools, people, companies, frameworks, or libraries mentioned in the summaries that you did not extract? Return only entities not already listed, in the same JSON format. If nothing was missed, return {"entities":[],"relationships":[]}.`,
  };

  const pass2Response = await chatCompletion(
    [
      systemMessage,
      userMessage,
      { role: "assistant" as const, content: pass1Response },
      gleanMessage,
    ],
    { maxTokens: 1000 },
  );
  const pass2 = parseExtractionResponse(pass2Response);

  const allEntities = mergeEntities([...pass1.entities, ...pass2.entities]);
  const entityLabels = new Set(allEntities.map((e) => normalizeLabel(e.label)));

  const allRelationships = mergeRelationships(
    [...pass1.relationships, ...pass2.relationships].filter(
      (r) =>
        entityLabels.has(normalizeLabel(r.source)) &&
        entityLabels.has(normalizeLabel(r.target)),
    ),
  );

  return { entities: allEntities, relationships: allRelationships };
}
