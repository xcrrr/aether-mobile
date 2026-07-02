import type { Beat } from '@/components/phone/useTypewriter';

/**
 * The demo conversation. Every claim here must stay implementation-backed:
 * on-device inference (LiteRT), Core memory stored locally and editable,
 * Research as the optional online mode. No absolutes, no theatrics.
 */
export const conversation: Beat[] = [
  {
    role: 'user',
    text: 'No signal up here. Can you still help me think this through?',
    caption: 'The model lives on the phone. Once it’s installed, a conversation doesn’t need a connection.',
  },
  {
    role: 'assistant',
    text: 'Yes — I’m running on your phone right now, not on a server. Walk me through it and we’ll work it out here.',
    caption: 'No round trip, no queue. Answers come from the device in your hand.',
  },
  {
    role: 'user',
    text: 'Remember that the cabin gate code is 4182.',
    caption: 'Core is Aether’s memory. What it keeps is stored on the phone — open it any time to read, edit, or delete.',
  },
  {
    role: 'assistant',
    text: 'Saved to your Core. I’ll remember it next time — it stays on this phone, in a memory you can open and edit yourself.',
    caption: 'Memory you can inspect beats memory you have to trust.',
  },
  {
    role: 'user',
    text: 'When I’m back online, can you look up the trail conditions for tomorrow?',
    caption: 'Research is the optional part that uses the web. You turn it on; answers come back with sources.',
  },
  {
    role: 'assistant',
    text: 'Sure. With Research on I’ll search the web and answer with sources. That’s the one part of me that goes online — and it only runs when you ask.',
    caption: 'Online is a choice, not a default. That’s the whole idea.',
  },
];
