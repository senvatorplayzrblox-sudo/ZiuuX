import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileMatcher, normalizeText, type BlockedTerm } from '../../src/ai/blockedWords.js';

const T = (term: string, matchMode: 'word' | 'contains' = 'word'): BlockedTerm => ({ term, normalized: normalizeText(term), matchMode });

test('word mode matches whole tokens only', () => {
  const m = compileMatcher([T('ass')]);
  assert.ok(m.find('you are an ass!'));
  assert.equal(m.find('a classic assassin passes'), null);
});
test('contains mode matches substrings', () => {
  assert.ok(compileMatcher([T('foo', 'contains')]).find('xxFOOxx'));
});
test('phrases match consecutive tokens, case/diacritics/zero-width insensitive', () => {
  const m = compileMatcher([T('bad phrase')]);
  assert.ok(m.find('This is a BAD   phrase, really'));
  assert.ok(m.find('b\u200bad phr\u00e4se'.replace('\u00e4', 'a')));
  assert.equal(m.find('bad then phrase'), null);
});
test('terms with regex metacharacters are treated literally (no ReDoS surface)', () => {
  const m = compileMatcher([T('(a+)+$', 'contains')]);
  assert.equal(m.find('aaaaaaaaaaaaaaaaaaaaaaaaaaaa!'), null);
  assert.ok(m.find('x (a+)+$ y'));
});
test('empty matcher / empty text', () => {
  assert.equal(compileMatcher([]).find('anything'), null);
  assert.equal(compileMatcher([T('x')]).find('   '), null);
});
