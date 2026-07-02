import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeParse } from '@/storage/json';
import { AgentArtifact, AgentTask } from './types';

/**
 * Local persistence for agent tasks and kept artifacts. Everything stays in
 * AsyncStorage on-device; nothing here talks to the network. Task records are
 * the audit trail behind receipts and the recovery source after process death.
 */

const TASK_INDEX_KEY = '@aether/agent-tasks-index';
const taskKey = (id: string) => `@aether/agent-task/${id}`;
const ARTIFACTS_KEY = '@aether/agent-artifacts';

/** Keep the on-device audit trail bounded. */
const MAX_TASKS = 20;
const MAX_ARTIFACTS = 50;

const TERMINAL = new Set(['done', 'failed', 'cancelled', 'interrupted']);

async function loadIndex(): Promise<string[]> {
  return safeParse<string[]>(await AsyncStorage.getItem(TASK_INDEX_KEY), []);
}

export async function saveTask(task: AgentTask): Promise<void> {
  await AsyncStorage.setItem(taskKey(task.id), JSON.stringify(task));
  const index = await loadIndex();
  if (!index.includes(task.id)) {
    index.unshift(task.id);
    const evicted = index.slice(MAX_TASKS);
    await AsyncStorage.setItem(TASK_INDEX_KEY, JSON.stringify(index.slice(0, MAX_TASKS)));
    for (const id of evicted) await AsyncStorage.removeItem(taskKey(id));
  }
}

export async function loadTask(id: string): Promise<AgentTask | null> {
  return safeParse<AgentTask | null>(await AsyncStorage.getItem(taskKey(id)), null);
}

/**
 * Crash honesty: any task still recorded as live was killed with the app —
 * Android does not let it keep running. Mark it interrupted so its receipt
 * never claims completion. Call once on startup, before any new task runs.
 */
export async function markInterruptedTasks(): Promise<number> {
  const index = await loadIndex();
  let marked = 0;
  for (const id of index) {
    const task = await loadTask(id);
    if (task && !TERMINAL.has(task.status)) {
      task.status = 'interrupted';
      task.endedAt = task.endedAt ?? Date.now();
      await AsyncStorage.setItem(taskKey(id), JSON.stringify(task));
      marked++;
    }
  }
  return marked;
}

export async function loadArtifacts(): Promise<AgentArtifact[]> {
  return safeParse<AgentArtifact[]>(await AsyncStorage.getItem(ARTIFACTS_KEY), []);
}

/** Persist a kept artifact into the workspace list (idempotent by id). */
export async function saveArtifact(artifact: AgentArtifact): Promise<void> {
  const all = await loadArtifacts();
  const next = [{ ...artifact, saved: true }, ...all.filter((a) => a.id !== artifact.id)];
  await AsyncStorage.setItem(ARTIFACTS_KEY, JSON.stringify(next.slice(0, MAX_ARTIFACTS)));
}

export async function deleteArtifact(id: string): Promise<void> {
  const all = await loadArtifacts();
  await AsyncStorage.setItem(ARTIFACTS_KEY, JSON.stringify(all.filter((a) => a.id !== id)));
}
