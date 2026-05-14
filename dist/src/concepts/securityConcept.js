/**
 * @module securityConcept
 * @description Manages all cryptographic operations for token encryption and decryption.
 * This concept adapts the security model from the GitConnect PWA, using native
 * window.crypto for PBKDF2 key derivation and AES-GCM encryption.
 * It follows the "Concepts and Synchronizations" architecture.
 */

const subscribers = new Set();

/**
 * Notifies all subscribed listeners of an event.
 * @param {string} event - The name of the event.
 * @param {*} payload - The data associated with the event.
 */
function notify(event, payload) {
  for (const subscriber of subscribers) {
    subscriber(event, payload);
  }
}

// --- Pure(ish) Cryptographic Functions ---

/**
 * Derives a cryptographic key from a password and salt using PBKDF2.
 * @param {string} password - The user's master password.
 * @param {Uint8Array} salt - A random salt.
 * @returns {Promise<CryptoKey>} The derived key for AES-GCM.
 */
async function _deriveKey(password, salt) {
  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export const securityConcept = {
  state: {
    /** @type {string | null} */
    decryptedToken: null,
    sessionPassword: null,
  },

  actions: {
    /**
     * Encrypts a plaintext token using a password.
     * Generates a new salt and IV for each encryption.
     * @param {string} plaintextToken - The token to encrypt.
     * @param {string} password - The master password.
     * @returns {Promise<{ciphertext: ArrayBuffer, salt: Uint8Array, iv: Uint8Array}>} The encrypted data.
     */
    async encryptToken(plaintextToken, password) {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await _deriveKey(password, salt);

      const encoder = new TextEncoder();
      const encodedToken = encoder.encode(plaintextToken);

      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encodedToken
      );

      const result = { ciphertext, salt, iv };
      notify('tokenEncrypted', result);
      return result;
    },

    /**
     * Decrypts a token using the master password and stored crypto data.
     * Stores the decrypted token in the concept's state for the session.
     * @param {{ciphertext: ArrayBuffer, salt: Uint8Array, iv: Uint8Array}} encryptedData - The encrypted bundle.
     * @param {string} password - The master password.
     * @returns {Promise<string>} The decrypted plaintext token.
     */
    async decryptToken(encryptedData, password) {
      try {
        const { ciphertext, salt, iv } = encryptedData;
        const key = await _deriveKey(password, salt);

        const decryptedBuffer = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: iv },
          key,
          ciphertext
        );

        const decoder = new TextDecoder();
        const decrypted = decoder.decode(decryptedBuffer);

        securityConcept.state.decryptedToken = decrypted;
        notify('tokenDecrypted', { success: true });
        return decrypted;
      } catch (error) {
        console.error('[SecurityConcept] Decryption failed. Likely incorrect password.', error);
        securityConcept.state.decryptedToken = null;
        notify('tokenDecryptionFailed', { error });
        throw new Error('Decryption failed. Incorrect password.');
      }
    },

    /**
     * Clears the in-memory decrypted token.
     */
    clearDecryptedToken() {
      securityConcept.state.decryptedToken = null;
      notify('sessionLocked');
      console.log('[SecurityConcept] In-memory token has been cleared.');
    },

    /**
     * Stores the master password for the current session.
     * @param {string} password - The master password.
     */
    setSessionPassword(password) {
      securityConcept.state.sessionPassword = password;
      notify('sessionPasswordSet');
    },
  },

  subscribe(fn) {
    subscribers.add(fn);
  },

  unsubscribe(fn) {
    subscribers.delete(fn);
  },

  notify,
};