import { groundingScore, normalizeForGrounding } from './grounding';

describe('normalizeForGrounding', () => {
  it('lowercases, strips punctuation, collapses whitespace', () => {
    expect(normalizeForGrounding("  I LOVE   climbing!! ")).toBe('i love climbing');
  });
  it('drops apostrophes so contractions still match', () => {
    expect(normalizeForGrounding("I don't like mornings")).toBe('i dont like mornings');
  });
});

describe('groundingScore', () => {
  const userText = 'hi\nI run a barber shop called Mitruk here in Warsaw and I want to grow it on Instagram';

  it('returns 1 for a verbatim quote', () => {
    expect(groundingScore('I run a barber shop called Mitruk', userText)).toBe(1);
  });
  it('is tolerant of case and punctuation differences', () => {
    expect(groundingScore('i run a BARBER shop, called Mitruk!', userText)).toBe(1);
  });
  it('rejects reordered words that are not a verbatim user quote', () => {
    expect(groundingScore('grow the barber shop on Instagram', userText)).toBe(0);
  });
  it('rejects text the user never said', () => {
    expect(groundingScore('I am a professional astronaut', userText)).toBe(0);
  });
  it('rejects quotes too short to be evidence', () => {
    expect(groundingScore('Warsaw', userText)).toBe(0);
    expect(groundingScore('', userText)).toBe(0);
  });
  it('rejects when user text is empty', () => {
    expect(groundingScore('I love climbing every week', '')).toBe(0);
  });
  it('does not assemble evidence from separate statements', () => {
    const separateStatements = 'My sister lives in Paris.\nI live in Warsaw.';
    expect(groundingScore('I live in Paris', separateStatements)).toBe(0);
  });
});
