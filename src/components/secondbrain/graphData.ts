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
}
export interface GraphLink { source: string; target: string; relation: string; }
export interface GraphData { nodes: GraphNode[]; links: GraphLink[]; }

/** Short node caption for the always-on label sprite (the full value lives in the popup). */
export function shortLabel(value: string, max = 24): string {
  const v = value.trim();
  return v.length <= max ? v : `${v.slice(0, max - 1).trimEnd()}…`;
}

/** Map memory entries + edges to the 3d-force-graph shape (pure). */
export function toGraphData(entries: MemoryEntry[], edges: MemoryEdge[]): GraphData {
  const nodes: GraphNode[] = entries.map((e) => ({
    id: e.key,
    label: shortLabel(e.value),
    category: e.category,
    color: CATEGORY_COLORS[e.category],
    val: 1 + e.confidence * 4 + e.timesReinforced,
    opacity: e.stale ? 0.4 : 0.95,
  }));
  const keys = new Set(entries.map((e) => e.key));
  const links: GraphLink[] = edges
    .filter((e) => keys.has(e.fromKey) && keys.has(e.toKey))
    .map((e) => ({ source: e.fromKey, target: e.toKey, relation: e.relation }));
  return { nodes, links };
}
