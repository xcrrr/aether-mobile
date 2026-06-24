import { MemoryCategory, MemoryEntry, MemoryEdge } from '@/secondbrain/types';

export const CATEGORY_COLORS: Record<MemoryCategory, string> = {
  identity: '#7C3AED', personality: '#EC4899', preferences: '#F59E0B', goals: '#10B981',
  knowledge: '#3B82F6', relationships: '#EF4444', patterns: '#06B6D4', emotional: '#F472B6',
  context: '#8B5CF6',
};

export interface GraphNode {
  id: string;
  label: string;
  category: MemoryCategory;
  color: string;
  val: number;
  opacity: number;
  /** Just learned/updated in the latest extraction — rendered bright + framed. */
  recent: boolean;
}
export interface GraphLink { source: string; target: string; relation: string; }
export interface GraphData { nodes: GraphNode[]; links: GraphLink[]; }

/** Short node caption for the always-on label sprite (the full value lives in the popup). */
export function shortLabel(value: string, max = 18): string {
  const v = value.trim();
  return v.length <= max ? v : `${v.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Map memory entries + edges to the 3d-force-graph shape (pure). `recentKeys`
 * marks the facts learned in the most recent extraction so the graph can light
 * them up brighter than the rest.
 */
export function toGraphData(
  entries: MemoryEntry[],
  edges: MemoryEdge[],
  recentKeys: Iterable<string> = [],
): GraphData {
  const recent = recentKeys instanceof Set ? recentKeys : new Set(recentKeys);
  // 3d-force-graph keys nodes by id and requires them unique. Two entries can
  // share a key across categories, so collapse them to one node (keep the larger,
  // carry the recent flag) — otherwise the graph's node map breaks and renders blank.
  const byId = new Map<string, GraphNode>();
  for (const e of entries) {
    const node: GraphNode = {
      id: e.key,
      label: shortLabel(e.value),
      category: e.category,
      color: CATEGORY_COLORS[e.category],
      val: 1 + e.confidence * 4 + e.timesReinforced,
      opacity: e.stale ? 0.4 : 0.95,
      recent: recent.has(e.key),
    };
    const prev = byId.get(node.id);
    if (!prev) {
      byId.set(node.id, node);
    } else {
      node.recent = node.recent || prev.recent;
      if (node.val >= prev.val) byId.set(node.id, node);
      else prev.recent = node.recent;
    }
  }
  const nodes: GraphNode[] = [...byId.values()];
  const keys = new Set(nodes.map((n) => n.id));
  const links: GraphLink[] = edges
    .filter((e) => keys.has(e.fromKey) && keys.has(e.toKey))
    .map((e) => ({ source: e.fromKey, target: e.toKey, relation: e.relation }));
  return { nodes, links };
}
