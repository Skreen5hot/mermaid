/**
 * DOM Concept Tests
 * Unit tests for DOM concept pure functions.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { validateSelector, snapshotElement, isElementInteractable } from '../src/concepts/domConcept.js';
import { SelectorError } from '../src/errors/index.js';

test('validateSelector accepts valid CSS selectors', () => {
  assert.doesNotThrow(() => validateSelector('#id'));
  assert.doesNotThrow(() => validateSelector('.class'));
  assert.doesNotThrow(() => validateSelector('div > p'));
  assert.doesNotThrow(() => validateSelector('[data-test="value"]'));
});

test('validateSelector throws on empty selector', () => {
  assert.throws(() => {
    validateSelector('');
  }, SelectorError);
});

test('validateSelector throws on shadow DOM selectors', () => {
  assert.throws(() => {
    validateSelector('div >> .shadow');
  }, SelectorError);
});

test('snapshotElement creates correct snapshot', () => {
  const elementData = {
    nodeName: 'BUTTON',
    textContent: '  Click me  ',
    visible: true,
    attributes: { class: 'btn-primary', id: 'submit' }
  };

  const snapshot = snapshotElement(elementData);

  assert.strictEqual(snapshot.tag, 'button');
  assert.strictEqual(snapshot.text, 'Click me');
  assert.strictEqual(snapshot.visible, true);
  assert.deepStrictEqual(snapshot.attributes, { class: 'btn-primary', id: 'submit' });
});

test('isElementInteractable returns false for hidden element', () => {
  assert.strictEqual(isElementInteractable({ visible: false }), false);
});

test('isElementInteractable returns false for disabled element', () => {
  assert.strictEqual(isElementInteractable({ visible: true, disabled: true }), false);
});

test('isElementInteractable returns false for zero opacity', () => {
  assert.strictEqual(isElementInteractable({ visible: true, opacity: 0 }), false);
});

test('isElementInteractable returns true for normal element', () => {
  assert.strictEqual(isElementInteractable({ visible: true, disabled: false }), true);
});

// TODO: Add integration tests for DOM actions
