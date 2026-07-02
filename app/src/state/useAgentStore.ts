import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AgentKernel } from '@/agent/AgentKernel';
import { AgentMode, AgentTask } from '@/agent/types';

/**
 * UI-facing agent state. The selected autonomy mode is the only persisted
 * field; everything else is transient run state. The kernel never reads this
 * store — mode is passed into the task context at start, so nothing the model
 * or a tool does mid-task can change it.
 *
 * The UI exposes two behaviors: the default ('balanced' — Aether handles
 * steps, artifacts stay drafts until Keep) and "Ask first" ('strict' — every
 * data/write step needs approval). 'auto' is retained in the type only so old
 * persisted task records stay readable; it is no longer selectable and the
 * migration coerces a persisted 'auto' back to the default.
 */

export interface PendingApproval {
  tool: string;
  argsSummary: string;
  risk: string;
  resolve: (approved: boolean) => void;
}

export interface PendingQuestion {
  question: string;
  options: string[];
  resolve: (option: string | null) => void;
}

interface AgentUIState {
  mode: AgentMode;
  liveTask: AgentTask | null;
  liveKernel: AgentKernel | null;
  progress: string;
  approval: PendingApproval | null;
  question: PendingQuestion | null;

  setMode: (mode: AgentMode) => void;
  beginRun: (kernel: AgentKernel) => void;
  setLiveTask: (task: AgentTask) => void;
  setProgress: (progress: string) => void;
  requestApproval: (req: Omit<PendingApproval, 'resolve'>) => Promise<boolean>;
  resolveApproval: (approved: boolean) => void;
  requestQuestion: (q: Omit<PendingQuestion, 'resolve'>) => Promise<string | null>;
  resolveQuestion: (option: string | null) => void;
  /** Stop the live task now: kernel flag, engine stop, pending prompts resolved safely. */
  cancelLive: () => void;
  endRun: () => void;
  resetLocalState: () => void;
}

export const useAgentStore = create<AgentUIState>()(
  persist(
    (set, get) => ({
      mode: 'balanced',
      liveTask: null,
      liveKernel: null,
      progress: '',
      approval: null,
      question: null,

      setMode: (mode) => set({ mode }),
      beginRun: (kernel) => set({ liveKernel: kernel, liveTask: null, progress: '', approval: null, question: null }),
      setLiveTask: (task) => set({ liveTask: { ...task, steps: [...task.steps] } }),
      setProgress: (progress) => set({ progress }),

      requestApproval: (req) =>
        new Promise<boolean>((resolve) => set({ approval: { ...req, resolve } })),
      resolveApproval: (approved) => {
        const a = get().approval;
        set({ approval: null });
        a?.resolve(approved);
      },

      requestQuestion: (q) =>
        new Promise<string | null>((resolve) => set({ question: { ...q, resolve } })),
      resolveQuestion: (option) => {
        const q = get().question;
        set({ question: null });
        q?.resolve(option);
      },

      cancelLive: () => {
        const { liveKernel, approval, question } = get();
        liveKernel?.cancel();
        try {
          const Llama = require('@/llm/engine') as typeof import('@/llm/engine');
          Llama.stop();
        } catch {}
        set({ approval: null, question: null });
        approval?.resolve(false);
        question?.resolve(null);
      },

      endRun: () => set({ liveKernel: null, liveTask: null, progress: '', approval: null, question: null }),
      resetLocalState: () => set({
        mode: 'balanced',
        liveKernel: null,
        liveTask: null,
        progress: '',
        approval: null,
        question: null,
      }),
    }),
    {
      name: '@aether/agent-mode',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ mode: s.mode }),
      version: 1,
      migrate: (persisted) => {
        const s = persisted as { mode?: AgentMode };
        if (s?.mode === 'auto') s.mode = 'balanced';
        return s as AgentUIState;
      },
    },
  ),
);
