import type { GeneratedElement } from "@/contexts/ai/types";

// ─── Mermaid syntax detection ──────────────────────────────────────────────────

const MERMAID_DIAGRAM_PREFIXES = [
  "graph ",
  "graph\n",
  "flowchart ",
  "flowchart\n",
  "sequencediagram",
  "classdiagram",
  "statediagram",
  "erdiagram",
  "gantt",
  "pie",
  "journey",
  "gitgraph",
];

/**
 * Detect whether the input text contains Mermaid syntax.
 * Checks for diagram type keywords at the start or within ```mermaid fences.
 */
export function isMermaidSyntax(text: string): boolean {
  const trimmed = text.trim().toLowerCase();

  // Check for fenced mermaid blocks
  if (trimmed.includes("```mermaid")) return true;

  // Check for bare diagram keywords at the start
  return MERMAID_DIAGRAM_PREFIXES.some((prefix) =>
    trimmed.startsWith(prefix),
  );
}

/**
 * Extract Mermaid syntax from input text.
 * Handles both fenced (```mermaid ... ```) and bare syntax.
 */
function extractMermaidSource(text: string): string {
  const trimmed = text.trim();

  // Extract from fenced blocks
  const fenceMatch = trimmed.match(/```mermaid\s*([\s\S]*?)```/i);
  if (fenceMatch) return fenceMatch[1].trim();

  return trimmed;
}

// ─── Simple Mermaid flowchart parser ───────────────────────────────────────────
// This is a lightweight parser that handles the most common Mermaid flowchart
// syntax without pulling in the full mermaid rendering engine at parse time.

interface ParsedNode {
  id: string;
  label: string;
  shape: "rectangle" | "diamond" | "circle" | "round";
}

interface ParsedEdge {
  from: string;
  to: string;
  label?: string;
}

interface ParsedGraph {
  direction: "TD" | "TB" | "LR" | "RL" | "BT";
  nodes: Map<string, ParsedNode>;
  edges: ParsedEdge[];
}

/**
 * Parse a Mermaid flowchart/graph definition into structured nodes and edges.
 */
function parseMermaidFlowchart(source: string): ParsedGraph {
  const lines = source.split("\n").map((l) => l.trim()).filter(Boolean);
  const nodes = new Map<string, ParsedNode>();
  const edges: ParsedEdge[] = [];
  let direction: ParsedGraph["direction"] = "TD";

  // First line: graph/flowchart direction
  const headerMatch = lines[0]?.match(/^(?:graph|flowchart)\s*(TD|TB|LR|RL|BT)?/i);
  if (headerMatch) {
    direction = (headerMatch[1]?.toUpperCase() || "TD") as ParsedGraph["direction"];
  }

  // Regex for node shapes:
  //   A[Label]      → rectangle
  //   A(Label)      → round rectangle
  //   A{Label}      → diamond
  //   A((Label))    → circle
  //   A>Label]      → flag (treat as rectangle)
  //   A[[Label]]    → subroutine (treat as rectangle)
  const nodePatterns: Array<{
    regex: RegExp;
    shape: ParsedNode["shape"];
  }> = [
    { regex: /\(\((.+?)\)\)/, shape: "circle" },
    { regex: /\{(.+?)\}/, shape: "diamond" },
    { regex: /\[(.+?)\]/, shape: "rectangle" },
    { regex: /\((.+?)\)/, shape: "round" },
  ];

  function ensureNode(id: string, definition?: string): ParsedNode {
    const existing = nodes.get(id);
    if (existing && !definition) return existing;

    let label = id;
    let shape: ParsedNode["shape"] = "rectangle";

    if (definition) {
      for (const { regex, shape: s } of nodePatterns) {
        const match = definition.match(regex);
        if (match) {
          label = match[1].trim();
          shape = s;
          break;
        }
      }
    }

    const node: ParsedNode = { id, label, shape };
    nodes.set(id, node);
    return node;
  }

  // Edge patterns:
  //   A --> B
  //   A --- B
  //   A -->|label| B
  //   A -- label --> B
  //   A ==> B (thick)
  //   A -.-> B (dotted)
  const edgeRegex =
    /^(\w+)(\[.*?\]|\(.*?\)|\{.*?\}|\(\(.*?\)\))??\s*(-->|---|-\.->|==>|--)\s*(?:\|(.+?)\|)?\s*(\w+)(\[.*?\]|\(.*?\)|\{.*?\}|\(\(.*?\)\))?$/;
  const edgeLabelRegex =
    /^(\w+)(\[.*?\]|\(.*?\)|\{.*?\}|\(\(.*?\)\))??\s*--\s*(.+?)\s*-->\s*(\w+)(\[.*?\]|\(.*?\)|\{.*?\}|\(\(.*?\)\))?$/;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // Skip comments and subgraph directives
    if (line.startsWith("%%") || line.startsWith("subgraph") || line === "end") {
      continue;
    }

    // Try edge with inline label: A -- label --> B
    const labelMatch = line.match(edgeLabelRegex);
    if (labelMatch) {
      const [, fromId, fromDef, edgeLabel, toId, toDef] = labelMatch;
      ensureNode(fromId, fromDef);
      ensureNode(toId, toDef);
      edges.push({ from: fromId, to: toId, label: edgeLabel.trim() });
      continue;
    }

    // Try standard edge: A --> B, A -->|label| B
    const edgeMatch = line.match(edgeRegex);
    if (edgeMatch) {
      const [, fromId, fromDef, , edgeLabel, toId, toDef] = edgeMatch;
      ensureNode(fromId, fromDef);
      ensureNode(toId, toDef);
      edges.push({
        from: fromId,
        to: toId,
        label: edgeLabel?.trim(),
      });
      continue;
    }

    // Try standalone node definition: A[Label]
    const standaloneMatch = line.match(
      /^(\w+)(\[.*?\]|\(.*?\)|\{.*?\}|\(\(.*?\)\))$/,
    );
    if (standaloneMatch) {
      ensureNode(standaloneMatch[1], standaloneMatch[2]);
      continue;
    }
  }

  return { direction, nodes, edges };
}

// ─── Layout engine ─────────────────────────────────────────────────────────────

// Color palette matching the existing AI drawing color scheme
const SHAPE_COLORS: Record<
  ParsedNode["shape"],
  { fill: string; stroke: string }
> = {
  rectangle: { fill: "#E8F4F8", stroke: "#0066CC" },
  diamond: { fill: "#FFF4E6", stroke: "#E67700" },
  circle: { fill: "#E8F5E9", stroke: "#2E7D32" },
  round: { fill: "#F3E5F5", stroke: "#7B1FA2" },
};

interface LayoutPosition {
  x: number;
  y: number;
}

/**
 * Simple topological-sort-based layout engine.
 * Arranges nodes in rows (for TD/TB) or columns (for LR).
 */
function layoutGraph(
  graph: ParsedGraph,
): Map<string, LayoutPosition> {
  const positions = new Map<string, LayoutPosition>();
  const nodeIds = Array.from(graph.nodes.keys());

  if (nodeIds.length === 0) return positions;

  // Build adjacency for topological ordering
  const inDegree = new Map<string, number>();
  const children = new Map<string, string[]>();

  for (const id of nodeIds) {
    inDegree.set(id, 0);
    children.set(id, []);
  }

  for (const edge of graph.edges) {
    children.get(edge.from)?.push(edge.to);
    inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
  }

  // BFS topological sort into levels
  const levels: string[][] = [];
  const queue = nodeIds.filter((id) => (inDegree.get(id) || 0) === 0);
  const visited = new Set<string>();

  if (queue.length === 0) {
    // No roots found, just use first node
    queue.push(nodeIds[0]);
  }

  while (queue.length > 0) {
    const currentLevel = [...queue];
    levels.push(currentLevel);
    queue.length = 0;

    for (const id of currentLevel) {
      visited.add(id);
      for (const child of children.get(id) || []) {
        if (!visited.has(child)) {
          const newDeg = (inDegree.get(child) || 1) - 1;
          inDegree.set(child, newDeg);
          if (newDeg <= 0 && !queue.includes(child)) {
            queue.push(child);
          }
        }
      }
    }
  }

  // Add any unvisited nodes
  for (const id of nodeIds) {
    if (!visited.has(id)) {
      levels.push([id]);
    }
  }

  // Assign positions based on direction
  const isHorizontal = graph.direction === "LR" || graph.direction === "RL";
  const nodeWidth = 200;
  const nodeHeight = 100;
  const hGap = 120;
  const vGap = 100;

  for (let levelIdx = 0; levelIdx < levels.length; levelIdx++) {
    const level = levels[levelIdx];
    const levelCount = level.length;

    for (let nodeIdx = 0; nodeIdx < levelCount; nodeIdx++) {
      const id = level[nodeIdx];
      // Center nodes within their level
      const offset = -((levelCount - 1) * (isHorizontal ? (nodeHeight + vGap) : (nodeWidth + hGap))) / 2;

      if (isHorizontal) {
        const x = levelIdx * (nodeWidth + hGap);
        const y = offset + nodeIdx * (nodeHeight + vGap);
        positions.set(id, { x, y });
      } else {
        const x = offset + nodeIdx * (nodeWidth + hGap);
        const y = levelIdx * (nodeHeight + vGap);
        positions.set(id, { x, y });
      }
    }
  }

  return positions;
}

// ─── Convert to canvas elements ────────────────────────────────────────────────

/**
 * Convert a parsed Mermaid graph into GeneratedElement[] for the canvas.
 */
export function parseMermaidToElements(text: string): GeneratedElement[] {
  const source = extractMermaidSource(text);
  const graph = parseMermaidFlowchart(source);

  if (graph.nodes.size === 0) return [];

  const positions = layoutGraph(graph);
  const elements: GeneratedElement[] = [];

  const nodeWidth = 200;
  const nodeHeight = 100;
  const diamondSize = 150;
  const circleSize = 120;

  // Generate shape elements
  for (const [id, node] of graph.nodes) {
    const pos = positions.get(id) || { x: 0, y: 0 };
    const colors = SHAPE_COLORS[node.shape];

    switch (node.shape) {
      case "diamond":
        elements.push({
          type: "Diamond",
          x: pos.x,
          y: pos.y,
          width: diamondSize,
          height: diamondSize,
          label: node.label,
          strokeColor: colors.stroke,
          fillColor: colors.fill,
          strokeWidth: 2,
          edgeStyle: "sharp",
        });
        break;
      case "circle":
        elements.push({
          type: "Circle",
          x: pos.x + (nodeWidth - circleSize) / 2,
          y: pos.y + (nodeHeight - circleSize) / 2,
          width: circleSize,
          height: circleSize,
          label: node.label,
          strokeColor: colors.stroke,
          fillColor: colors.fill,
          strokeWidth: 2,
        });
        break;
      default:
        // rectangle and round
        elements.push({
          type: "Rectangle",
          x: pos.x,
          y: pos.y,
          width: nodeWidth,
          height: nodeHeight,
          label: node.label,
          strokeColor: colors.stroke,
          fillColor: colors.fill,
          strokeWidth: 2,
          edgeStyle: node.shape === "round" ? "curve" : "curve",
        });
        break;
    }
  }

  // Generate arrow elements
  const isHorizontal =
    graph.direction === "LR" || graph.direction === "RL";

  for (const edge of graph.edges) {
    const fromPos = positions.get(edge.from);
    const toPos = positions.get(edge.to);
    if (!fromPos || !toPos) continue;

    const fromNode = graph.nodes.get(edge.from);
    const toNode = graph.nodes.get(edge.to);

    // Calculate arrow start and end based on node shapes
    const getNodeCenter = (pos: LayoutPosition, node?: ParsedNode) => {
      if (!node) return { x: pos.x, y: pos.y };
      switch (node.shape) {
        case "diamond":
          return { x: pos.x + diamondSize / 2, y: pos.y + diamondSize / 2 };
        case "circle":
          return {
            x: pos.x + nodeWidth / 2,
            y: pos.y + nodeHeight / 2,
          };
        default:
          return { x: pos.x + nodeWidth / 2, y: pos.y + nodeHeight / 2 };
      }
    };

    const fromCenter = getNodeCenter(fromPos, fromNode);
    const toCenter = getNodeCenter(toPos, toNode);

    let arrowX: number, arrowY: number, arrowW: number, arrowH: number;

    if (isHorizontal) {
      // Horizontal layout: arrows go left-to-right
      arrowX = fromPos.x + nodeWidth;
      arrowY = fromCenter.y;
      arrowW = toPos.x - arrowX;
      arrowH = toCenter.y - arrowY;
    } else {
      // Vertical layout: arrows go top-to-bottom
      arrowX = fromCenter.x;
      arrowY = fromPos.y + nodeHeight;
      arrowW = toCenter.x - arrowX;
      arrowH = toPos.y - arrowY;
    }

    elements.push({
      type: "Arrow",
      x: arrowX,
      y: arrowY,
      width: arrowW,
      height: arrowH,
      strokeColor: "#64748B",
      strokeWidth: 2,
    });

    // Add edge label as Text element if present
    if (edge.label) {
      elements.push({
        type: "Text",
        x: arrowX + arrowW / 2 - edge.label.length * 4,
        y: arrowY + arrowH / 2 - 10,
        text: edge.label,
        fontSize: 14,
        strokeColor: "#64748B",
      });
    }
  }

  return elements;
}
