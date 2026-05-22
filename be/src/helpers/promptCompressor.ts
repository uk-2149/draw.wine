export interface CompressedPromptDSL {
  intent: string;
  components: string[];
  relationships: Array<{ from: string; to: string; type: string }>;
  layout: string;
  style: string;
  originalText: string;
}

/**
 * Lightweight semantic compressor for AI diagram prompts.
 * Extracts key entities, intents, and relationships from verbose user text
 * to produce a condensed, structured DSL.
 */
export function compressPrompt(userPrompt: string): string {
  const text = userPrompt.toLowerCase();

  // 1. Extract Intent
  let intent = "general diagram";
  if (text.includes("flowchart") || text.includes("flow chart")) {
    intent = "flowchart";
  } else if (text.includes("architecture") || text.includes("system")) {
    intent = "architecture diagram";
  } else if (text.includes("mind map") || text.includes("mindmap")) {
    intent = "mind map";
  } else if (text.includes("sequence")) {
    intent = "sequence diagram";
  }

  // 2. Extract Components (Heuristics)
  const components = new Set<string>();
  const componentKeywords = [
    "server", "database", "api", "gateway", "client", "frontend", "backend",
    "user", "auth", "cache", "queue", "worker", "microservice", "service",
    "app", "browser", "mobile", "load balancer"
  ];
  
  for (const keyword of componentKeywords) {
    if (text.includes(keyword)) {
      // Try to capture adjacent words for context (e.g. "auth service" or "sql database")
      const regex = new RegExp(`(\\w+\\s+)?${keyword}(\\s+\\w+)?`, "g");
      let match;
      while ((match = regex.exec(text)) !== null) {
        components.add(match[0].trim());
      }
      components.add(keyword);
    }
  }

  // 3. Extract Relationships
  const relationships: string[] = [];
  const relPatterns = [
    /(.+?)\s+talks to\s+(.+)/i,
    /(.+?)\s+connects to\s+(.+)/i,
    /(.+?)\s+sends data to\s+(.+)/i,
    /(.+?)\s+routes to\s+(.+)/i,
    /(.+?)\s+reads from\s+(.+)/i,
    /(.+?)\s+writes to\s+(.+)/i,
    /(.+?)\s+calls\s+(.+)/i,
  ];

  for (const pattern of relPatterns) {
    const match = userPrompt.match(pattern);
    if (match) {
      // Basic stop-word truncation
      const from = match[1].split(/\s(which|that|and)\s/)[0].trim();
      let to = match[2].split(/\s(which|that|and)\s/)[0].trim();
      relationships.push(`[${from}] -> [${to}]`);
    }
  }

  // 4. Extract Style/Layout
  let layout = "auto";
  if (text.includes("horizontal") || text.includes("left to right")) layout = "horizontal";
  if (text.includes("vertical") || text.includes("top down")) layout = "vertical";

  // Build the DSL
  const dsl: CompressedPromptDSL = {
    intent,
    components: Array.from(components),
    relationships: relationships.map(rel => {
      const parts = rel.split(" -> ");
      return { from: parts[0].replace(/\[|\]/g, ""), to: parts[1].replace(/\[|\]/g, ""), type: "arrow" };
    }),
    layout,
    style: "professional",
    originalText: userPrompt
  };

  // Convert to compact string for Gemini
  // We include the original text as a fallback context, but emphasize the structured parts
  return `
[COMPRESSED_INTENT]
TYPE: ${dsl.intent.toUpperCase()}
LAYOUT: ${dsl.layout.toUpperCase()}
COMPONENTS: ${dsl.components.length > 0 ? dsl.components.join(", ") : "Infer from prompt"}
RELATIONSHIPS: ${dsl.relationships.length > 0 ? dsl.relationships.map(r => `${r.from} -> ${r.to}`).join(" | ") : "Infer from prompt"}

[ORIGINAL_CONTEXT]
${userPrompt.length > 500 ? userPrompt.substring(0, 500) + "..." : userPrompt}

INSTRUCTION: Use the COMPRESSED_INTENT to guide the structure, but fill in missing details from the ORIGINAL_CONTEXT.
`.trim();
}
