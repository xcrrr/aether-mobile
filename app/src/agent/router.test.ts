import { routeGoal } from './router';

const withPrior = { hasPriorArtifact: true };
const noPrior = { hasPriorArtifact: false };

describe('routeGoal — chat stays chat', () => {
  it.each([
    'hi',
    'hey there',
    'thanks!',
    'ok cool',
    'how are you?',
    'good morning',
  ])('smalltalk "%s" routes to chat', (g) => {
    expect(routeGoal(g, noPrior)).toBe('chat');
  });

  it('short knowledge questions route to chat', () => {
    expect(routeGoal('what is a binary tree?', noPrior)).toBe('chat');
    expect(routeGoal('who wrote Dune?', noPrior)).toBe('chat');
  });

  it('empty input routes to chat', () => {
    expect(routeGoal('   ', noPrior)).toBe('chat');
  });

  it('current-information questions are NOT chat — they need research', () => {
    expect(routeGoal('what are the latest AI trends?', noPrior)).toBe('task');
    expect(routeGoal("what's the news today?", noPrior)).toBe('task');
  });

  it('deliverable requests phrased as questions are tasks', () => {
    expect(routeGoal('can you make me a plan?', noPrior)).toBe('task');
    expect(routeGoal('could you write a checklist?', noPrior)).toBe('task');
  });

  it('long questions default to task', () => {
    expect(
      routeGoal('what should I consider when choosing between these two frameworks for my app?', noPrior),
    ).toBe('task');
  });
});

describe('routeGoal — refinement targets the existing draft', () => {
  it.each([
    'make it shorter',
    'make that more concrete',
    'shorten the intro',
    'add risks',
    'add a timeline section',
    'remove the last section',
    'rewrite it in plain language',
    'turn that into a coding brief',
    'update the checklist with deadlines',
    'tweak the tone',
    'Please make it shorter',
  ])('"%s" routes to refine when a draft exists', (g) => {
    expect(routeGoal(g, withPrior)).toBe('refine');
  });

  it('refinement phrasing without a prior artifact is a task', () => {
    expect(routeGoal('make it shorter', noPrior)).toBe('task');
    expect(routeGoal('add risks', noPrior)).toBe('task');
  });

  it('a long fresh spec is a new task even when a draft exists', () => {
    const longGoal =
      'make a completely new research report about the current state of on-device inference, ' +
      'covering hardware trends, quantization, popular runtimes, model families, benchmark results, ' +
      'and what it means for local-first assistant apps over the next two years';
    expect(routeGoal(longGoal, withPrior)).toBe('task');
  });
});

describe('routeGoal — substantial goals are tasks', () => {
  it.each([
    'Research current local AI trends and make a beta roadmap for Aether',
    'create a study plan from the attached PDF',
    'plan my week around the marathon training',
    'summarize the attached document into structured notes',
  ])('"%s" routes to task', (g) => {
    expect(routeGoal(g, noPrior)).toBe('task');
  });
});
