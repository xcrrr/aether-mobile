import {
  MEMORY_VISUAL_CATEGORIES,
  MemoryCategory,
  MemoryEntry,
  MemoryEdge,
  MemoryVisualCategory,
} from '@/secondbrain/types';

export const VISUAL_CATEGORY_LABELS: Record<MemoryVisualCategory, string> = {
  projects: 'Projects',
  work: 'Work / Business',
  people: 'People',
  learning: 'Learning / Ideas',
  health: 'Health / Fitness',
  travel: 'Travel / Places',
  personal: 'Personal / Life',
  uncategorized: 'Uncategorized',
};

/**
 * Category hues for the Core globe and its detail sheet.
 *
 * The previous set sat between 50% and 60% lightness at very low chroma, so on
 * a dark ground eight categories read as one brownish grey and the globe looked
 * like gravel. These keep the same restrained, non-neon register — this is not
 * a dashboard — but separate the hues properly and lift the chroma enough that
 * a category is identifiable without reading its label. Lightness is held near
 * 62% so the same values stay legible on the warm-paper theme.
 */
export const VISUAL_CATEGORY_COLORS: Record<MemoryVisualCategory, string> = {
  projects: '#8B7BD8',
  work: '#5C8FC7',
  people: '#C87C8C',
  learning: '#C89A57',
  health: '#5FA98A',
  travel: '#4FA2B5',
  personal: '#A681BE',
  uncategorized: '#8C8C93',
};

export const CATEGORY_COLORS: Record<MemoryCategory, string> = {
  identity: VISUAL_CATEGORY_COLORS.personal,
  personality: VISUAL_CATEGORY_COLORS.personal,
  preferences: VISUAL_CATEGORY_COLORS.personal,
  goals: VISUAL_CATEGORY_COLORS.projects,
  knowledge: VISUAL_CATEGORY_COLORS.learning,
  relationships: VISUAL_CATEGORY_COLORS.people,
  patterns: VISUAL_CATEGORY_COLORS.personal,
  emotional: VISUAL_CATEGORY_COLORS.personal,
  context: VISUAL_CATEGORY_COLORS.projects,
};

export interface GraphNode {
  id: string;
  entryId: string;
  title: string;
  label: string;
  type: 'memory';
  category: MemoryVisualCategory;
  categoryLabel: string;
  sourceCategory: MemoryCategory;
  color: string;
  val: number;
  opacity: number;
  recent: boolean;
  summary: string;
  sourceConversationId: string;
  createdAt: number;
  updatedAt: number;
  importance: number;
  connectionCount: number;
  centralityScore: number;
  semanticKeywords: string[];
  x: number;
  y: number;
  z: number;
}

export interface GraphLink {
  id: string;
  source: string;
  target: string;
  relation: string;
  /** Only real, explainable relationships exist:
   *  - explicit: a relation the model extracted from the user's own words
   *  - discussed_together: facts saved from the same conversation
   *  - shared_topic: both memory texts contain the same meaningful word(s)
   *  - same_cluster: minimal spanning links that keep a category cluster
   *    connected, picked by keyword overlap then time proximity */
  relationshipType: 'explicit' | 'discussed_together' | 'shared_topic' | 'same_cluster';
  relationshipStrength: number;
  explanation: string;
  sourceEvidence?: string;
  isUserConfirmed: boolean;
}

/** Layout parameters computed alongside the data so the renderer's physics and
 *  the seeded positions agree on the globe's size and cluster geometry. */
export interface GraphLayout {
  radius: number;
  clusterCenters: Partial<Record<MemoryVisualCategory, [number, number, number]>>;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  layout: GraphLayout;
}

const STOPWORDS = new Set([
  'about', 'after', 'also', 'and', 'because', 'been', 'being', 'could', 'current',
  'currently', 'doing', 'each', 'enjoys', 'every', 'from', 'goes', 'going',
  'have', 'into', 'just', 'like', 'likes', 'loves', 'main', 'many', 'might',
  'more', 'most', 'much', 'need', 'needs', 'often', 'only', 'other', 'over',
  'plans', 'prefers', 'really', 'should', 'since', 'some', 'still', 'than',
  'that', 'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those',
  'used', 'user', 'uses', 'using', 'usually', 'very', 'want', 'wants', 'when',
  'where', 'which', 'while', 'will', 'with', 'work', 'working', 'would', 'your',
]);

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function hash01(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function shortLabel(value: string, max = 24): string {
  const v = value.trim();
  return v.length <= max ? v : `${v.slice(0, max - 3).trimEnd()}...`;
}

function hasAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

export function inferVisualCategory(entry: MemoryEntry): MemoryVisualCategory {
  if (entry.visualCategory) return entry.visualCategory;
  const text = `${entry.key} ${entry.value}`.toLowerCase();

  if (hasAny(text, ['gym', 'fitness', 'health', 'sleep', 'diet', 'workout', 'training', 'medical'])) return 'health';
  if (hasAny(text, ['travel', 'trip', 'city', 'country', 'place', 'hotel', 'flight', 'warsaw', 'krakow', 'london'])) return 'travel';
  if (entry.category === 'relationships' || hasAny(text, ['friend', 'partner', 'wife', 'husband', 'brother', 'sister', 'client', 'person'])) return 'people';
  if (hasAny(text, ['business', 'company', 'client', 'law', 'legal', 'revenue', 'sales', 'studio', 'work', 'job'])) return 'work';
  if (hasAny(text, ['aether', 'project', 'app', 'ship', 'launch', 'build', 'product', 'roadmap'])) return 'projects';
  if (entry.category === 'knowledge' || hasAny(text, ['learn', 'learning', 'idea', 'research', 'book', 'course', 'skill', 'ai', 'model'])) return 'learning';
  if (entry.category === 'goals' || entry.category === 'context') return 'projects';
  if (entry.category === 'identity' || entry.category === 'personality' || entry.category === 'preferences' || entry.category === 'patterns' || entry.category === 'emotional') return 'personal';
  return 'uncategorized';
}

function keywordsFor(entry: MemoryEntry): string[] {
  const text = `${entry.key} ${entry.value}`.toLowerCase();
  const words = text
    .replace(/[^a-z0-9_ ]+/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^_+|_+$/g, ''))
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  return [...new Set(words)].slice(0, 10);
}

function importanceFor(entry: MemoryEntry, recent: boolean): number {
  const reinforcement = Math.log1p(entry.timesReinforced) * 0.16;
  const confidence = entry.confidence * 0.42;
  const recency = recent ? 0.08 : 0;
  const stalePenalty = entry.stale ? 0.22 : 0;
  return clamp(0.24 + confidence + reinforcement + recency - stalePenalty, 0.12, 1);
}

/** Radius of the whole knowledge globe: grows with the cube root of the memory
 *  count, so density stays roughly constant — more memories means a bigger,
 *  denser ball, never wider scatter. */
export function graphRadiusFor(count: number): number {
  return 8 + 5.5 * Math.cbrt(Math.max(1, count));
}

function seededUnit(id: string): [number, number, number] {
  const a = hash01(`${id}:a`) * Math.PI * 2;
  const b = Math.acos(2 * hash01(`${id}:b`) - 1);
  return [Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)];
}

function fibonacciDirection(index: number, total: number): [number, number, number] {
  if (total <= 1) return [0, 0, 0];
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (2 * (index + 0.5)) / total;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = golden * index;
  return [Math.cos(theta) * r, y, Math.sin(theta) * r];
}

/** Deterministic cluster centers: only the categories actually present get a
 *  spot, evenly spread on a sphere inside the globe. One category sits at the
 *  center — no empty reserved corners. */
export function clusterCentersFor(
  activeCategories: MemoryVisualCategory[],
  radius: number,
): Partial<Record<MemoryVisualCategory, [number, number, number]>> {
  const centers: Partial<Record<MemoryVisualCategory, [number, number, number]>> = {};
  const spread = radius * 0.55;
  activeCategories.forEach((category, i) => {
    const [dx, dy, dz] = fibonacciDirection(i, activeCategories.length);
    centers[category] = [dx * spread, dy * spread, dz * spread];
  });
  return centers;
}

/** Seed every node inside its cluster's local ball. Deterministic per id, so
 *  the same memories land in the same place on every entry. */
function assignPositions(nodes: GraphNode[], layout: GraphLayout): void {
  const sizes = new Map<MemoryVisualCategory, number>();
  for (const n of nodes) sizes.set(n.category, (sizes.get(n.category) ?? 0) + 1);
  for (const n of nodes) {
    const [cx, cy, cz] = layout.clusterCenters[n.category] ?? [0, 0, 0];
    const size = sizes.get(n.category) ?? 1;
    const spread = Math.min(3.2 + 2.4 * Math.cbrt(size), layout.radius * 0.52);
    const [ux, uy, uz] = seededUnit(n.id);
    let local = spread * (0.25 + 0.75 * Math.cbrt(hash01(`${n.id}:r`)));
    local *= 1.12 - n.importance * 0.24;
    if (n.opacity < 0.6) local *= 1.3;
    n.x = cx + ux * local;
    n.y = cy + uy * local;
    n.z = cz + uz * local;
  }
}

function relationPhrase(relation: string): string {
  return relation.replace(/_/g, ' ');
}

function addLink(
  links: GraphLink[],
  seen: Set<string>,
  source: string,
  target: string,
  relation: string,
  type: GraphLink['relationshipType'],
  relationshipStrength: number,
  explanation: string,
  sourceEvidence?: string,
) {
  if (source === target) return;
  const ordered = source < target ? `${source}|${target}|${relation}` : `${target}|${source}|${relation}`;
  if (seen.has(ordered)) return;
  seen.add(ordered);
  links.push({
    id: `${type}:${ordered}`,
    source,
    target,
    relation,
    relationshipType: type,
    relationshipStrength,
    explanation,
    sourceEvidence,
    isUserConfirmed: false,
  });
}

export function connectionExplanation(node: GraphNode, other: GraphNode, link?: GraphLink): string {
  if (link?.explanation) return link.explanation;
  if (node.sourceConversationId && node.sourceConversationId === other.sourceConversationId) {
    return 'Connected because both memories were saved from the same conversation.';
  }
  return 'Related through saved Second Brain context.';
}

export function toGraphData(
  entries: MemoryEntry[],
  edges: MemoryEdge[],
  recentKeys: Iterable<string> = [],
): GraphData {
  const recent = recentKeys instanceof Set ? recentKeys : new Set(recentKeys);
  const byId = new Map<string, GraphNode>();

  for (const e of entries) {
    const category = inferVisualCategory(e);
    const isRecent = recent.has(e.key);
    const importance = importanceFor(e, isRecent);
    const node: GraphNode = {
      id: e.key,
      entryId: e.id,
      title: e.value.trim() || e.key,
      label: shortLabel(e.value),
      type: 'memory',
      category,
      categoryLabel: VISUAL_CATEGORY_LABELS[category],
      sourceCategory: e.category,
      color: VISUAL_CATEGORY_COLORS[category],
      val: clamp(0.48 + importance * 1.12, 0.58, 1.72),
      opacity: e.stale ? 0.42 : 0.94,
      recent: isRecent,
      summary: e.value,
      sourceConversationId: e.sourceConversationId,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      importance,
      connectionCount: 0,
      centralityScore: 0,
      semanticKeywords: keywordsFor(e),
      x: 0,
      y: 0,
      z: 0,
    };
    const prev = byId.get(node.id);
    if (!prev) {
      byId.set(node.id, node);
      continue;
    }
    // The store only enforces one entry per (category, key), so the same key can
    // legitimately hold two different facts in two different categories. Folding
    // them into one node here made a real memory disappear from Core. The weaker
    // one keeps its own node under a disambiguated id; extracted edges reference
    // keys, so those stay on the primary, and the displaced node still joins its
    // category cluster.
    const stronger = node.importance >= prev.importance ? node : prev;
    const weaker = stronger === node ? prev : node;
    byId.set(node.id, { ...stronger, recent: stronger.recent || weaker.recent });
    const displacedId = `${weaker.id}#${weaker.entryId}`;
    byId.set(displacedId, { ...weaker, id: displacedId });
  }

  const nodes = [...byId.values()];
  const keys = new Set(nodes.map((n) => n.id));
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const links: GraphLink[] = [];
  const seen = new Set<string>();

  for (const e of edges) {
    if (!keys.has(e.fromKey) || !keys.has(e.toKey)) continue;
    const source = nodeById.get(e.fromKey)!;
    const target = nodeById.get(e.toKey)!;
    addLink(
      links,
      seen,
      e.fromKey,
      e.toKey,
      e.relation,
      'explicit',
      1,
      `Connected because "${source.label}" is linked to "${target.label}" by "${relationPhrase(e.relation)}".`,
      `Extracted relationship: ${e.relation}`,
    );
  }

  // Same-conversation grouping: real ("these were saved from the same chat")
  // and explainable. One star per conversation from its most important memory.
  const byConversation = new Map<string, GraphNode[]>();
  for (const n of nodes) {
    if (!n.sourceConversationId || n.sourceConversationId === 'manual') continue;
    const group = byConversation.get(n.sourceConversationId) ?? [];
    group.push(n);
    byConversation.set(n.sourceConversationId, group);
  }
  const explicitPairs = new Set(links.map((l) => pairKey(l.source, l.target)));
  for (const group of byConversation.values()) {
    const sorted = group.sort((a, b) => b.importance - a.importance || b.updatedAt - a.updatedAt).slice(0, 26);
    for (let i = 1; i < sorted.length; i += 1) {
      if (explicitPairs.has(pairKey(sorted[0].id, sorted[i].id))) continue;
      addLink(
        links,
        seen,
        sorted[0].id,
        sorted[i].id,
        'discussed_together',
        'discussed_together',
        0.55,
        'Connected because both memories were saved from the same conversation.',
        sorted[i].sourceConversationId,
      );
    }
  }

  addSharedTopicLinks(nodes, links, seen);
  addClusterConnectivityLinks(nodes, links, seen);

  const counts = new Map<string, number>();
  for (const l of links) {
    counts.set(l.source, (counts.get(l.source) ?? 0) + 1);
    counts.set(l.target, (counts.get(l.target) ?? 0) + 1);
  }
  const maxCount = Math.max(1, ...nodes.map((n) => counts.get(n.id) ?? 0));
  for (const n of nodes) {
    const count = counts.get(n.id) ?? 0;
    n.connectionCount = count;
    n.centralityScore = count / maxCount;
    n.val = clamp(n.val + Math.sqrt(count) * 0.12, 0.58, 2.35);
  }

  const active = MEMORY_VISUAL_CATEGORIES.filter((c) => nodes.some((n) => n.category === c));
  const radius = graphRadiusFor(nodes.length);
  const layout: GraphLayout = { radius, clusterCenters: clusterCentersFor(active, radius) };
  assignPositions(nodes, layout);

  return { nodes, links, layout };
}

const MAX_TOPIC_LINKS_PER_NODE = 3;
// A word carried by more nodes than this is too generic to pair on — pairing it
// would create exactly the keyword hubs the graph must never invent.
const TOPIC_HUB_LIMIT = 6;
const TOPIC_GENERIC_RATIO = 0.4;

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Weak contextual bridges grounded in the memory texts themselves: two
 *  memories link only when they share a meaningful, corpus-rare word. Rarer
 *  overlaps score higher; each node gets at most a few such links, and pairs
 *  already connected by a stronger relationship are skipped. */
function addSharedTopicLinks(nodes: GraphNode[], links: GraphLink[], seen: Set<string>): void {
  if (nodes.length < 2) return;
  const linkedPairs = new Set(links.map((l) => pairKey(l.source, l.target)));
  const carriers = new Map<string, GraphNode[]>();
  for (const n of nodes) {
    for (const w of n.semanticKeywords) {
      const list = carriers.get(w) ?? [];
      list.push(n);
      carriers.set(w, list);
    }
  }

  interface Candidate { a: GraphNode; b: GraphNode; score: number; words: string[] }
  const byPair = new Map<string, Candidate>();
  for (const [word, carrying] of carriers) {
    if (carrying.length < 2 || carrying.length > TOPIC_HUB_LIMIT) continue;
    if (nodes.length >= 5 && carrying.length / nodes.length > TOPIC_GENERIC_RATIO) continue;
    const weight = 1 / (carrying.length - 1);
    for (let i = 0; i < carrying.length; i += 1) {
      for (let j = i + 1; j < carrying.length; j += 1) {
        const key = pairKey(carrying[i].id, carrying[j].id);
        if (linkedPairs.has(key)) continue;
        const cand = byPair.get(key) ?? { a: carrying[i], b: carrying[j], score: 0, words: [] };
        cand.score += weight;
        cand.words.push(word);
        byPair.set(key, cand);
      }
    }
  }

  const degree = new Map<string, number>();
  const ranked = [...byPair.values()].sort((x, y) => y.score - x.score);
  for (const cand of ranked) {
    if ((degree.get(cand.a.id) ?? 0) >= MAX_TOPIC_LINKS_PER_NODE) continue;
    if ((degree.get(cand.b.id) ?? 0) >= MAX_TOPIC_LINKS_PER_NODE) continue;
    const words = cand.words
      .slice(0, 2)
      .map((w) => `"${w.replace(/_/g, ' ')}"`)
      .join(' and ');
    addLink(
      links,
      seen,
      cand.a.id,
      cand.b.id,
      'shared_topic',
      'shared_topic',
      clamp(0.26 + cand.score * 0.18, 0.26, 0.5),
      `Connected because both memories mention ${words}.`,
      `Shared topic: ${cand.words.join(', ')}`,
    );
    degree.set(cand.a.id, (degree.get(cand.a.id) ?? 0) + 1);
    degree.set(cand.b.id, (degree.get(cand.b.id) ?? 0) + 1);
  }
}

class UnionFind {
  private parent = new Map<string, string>();

  find(id: string): string {
    let root = this.parent.get(id) ?? id;
    while (root !== (this.parent.get(root) ?? root)) root = this.parent.get(root) ?? root;
    let cur = id;
    while (cur !== root) {
      const next = this.parent.get(cur) ?? cur;
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }

  union(a: string, b: string): boolean {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return false;
    this.parent.set(ra, rb);
    return true;
  }
}

const CLUSTER_TIME_WINDOW_MS = 48 * 60 * 60 * 1000;

function sharedKeywords(a: GraphNode, b: GraphNode): string[] {
  const set = new Set(a.semanticKeywords);
  return b.semanticKeywords.filter((w) => set.has(w));
}

/** A category cluster must read as one visible group, so it must be one
 *  connected component. This adds the minimal set of spanning links per
 *  category — Kruskal over pairs ranked by keyword overlap, then time
 *  proximity — on top of whatever explicit/conversation/topic links already
 *  connect it. Grounded and explainable: same category, and the strongest
 *  shared signal names itself in the explanation. */
function addClusterConnectivityLinks(nodes: GraphNode[], links: GraphLink[], seen: Set<string>): void {
  const byCategory = new Map<MemoryVisualCategory, GraphNode[]>();
  for (const n of nodes) {
    const group = byCategory.get(n.category) ?? [];
    group.push(n);
    byCategory.set(n.category, group);
  }

  const nodeCategory = new Map(nodes.map((n) => [n.id, n.category]));
  for (const [category, group] of byCategory) {
    if (group.length < 2) continue;
    const uf = new UnionFind();
    for (const l of links) {
      if (nodeCategory.get(l.source) === category && nodeCategory.get(l.target) === category) {
        uf.union(l.source, l.target);
      }
    }

    interface Candidate { a: GraphNode; b: GraphNode; shared: string[]; gap: number; key: string }
    const candidates: Candidate[] = [];
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const a = group[i];
        const b = group[j];
        candidates.push({
          a,
          b,
          shared: sharedKeywords(a, b),
          gap: Math.abs((a.createdAt || 0) - (b.createdAt || 0)),
          key: pairKey(a.id, b.id),
        });
      }
    }
    candidates.sort((x, y) => y.shared.length - x.shared.length || x.gap - y.gap || (x.key < y.key ? -1 : 1));

    for (const cand of candidates) {
      if (!uf.union(cand.a.id, cand.b.id)) continue;
      const word = cand.shared[0];
      const closeInTime = cand.gap > 0 && cand.gap < CLUSTER_TIME_WINDOW_MS;
      const label = VISUAL_CATEGORY_LABELS[category];
      const explanation = word
        ? `Connected because both are part of your ${label} cluster and mention "${word.replace(/_/g, ' ')}".`
        : closeInTime
          ? `Connected because both are part of your ${label} cluster and were saved around the same time.`
          : `Connected because both are part of your ${label} cluster.`;
      addLink(
        links,
        seen,
        cand.a.id,
        cand.b.id,
        'same_cluster',
        'same_cluster',
        clamp(0.3 + cand.shared.length * 0.05, 0.3, 0.45),
        explanation,
        `Cluster: ${label}${word ? ` - shared: ${cand.shared.slice(0, 3).join(', ')}` : ''}`,
      );
    }
  }
}
