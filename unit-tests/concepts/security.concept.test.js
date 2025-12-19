import { describe, test, assert, beforeEach } from '../test-utils.js';
import { securityConcept } from '../../src/concepts/securityConcept.js';

describe('Security Concept', () => {

  beforeEach(() => {
    // Reset state before each test
    securityConcept.state.decryptedToken = null;
  });

  const password = 'test-password';
  const token = 'test-token-123';

  test('[UNIT] encryptToken: Should produce a valid ciphertext, salt, and IV', async () => {
    const encrypted = await securityConcept.actions.encryptToken(token, password);

    assert.isNotNull(encrypted, 'Encrypted bundle should not be null');
    assert.instanceOf(encrypted.ciphertext, ArrayBuffer, 'Ciphertext should be an ArrayBuffer');
    assert.instanceOf(encrypted.salt, Uint8Array, 'Salt should be a Uint8Array');
    assert.instanceOf(encrypted.iv, Uint8Array, 'IV should be a Uint8Array');
    assert.isAbove(encrypted.ciphertext.byteLength, 0, 'Ciphertext should not be empty');
  });

  test('[UNIT] decryptToken: Should correctly decrypt a token given the correct password', async () => {
    const encrypted = await securityConcept.actions.encryptToken(token, password);
    const decrypted = await securityConcept.actions.decryptToken(encrypted, password);

    assert.strictEqual(decrypted, token, 'Decrypted token should match the original');
    assert.strictEqual(securityConcept.state.decryptedToken, token, 'Decrypted token should be stored in state');
  });

  test('[UNIT] decryptToken Failure: Should throw an error when given an incorrect password', async () => {
    const encrypted = await securityConcept.actions.encryptToken(token, password);
    let didThrow = false;

    try {
      await securityConcept.actions.decryptToken(encrypted, 'wrong-password');
    } catch (error) {
      didThrow = true;
      assert.include(error.message, 'Decryption failed', 'Error message should indicate failure');
    }

    assert.isTrue(didThrow, 'An error should have been thrown for incorrect password');
    assert.isNull(securityConcept.state.decryptedToken, 'State should remain null after a failed decryption');
  });

  test('[UNIT] clearDecryptedToken: Should set the in-memory decryptedToken state to null', async () => {
    // First, set the state to a decrypted value
    const encrypted = await securityConcept.actions.encryptToken(token, password);
    await securityConcept.actions.decryptToken(encrypted, password);
    assert.strictEqual(securityConcept.state.decryptedToken, token, 'Pre-condition: token should be in state');

    // Now, clear it
    securityConcept.actions.clearDecryptedToken();

    assert.isNull(securityConcept.state.decryptedToken, 'decryptedToken should be null after clearing');
  });

});