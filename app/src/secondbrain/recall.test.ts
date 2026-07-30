import {
  selectRecall,
  recallPolicy,
  distinctiveTokens,
  recallDisclosureItems,
  RecallInput,
  EMPTY_RECALL,
} from './recall';
import { MemoryEntry, MemoryCategory } from './types';
import { Message } from '@/types';

let n = 0;
function entry(p: Partial<MemoryEntry> & { category: MemoryCategory; key: string; value: string }): MemoryEntry {
  n += 1;
  return {
    id: `id-${n}`,
    confidence: 0.8,
    sourceConversationId: 'c1',
    createdAt: 0,
    updatedAt: 0,
    timesReinforced: 0,
    lastSeenAt: 1000,
    ...p,
  };
}

function user(content: string): Message {
  n += 1;
  return { id: `m-${n}`, role: 'user', content, createdAt: n };
}
function assistant(content: string): Message {
  n += 1;
  return { id: `m-${n}`, role: 'assistant', content, createdAt: n };
}

const aether = () => entry({ category: 'context', key: 'aether_project', value: 'Building Aether, a local-first Android assistant' });
const blackHoles = () => entry({ category: 'preferences', key: 'space_interest', value: 'Fascinated by black holes and astrophysics' });
const marathon = () => entry({ category: 'goals', key: 'marathon_goal', value: 'Training for a marathon in October' });

const input = (entries: MemoryEntry[], over: Partial<RecallInput> = {}): RecallInput => ({
  entries, enabled: true, activeModelId: 'gemma4-e4b', ...over,
});

describe('distinctiveTokens', () => {
  it('drops stopwords, generic words, short tokens, and numbers', () => {
    expect(distinctiveTokens('I need help with my project')).toEqual([]);
    expect(distinctiveTokens('Hi')).toEqual([]);
    expect(distinctiveTokens('thanks, that was good')).toEqual(['thank']);
  });
  it('keeps real content words', () => {
    expect(distinctiveTokens('explain how black holes evaporate')).toEqual(['explain', 'black', 'hole', 'evaporate']);
  });
});

describe('selectRecall — restraint (brief cases 1, 4, 6, 19)', () => {
  it('a generic greeting retrieves no topical memories, even with a full store', () => {
    const r = selectRecall([user('Hi')], input([aether(), blackHoles(), marathon()]));
    expect(r.topical).toEqual([]);
  });

  it('an unrelated topic shift never drags project memories in', () => {
    const r = selectRecall(
      [user('I want to build an app'), assistant('ok'), user('Explain how black holes evaporate')],
      input([aether(), marathon(), blackHoles()]),
    );
    expect(r.topical.map((t) => t.entry.key)).toEqual(['space_interest']);
  });

  it('generic-word overlap alone can never select a memory', () => {
    const r = selectRecall([user('I need help with my project plan for work')], input([aether(), marathon()]));
    expect(r.topical).toEqual([]);
  });
});

describe('selectRecall — relevance (brief cases 3, 15)', () => {
  it('an explicit project question retrieves the project memory with an explainable reason', () => {
    const r = selectRecall([user('What should I work on next for Aether?')], input([aether(), blackHoles()]));
    expect(r.topical).toHaveLength(1);
    expect(r.topical[0].entry.key).toBe('aether_project');
    expect(r.topical[0].why).toContain('aether');
  });

  it('previous-turn echoes boost ranking but the current message decides', () => {
    const boosted = entry({ category: 'context', key: 'aether_launch', value: 'Aether beta launch on Android', confidence: 0.7 });
    const other = entry({ category: 'context', key: 'aether_logo', value: 'Aether logo redesign', confidence: 0.9 });
    const msgs = [user('The Android beta is close'), assistant('nice'), user('What is left for the aether launch?')];
    const r = selectRecall(msgs, input([other, boosted]));
    // Both match "aether" now, but the previous turn's "android"+"beta" lift the launch note first
    // despite its lower confidence.
    expect(r.topical[0].entry.key).toBe('aether_launch');
  });

  it('a half-weight echo from the previous turn is not enough on its own (case 14)', () => {
    const msgs = [user('I am training for a marathon'), assistant('nice'), user('Give me a pasta recipe')];
    const r = selectRecall(msgs, input([marathon()]));
    expect(r.topical).toEqual([]);
  });
});

describe('selectRecall — continuation (brief cases 2, 18)', () => {
  it('an explicit "continue" in a NEW chat admits the most recent context/goals', () => {
    const recent = entry({ category: 'context', key: 'reading_topic', value: 'Reading about event horizons', lastSeenAt: 900 });
    const r = selectRecall([user('Can we continue that?')], input([recent, entry({ category: 'identity', key: 'city', value: 'Warsaw' })]));
    expect(r.topical.map((t) => t.entry.key)).toEqual(['reading_topic']);
    expect(r.topical[0].why).toContain('continue');
  });

  it('continuation admits at most 2 and skips stale entries', () => {
    const entries = [
      entry({ category: 'context', key: 'c1', value: 'alpha topic', lastSeenAt: 3 }),
      entry({ category: 'context', key: 'c2', value: 'beta topic', lastSeenAt: 2 }),
      entry({ category: 'goals', key: 'c3', value: 'gamma topic', lastSeenAt: 1 }),
      entry({ category: 'context', key: 'c4', value: 'stale topic', lastSeenAt: 99, stale: true }),
    ];
    const r = selectRecall([user('let\'s pick up where we left off')], input(entries));
    expect(r.topical.map((t) => t.entry.key)).toEqual(['c1', 'c2']);
  });

  it('in an ONGOING chat, "continue" defers to real chat history — no memory admission', () => {
    const msgs = [user('Tell me about tides'), assistant('...'), user('please continue')];
    const r = selectRecall(msgs, input([aether(), marathon()]));
    expect(r.topical).toEqual([]);
  });

  it('a new chat WITHOUT a continuation signal never volunteers recent topics', () => {
    const recent = entry({ category: 'context', key: 'reading_topic', value: 'Reading about event horizons', lastSeenAt: 900 });
    const r = selectRecall([user('Good morning!')], input([recent]));
    expect(r.topical).toEqual([]);
  });
});

describe('selectRecall — sensitive and stale context (brief cases 8, 16)', () => {
  const stress = () => entry({ category: 'emotional', key: 'work_stress', value: 'Feels stressed about deadlines' });

  it('an emotional memory needs a doubled relevance bar', () => {
    const weak = selectRecall([user('My job has deadlines sometimes')], input([stress()]));
    expect(weak.topical).toEqual([]);
    const strong = selectRecall([user('I am so stressed about my deadlines again')], input([stress()]));
    expect(strong.topical.map((t) => t.entry.key)).toEqual(['work_stress']);
  });

  it('a stale memory needs a doubled relevance bar too', () => {
    const old = entry({ category: 'goals', key: 'marathon_goal', value: 'Training for a marathon in October', stale: true });
    const weak = selectRecall([user('How long is a marathon?')], input([old]));
    expect(weak.topical).toEqual([]);
    const strong = selectRecall([user('Is my marathon still in October?')], input([old]));
    expect(strong.topical).toHaveLength(1);
  });

  it('legacy entries without evidence/reason/history are handled without special priority', () => {
    const legacy = entry({ category: 'context', key: 'aether_project', value: 'Building Aether' });
    delete (legacy as Partial<MemoryEntry>).stale;
    const r = selectRecall([user('status of aether?')], input([legacy]));
    expect(r.topical).toHaveLength(1);
  });

  it('superseded values in history never influence matching (case 5)', () => {
    const moved = entry({
      category: 'goals', key: 'marathon_goal', value: 'Marathon moved to December',
      history: [{ value: 'Marathon in October', replacedAt: 1 }],
    });
    const r = selectRecall([user('remind me about october plans')], input([moved]));
    expect(r.topical).toEqual([]); // "october" lives only in history — not a match
    const current = selectRecall([user('when is my marathon now?')], input([moved]));
    expect(current.topical[0].entry.value).toBe('Marathon moved to December');
  });

  it('a later conversation can find a terse correction by its stable subject without reviving the old value', () => {
    const corrected = entry({
      category: 'goals',
      key: 'race_schedule',
      value: 'Tuesdays',
      sourceConversationId: 'manual',
      history: [{ value: 'Race training happens on Saturdays', replacedAt: 1 }],
    });

    const laterConversation = selectRecall(
      [user('Which day is my race training?')],
      input([corrected]),
    );
    expect(laterConversation.topical.map((item) => item.entry.value)).toEqual(['Tuesdays']);
    expect(recallDisclosureItems(laterConversation)).toEqual([{
      key: 'race_schedule',
      why: expect.stringContaining('matched:'),
    }]);

    const supersededDay = selectRecall(
      [user('What do I have planned on Saturdays?')],
      input([corrected]),
    );
    expect(supersededDay.topical).toEqual([]);
  });
});

describe('selectRecall — model policies (brief cases 10, 11)', () => {
  const many = () => Array.from({ length: 10 }, (_, i) =>
    entry({ category: 'context', key: `aether_note_${i}`, value: `Aether milestone ${i} shipped`, confidence: 0.7 + i * 0.01 }));

  it('E4B caps topical recall at 6', () => {
    const r = selectRecall([user('what is left for aether?')], input(many(), { activeModelId: 'gemma4-e4b' }));
    expect(r.topical.length).toBe(6);
  });

  it('E2B stays compact: at most 3 notes', () => {
    const r = selectRecall([user('what is left for aether?')], input(many(), { activeModelId: 'gemma4-e2b' }));
    expect(r.topical.length).toBe(3);
  });

  it('an unknown model gets the conservative policy', () => {
    expect(recallPolicy(null)).toEqual(recallPolicy('gemma4-e2b'));
    expect(recallPolicy('gemma4-e4b').maxTopical).toBeGreaterThan(recallPolicy(null).maxTopical);
  });

  it('enforces the character budget so no model gets a dump', () => {
    const big = Array.from({ length: 6 }, (_, i) =>
      entry({ category: 'context', key: `aether_${i}`, value: `Aether ${'x'.repeat(280)}` }));
    const r = selectRecall([user('aether status?')], input(big, { activeModelId: 'gemma4-e4b' }));
    const chars = r.topical.reduce((s, t) => s + t.entry.key.length + t.entry.value.length, 0);
    expect(r.topical.length).toBeGreaterThan(0);
    expect(chars).toBeLessThanOrEqual(900 + 300); // first note may land the budget at most one note over
  });
});

describe('selectRecall — style tier', () => {
  it('includes at most 2 reinforced communication-style notes, ambient on any message', () => {
    const entries = [
      entry({ category: 'patterns', key: 'reply_style', value: 'prefers concise answers', timesReinforced: 3 }),
      entry({ category: 'personality', key: 'humor', value: 'dry humor', timesReinforced: 2 }),
      entry({ category: 'patterns', key: 'work_rhythm', value: 'usually codes late at night', timesReinforced: 8 }),
      entry({ category: 'personality', key: 'social_energy', value: 'describes themselves as introverted', timesReinforced: 7 }),
      entry({ category: 'personality', key: 'unconfirmed', value: 'maybe likes puns', timesReinforced: 0 }),
      entry({ category: 'patterns', key: 'stale_style', value: 'used emojis once', timesReinforced: 5, stale: true }),
      entry({ category: 'preferences', key: 'coffee', value: 'espresso', timesReinforced: 9 }),
    ];
    const r = selectRecall([user('Hi')], input(entries));
    expect(r.style.map((e) => e.key)).toEqual(['reply_style', 'humor']);
    expect(r.topical).toEqual([]);
  });

  it('discloses a style-only influence on an otherwise unrelated greeting', () => {
    const concise = entry({
      category: 'patterns', key: 'reply_style', value: 'prefers concise answers', timesReinforced: 3,
    });
    const recall = selectRecall([user('Good morning')], input([concise]));

    expect(recall.topical).toEqual([]);
    expect(recallDisclosureItems(recall)).toEqual([
      { key: 'reply_style', why: 'saved communication preference' },
    ]);
  });

  it('keeps a true no-match turn free of a Core disclosure', () => {
    const recall = selectRecall([user('Good morning')], input([aether(), marathon()]));

    expect(recallDisclosureItems(recall)).toEqual([]);
  });
});

describe('selectRecall — safety and failure (brief cases 12, 13)', () => {
  it('returns nothing when Core is disabled', () => {
    const r = selectRecall([user('what about aether?')], input([aether()], { enabled: false }));
    expect(r).toEqual(EMPTY_RECALL);
  });

  it('fails safe on malformed entries instead of throwing', () => {
    const broken = { ...aether(), key: undefined } as unknown as MemoryEntry;
    const valid = aether();
    expect(() => selectRecall([user('aether status')], input([broken]))).not.toThrow();
    expect(selectRecall([user('aether status')], input([broken]))).toEqual(EMPTY_RECALL);
    expect(selectRecall([user('aether status')], input([broken, valid])).topical)
      .toEqual([expect.objectContaining({ entry: valid })]);
  });

  it('handles an empty store and empty messages', () => {
    expect(selectRecall([], input([]))).toEqual(EMPTY_RECALL);
    expect(selectRecall([], input([aether()])).topical).toEqual([]);
  });
});

describe('selectRecall — profile route (self-context questions)', () => {
  const identity = () => entry({ category: 'identity', key: 'home_city', value: 'Lives in Warsaw' });

  it('"What do you know about me?" retrieves a cross-category summary despite zero distinctive tokens', () => {
    expect(distinctiveTokens('What do you know about me?')).toEqual([]);
    const r = selectRecall([user('What do you know about me?')], input([aether(), blackHoles(), marathon(), identity()]));
    expect(r.profileQuery).toBe(true);
    expect(r.topical.map((t) => t.entry.key).sort()).toEqual(
      ['aether_project', 'home_city', 'marathon_goal', 'space_interest'],
    );
    expect(r.topical[0].why).toBe('you asked what I know about you');
  });

  it('"Who am I?" triggers the same route', () => {
    const r = selectRecall([user('Who am I?')], input([identity(), blackHoles()]));
    expect(r.profileQuery).toBe(true);
    expect(r.topical.map((t) => t.entry.key)).toContain('home_city');
  });

  it('"Do you know who I am?" routes to profile (word order differs from "who am I")', () => {
    const r = selectRecall([user('Do you know who I am?')], input([identity(), blackHoles()]));
    expect(r.profileQuery).toBe(true);
    expect(r.topical.map((t) => t.entry.key)).toContain('home_city');
  });

  it('"Do you know me?" routes to profile', () => {
    const r = selectRecall([user('Do you know me?')], input([identity(), blackHoles()]));
    expect(r.profileQuery).toBe(true);
    expect(r.topical.map((t) => t.entry.key)).toContain('home_city');
  });

  it('"What can you tell me about me?" routes to profile', () => {
    const r = selectRecall([user('What can you tell me about me?')], input([identity(), aether()]));
    expect(r.profileQuery).toBe(true);
    expect(r.topical.map((t) => t.entry.key).sort()).toEqual(['aether_project', 'home_city']);
  });

  it('"What does Core remember about me?" routes to profile (the acceptance phrase)', () => {
    const r = selectRecall([user('What does Core remember about me?')], input([identity(), aether()]));
    expect(r.profileQuery).toBe(true);
    expect(r.topical.map((t) => t.entry.key).sort()).toEqual(['aether_project', 'home_city']);
  });

  it('"What are my interests?" retrieves only preference notes', () => {
    const r = selectRecall([user('What are my interests?')], input([aether(), blackHoles(), marathon()]));
    expect(r.profileQuery).toBe(true);
    expect(r.topical.map((t) => t.entry.key)).toEqual(['space_interest']);
  });

  it('"What are my preferences?" uses the preference facet without value-token overlap', () => {
    const r = selectRecall(
      [user('What are my preferences?')],
      input([aether(), blackHoles(), marathon()]),
    );
    expect(r.profileQuery).toBe(true);
    expect(r.topical.map((t) => t.entry.key)).toEqual(['space_interest']);
  });

  it('a multi-facet question retrieves both goals and interests without unrelated context', () => {
    const r = selectRecall(
      [user('What are my goals and interests?')],
      input([aether(), blackHoles(), marathon()]),
    );
    expect(r.profileQuery).toBe(true);
    expect(r.topical.map((t) => t.entry.key).sort()).toEqual(['marathon_goal', 'space_interest']);
  });

  it('"What projects am I working on?" hits context and goals', () => {
    const r = selectRecall([user('What projects am I working on?')], input([aether(), blackHoles(), marathon()]));
    expect(r.profileQuery).toBe(true);
    expect(r.topical.map((t) => t.entry.key).sort()).toEqual(['aether_project', 'marathon_goal']);
  });

  it('"What am I working on right now?" also hits context and goals', () => {
    const r = selectRecall([user('What am I working on right now?')], input([aether(), blackHoles(), marathon()]));
    expect(r.topical.map((t) => t.entry.key).sort()).toEqual(['aether_project', 'marathon_goal']);
  });

  it('broad summaries never volunteer emotional or stale notes', () => {
    const entries = [
      identity(),
      entry({ category: 'emotional', key: 'work_stress', value: 'Feels stressed about deadlines' }),
      entry({ category: 'preferences', key: 'old_hobby', value: 'Used to paint', stale: true }),
    ];
    const r = selectRecall([user('what do you know about me?')], input(entries));
    expect(r.topical.map((t) => t.entry.key)).toEqual(['home_city']);
  });

  it.each(['gemma4-e4b', 'gemma4-e2b'])(
    'returns twenty concise profile facts on %s instead of reusing ordinary topical caps',
    (activeModelId) => {
      const many = Array.from({ length: 20 }, (_, i) =>
        entry({ category: 'preferences', key: `pref_${i}`, value: `Enjoys hobby number ${i}` }));
      const r = selectRecall(
        [user('what do you know about me?')],
        input(many, { activeModelId }),
      );
      expect(r.topical).toHaveLength(20);
    },
  );

  it.each([
    ['gemma4-e4b', 4800],
    ['gemma4-e2b', 3000],
  ])('keeps the larger %s profile summary inside its character budget', (activeModelId, maxChars) => {
    const many = Array.from({ length: 30 }, (_, i) =>
      entry({ category: 'preferences', key: `pref_${i}`, value: `Hobby ${'x'.repeat(500)}` }));
    const r = selectRecall(
      [user('what do you know about me?')],
      input(many, { activeModelId }),
    );
    const chars = r.topical.reduce(
      (sum, item) => sum + Math.min(item.entry.key.length, 120) + Math.min(item.entry.value.length, 200),
      0,
    );
    expect(chars).toBeLessThanOrEqual(maxChars);
    expect(r.topical.length).toBeGreaterThan(6);
  });

  it('an empty store still flags the profile question so the answer can be honest', () => {
    const r = selectRecall([user('What do you know about me?')], input([]));
    expect(r.profileQuery).toBe(true);
    expect(r.topical).toEqual([]);
  });

  it('disabled Core ignores the profile question entirely', () => {
    const r = selectRecall([user('Who am I?')], input([identity()], { enabled: false }));
    expect(r).toEqual(EMPTY_RECALL);
  });

  it('ordinary unrelated questions never trigger the profile route', () => {
    const r = selectRecall([user('Give me a pasta recipe')], input([aether(), blackHoles()]));
    expect(r.profileQuery).toBeUndefined();
    expect(r.topical).toEqual([]);
  });
});

describe('selectRecall — ASK-gated self facets', () => {
  const profileEntries = () => [
    entry({ category: 'identity', key: 'occupation', value: 'Works as a product designer' }),
    entry({ category: 'identity', key: 'home_city', value: 'Lives in Warsaw' }),
    entry({ category: 'identity', key: 'spoken_languages', value: 'Speaks Polish and English' }),
    entry({ category: 'relationships', key: 'partner', value: 'Partner is Alex' }),
    entry({ category: 'knowledge', key: 'typescript_skill', value: 'Advanced with TypeScript' }),
    entry({ category: 'personality', key: 'personality_traits', value: 'Curious and persistent' }),
  ];

  it.each([
    ['What is my job?', 'occupation'],
    ['Where do I live?', 'home_city'],
    ['Which languages do I speak?', 'spoken_languages'],
    ['Who is my partner?', 'partner'],
    ['What are my skills?', 'typescript_skill'],
    ['What is my personality?', 'personality_traits'],
  ])('routes "%s" to the matching saved self facet', (question, expectedKey) => {
    const r = selectRecall([user(question)], input(profileEntries()));
    expect(r.profileQuery).toBe(true);
    expect(r.topical.map((item) => item.entry.key)).toEqual([expectedKey]);
  });

  it.each([
    'Help me improve at my job',
    'Tell me how to improve at my job',
    'What is the best way to improve at my job?',
    'What is my job application missing?',
    'Where should I live for my new job?',
    'What skills should I learn for work?',
    'Can you help with my relationship?',
    'Write a bio that sounds like my personality',
  ])('does not mistake the ordinary work request "%s" for a profile query', (request) => {
    const r = selectRecall([user(request)], input(profileEntries()));
    expect(r.profileQuery).toBeUndefined();
    expect(r.topical.every((item) => item.why !== 'you asked what I know about you')).toBe(true);
  });
});

describe('selectRecall — supporting evidence', () => {
  const terseLocation = () => entry({
    category: 'identity',
    key: 'home_city',
    value: 'Warsaw',
    evidence: 'I moved to Warsaw late last autumn',
  });

  it('can recover a terse fact from two distinctive words in its supporting quote', () => {
    const r = selectRecall(
      [user('Could moving last autumn affect my tax filing?')],
      input([terseLocation()]),
    );
    expect(r.topical.map((item) => item.entry.key)).toEqual(['home_city']);
    expect(r.topical[0].why).toContain('supporting context');
  });

  it('never recalls a fact from one incidental evidence word', () => {
    const r = selectRecall([user('Moving is exhausting')], input([terseLocation()]));
    expect(r.topical).toEqual([]);
  });
});

describe('selectRecall — performance (brief case 20)', () => {
  it('selects from 500 entries in well under a frame', () => {
    const entries = Array.from({ length: 500 }, (_, i) =>
      entry({ category: 'context', key: `note_${i}`, value: `Fact number ${i} about topic ${i % 7} and detail ${i % 11}` }));
    const start = Date.now();
    selectRecall([user('tell me about topic three and its details')], input(entries));
    expect(Date.now() - start).toBeLessThan(100);
  });
});
