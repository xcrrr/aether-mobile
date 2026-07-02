import { clampChars } from '@/webresearch/safety';
import { ToolExecutor } from './ToolRegistry';

/**
 * Real executors for the V1 tool set. Each wraps an existing, already-hardened
 * Aether capability — research (safety.ts pipeline), Core recall
 * (deterministic token overlap), attachment text (user-picked files, text
 * pre-extracted). Nothing here opens new data access: an executor can only
 * reach what the chat features could already reach, inside the task's fixed
 * TaskContext.
 */

const ATTACHMENT_CHARS = 2500;

export function createExecutors(): Record<string, ToolExecutor> {
  return {
    web_research: async (args, _ctx, onProgress) => {
      const { runResearch } = require('@/webresearch/ResearchEngine') as typeof import('@/webresearch/ResearchEngine');
      const result = await runResearch(args.query, onProgress, []);
      if (!result.sources.length) {
        return { ok: false, summary: 'no usable sources found', detail: '' };
      }
      return {
        ok: true,
        summary: `read ${result.sources.length} source(s) for "${clampChars(args.query, 60)}"`,
        detail: `Web research on "${args.query}" found:\n${result.answer}`,
        sources: result.sources.map((s) => ({ title: s.title || s.url, url: s.url })),
      };
    },

    read_core: async (args, ctx) => {
      const { MemoryStore } = require('@/secondbrain/MemoryStore') as typeof import('@/secondbrain/MemoryStore');
      const { selectRecall } = require('@/secondbrain/recall') as typeof import('@/secondbrain/recall');
      const recall = selectRecall(
        [{ id: 'agent-recall', role: 'user', content: args.topic, createdAt: Date.now() }],
        {
          entries: MemoryStore.getAllEntries(),
          enabled: MemoryStore.isEnabled(),
          activeModelId: ctx.modelId,
        },
      );
      if (!recall.topical.length) {
        return { ok: true, summary: `no Core notes matched "${clampChars(args.topic, 60)}"`, detail: 'No saved notes matched that topic.' };
      }
      const lines = recall.topical.map((t) => `${t.entry.key.replace(/_/g, ' ')}: ${t.entry.value}`);
      return {
        ok: true,
        summary: `found ${recall.topical.length} Core note(s): ${recall.topical.map((t) => t.entry.key.replace(/_/g, ' ')).join(', ')}`,
        detail: `Core notes about "${args.topic}":\n${lines.join('\n')}`,
      };
    },

    read_attachments: async (_args, ctx) => {
      if (!ctx.attachments.length) {
        return { ok: false, summary: 'no attachments in this conversation', detail: '' };
      }
      const blocks = ctx.attachments.map(
        (a) => `Document "${a.name}":\n${clampChars(a.text, ATTACHMENT_CHARS)}`,
      );
      return {
        ok: true,
        summary: `read ${ctx.attachments.length} attached document(s): ${ctx.attachments.map((a) => a.name).join(', ')}`,
        detail: blocks.join('\n\n'),
      };
    },
  };
}
