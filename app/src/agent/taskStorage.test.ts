import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  saveTask, loadTask, markInterruptedTasks, saveArtifact, loadArtifacts, deleteArtifact,
} from './taskStorage';
import { AgentArtifact, AgentTask, TaskStatus } from './types';

function task(id: string, status: TaskStatus): AgentTask {
  return {
    id, conversationId: 'c1', goal: 'g', mode: 'balanced', modelId: null,
    status, startedAt: 1, endedAt: status === 'running' ? null : 2,
    steps: [], sources: [], artifacts: [], finalAnswer: '',
  };
}

const artifact = (id: string): AgentArtifact => ({
  id, taskId: 't1', title: `A${id}`, content: 'body', createdAt: 1, saved: false,
});

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('taskStorage', () => {
  it('round-trips a task', async () => {
    await saveTask(task('t1', 'done'));
    const loaded = await loadTask('t1');
    expect(loaded?.id).toBe('t1');
    expect(loaded?.status).toBe('done');
  });

  it('returns null for unknown tasks and corrupt payloads', async () => {
    expect(await loadTask('nope')).toBeNull();
    await AsyncStorage.setItem('@aether/agent-task/bad', '{corrupt');
    expect(await loadTask('bad')).toBeNull();
  });

  it('marks live tasks interrupted, leaves terminal ones alone', async () => {
    await saveTask(task('live', 'running'));
    await saveTask(task('waiting', 'awaiting_approval'));
    await saveTask(task('finished', 'done'));
    const marked = await markInterruptedTasks();
    expect(marked).toBe(2);
    expect((await loadTask('live'))?.status).toBe('interrupted');
    expect((await loadTask('waiting'))?.status).toBe('interrupted');
    expect((await loadTask('finished'))?.status).toBe('done');
    expect((await loadTask('live'))?.endedAt).not.toBeNull();
  });

  it('bounds the task index and evicts old task records', async () => {
    for (let i = 0; i < 25; i++) await saveTask(task(`t${i}`, 'done'));
    expect(await loadTask('t0')).toBeNull();
    expect(await loadTask('t24')).not.toBeNull();
  });

  it('saves artifacts idempotently and marks them saved', async () => {
    await saveArtifact(artifact('a1'));
    await saveArtifact(artifact('a1'));
    const all = await loadArtifacts();
    expect(all).toHaveLength(1);
    expect(all[0].saved).toBe(true);
  });

  it('deletes artifacts', async () => {
    await saveArtifact(artifact('a1'));
    await saveArtifact(artifact('a2'));
    await deleteArtifact('a1');
    expect((await loadArtifacts()).map((a) => a.id)).toEqual(['a2']);
  });
});
