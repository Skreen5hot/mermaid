# Specification: Client-Side GitHub/GitLab Token Storage

**Version:** 1.0
**Date:** 2026-01-31
**Status:** Active
**Classification:** Internal Technical Specification

---

## 1. Overview

The Mermaid IDE PWA stores GitHub and GitLab Personal Access Tokens (PATs) entirely on the client side using AES-GCM encryption backed by PBKDF2 key derivation. Tokens are persisted in IndexedDB as encrypted blobs and are only decrypted into memory when the user explicitly unlocks a session with a master password. No backend server is involved in credential storage or transit.

This document specifies the implementation in detail and provides a security justification for this non-standard approach.

---

## 2. Architecture

### 2.1 Zero-Knowledge / Host-Proof Model

The application has no backend database. It is deployed as a static PWA (e.g., via GitHub Pages). The hosting provider serves only HTML, CSS, and JavaScript assets. At no point does any server operated by the application provider receive, process, or store user credentials.

```
User Device (PWA in browser)
  ├── IndexedDB: encrypted token blobs
  ├── RAM: decrypted token (session-scoped)
  └── HTTPS: direct API calls to GitHub/GitLab

Application Provider
  └── Static file hosting only (no API, no database)
```

### 2.2 Component Responsibilities

| Component | File | Role |
|-----------|------|------|
| Security Concept | `src/concepts/securityConcept.js` | Encryption, decryption, session state |
| Storage Concept | `src/concepts/storageConcept.js` | IndexedDB schema and CRUD operations |
| Synchronizations | `src/synchronizations.js` | Orchestrates token flow across concepts |
| Sync Service | `src/concepts/syncService.js` | Polling, token usage during sync cycles |
| UI Concept | `src/concepts/uiConcept.js` | Token and master password input forms |
| GitHub Adapter | `src/github.js` | GitHub REST API calls using `Authorization: Bearer <token>` |
| GitLab Adapter | `src/gitlab.js` | GitLab REST API calls using `PRIVATE-TOKEN: <token>` |

---

## 3. Cryptographic Implementation

All cryptographic operations use the browser-native **Web Crypto API** (`crypto.subtle`). No third-party cryptography libraries are used.

### 3.1 Key Derivation

| Parameter | Value |
|-----------|-------|
| Algorithm | PBKDF2 |
| Hash | SHA-256 |
| Iterations | 100,000 |
| Salt | 16 bytes, generated via `crypto.getRandomValues()` |
| Output | 256-bit AES-GCM key |

The user provides a master password at project creation time. This password is run through PBKDF2 to produce a symmetric key. The salt is unique per encryption operation and is stored alongside the ciphertext.

### 3.2 Encryption

| Parameter | Value |
|-----------|-------|
| Algorithm | AES-GCM (Galois/Counter Mode) |
| Key size | 256 bits |
| IV | 12 bytes, generated via `crypto.getRandomValues()` |
| Authentication | Built-in (GCM provides authenticated encryption) |

AES-GCM was chosen because it provides both confidentiality and integrity in a single operation. A tampered ciphertext will fail decryption rather than produce garbled output.

### 3.3 Encrypted Token Bundle

The output of encryption is a three-part bundle stored as a single object:

```javascript
{
  ciphertext: ArrayBuffer,   // The encrypted PAT
  salt:       Uint8Array(16), // PBKDF2 salt (public)
  iv:         Uint8Array(12)  // AES-GCM IV (public)
}
```

The salt and IV are not secrets. They are stored in the clear alongside the ciphertext. Their purpose is to ensure that encrypting the same token twice with the same password produces entirely different ciphertext, preventing pattern analysis.

### 3.4 Decryption

Decryption reverses the process: the master password and stored salt are fed to PBKDF2 to re-derive the key, then AES-GCM decrypts the ciphertext using the stored IV. If the password is wrong, `crypto.subtle.decrypt` throws a `DOMException` and no plaintext is produced.

---

## 4. Storage Schema

### 4.1 IndexedDB Configuration

| Property | Value |
|----------|-------|
| Database name | `MermaidIDE` |
| Version | 3 |
| Object store | `projects` (keyPath: `id`, autoIncrement) |

### 4.2 Project Record Structure

```
{
  id:              number          // Auto-incremented PK
  name:            string          // Human-readable project name
  gitProvider:     "github" | "gitlab" | "local"
  repositoryPath:  string | null   // "owner/repo"
  defaultBranch:   string | null   // e.g. "main"
  apiBaseUrl:      string | null   // For self-hosted GitLab instances
  encryptedToken:  {               // The encrypted PAT bundle
    ciphertext: ArrayBuffer,
    salt: Uint8Array(16),
    iv: Uint8Array(12)
  }
  lastSyncSha:     string | null
  createdAt:       Date
  updatedAt:       Date
}
```

Plaintext tokens are never written to IndexedDB, localStorage, sessionStorage, cookies, or any other persistent store.

---

## 5. Token Lifecycle

### 5.1 Creation (One-Time Setup)

1. User enters a PAT and a master password in the project creation form.
2. The PAT is used immediately (in-memory only) to validate repository access via the GitHub/GitLab API.
3. `securityConcept.encryptToken(pat, masterPassword)` produces the encrypted bundle.
4. The bundle is saved to IndexedDB as part of the project record.
5. The plaintext PAT is discarded (goes out of scope; no persistent reference).

### 5.2 Session Unlock

1. User selects a remote project and enters their master password.
2. `securityConcept.setSessionPassword(password)` stores the password in `securityConcept.state.sessionPassword` (RAM only).
3. The sync service begins polling (default: every 5 minutes).

### 5.3 Active Use (Sync Cycle)

1. `syncService._performSync()` reads the project's `encryptedToken` from IndexedDB.
2. Calls `securityConcept.decryptToken(encryptedToken, sessionPassword)`.
3. The decrypted PAT is passed to the GitHub or GitLab adapter for API calls.
4. The PAT remains in `securityConcept.state.decryptedToken` for the duration of the session.

### 5.4 Session Lock

1. User locks the session manually, or the browser tab is closed.
2. `securityConcept.clearDecryptedToken()` sets both `decryptedToken` and `sessionPassword` to `null`.
3. Sync polling stops.
4. The encrypted bundle remains in IndexedDB for next unlock.

```
LOCKED ──[enter password]──> UNLOCKED ──[lock/close]──> LOCKED
  │                              │
  │ IndexedDB: encrypted blob    │ RAM: decrypted token
  │ RAM: nothing                 │ RAM: session password
  │ Sync: stopped                │ Sync: active (5 min)
```

---

## 6. API Authentication

### 6.1 GitHub

Tokens are sent as a Bearer token in the `Authorization` header over HTTPS:

```
Authorization: Bearer ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Accept: application/vnd.github.v3+json
```

Required scopes: `repo` (private repos) or `public_repo` (public repos only).

### 6.2 GitLab

Tokens are sent via the `PRIVATE-TOKEN` header over HTTPS:

```
PRIVATE-TOKEN: glpat-xxxxxxxxxxxxxxxxxxxx
Content-Type: application/json
```

Self-hosted GitLab instances are supported via a configurable `apiBaseUrl`.

---

## 7. Security Justification

### 7.1 Why Client-Side Storage Instead of a Backend?

The standard approach for handling third-party API tokens is to store them on a backend server, often encrypted at rest with a server-managed key, and proxy API requests through that server. This specification deliberately rejects that model for the following reasons:

**Eliminating the mass-breach vector.** A backend database containing tokens for N users is a high-value target. A single breach exposes every user simultaneously. With client-side storage, an attacker must compromise individual devices one at a time. There is no central honeypot.

**Eliminating the insider-threat vector.** In a backend model, any developer, operator, or administrator with database access can read tokens (or the keys protecting them). In this model, the application provider has zero access to credentials at any point.

**Data sovereignty.** The user's credentials never leave their device. This is a requirement for alignment with the application's broader Linked Data / decentralized architecture, where the user's device is the authoritative agent.

**Operational simplicity.** No backend means no servers to patch, no databases to back up, no incident-response playbook for credential leaks, and no SOC 2 / ISO 27001 scope expansion for a credential store.

### 7.2 Threat Model

| Threat | Severity | Mitigation |
|--------|----------|------------|
| **Backend database breach** | Eliminated | No backend exists. |
| **Insider threat (app operator)** | Eliminated | Operator never possesses tokens. |
| **XSS in the PWA** | High | Minimal dependencies; open-source auditability; Content Security Policy. An attacker who achieves XSS could read `securityConcept.state.decryptedToken` from memory while the session is unlocked. This is the primary residual risk. |
| **Physical device compromise** | Medium | Tokens are encrypted at rest. Attacker must also know the master password to decrypt. |
| **Brute-force on encrypted blob** | Low | PBKDF2 with 100,000 iterations makes offline brute-force computationally expensive. A strong master password makes this infeasible. |
| **IndexedDB exfiltration (e.g., disk forensics)** | Low | Same-origin policy prevents cross-origin reads. Encrypted blob is useless without the master password. |
| **Man-in-the-middle** | Low | All API calls to GitHub/GitLab use HTTPS. Tokens are never sent to any other endpoint. |
| **Supply chain attack (malicious dependency)** | Medium | CI/CD uses `npm ci` with lockfile hashes. Codebase is open source. |

### 7.3 Comparison to Industry Alternatives

**OAuth with backend proxy (e.g., GitHub Apps).** Eliminates client-side token handling entirely. However, it requires a backend server, introduces a central point of failure, and grants the application provider access to user repositories. This conflicts with the zero-knowledge architecture.

**Browser credential management API.** The Credential Management API is designed for username/password pairs and WebAuthn, not arbitrary API tokens. It does not support storing opaque secrets with custom encryption.

**OS-level keychain (via native app).** Would provide hardware-backed key storage. However, this is not available to PWAs running in a browser sandbox. A native application would lose the cross-platform, zero-install deployment model.

**localStorage with no encryption.** Plaintext storage in localStorage is the baseline insecure option. Our approach adds AES-GCM encryption, master-password gating, and session-scoped decryption on top of IndexedDB, which is a strict improvement over this baseline.

### 7.4 Accepted Residual Risk

The primary residual risk is that a successful XSS attack against the PWA while a session is unlocked could read the decrypted token from JavaScript memory. This is an inherent constraint of any browser-based application that must use credentials at runtime. The same risk exists in any web application that holds an OAuth access token in memory for API calls, including those that use backend-issued session cookies with JavaScript-accessible APIs.

We accept this risk for the following reasons:

1. The attack surface is limited to the duration of an unlocked session.
2. The application has minimal external dependencies, reducing the probability of a supply chain XSS vector.
3. The codebase is open source and auditable.
4. Users are advised to use short-lived PATs (30-day expiration) to limit the blast radius of any compromise.
5. The alternative (a backend) introduces strictly more attack surface (server compromise, insider threat, database breach) while reducing user sovereignty.

### 7.5 Recommendations for Deploying Organizations

- Enforce short PAT expiration policies (30 days or less).
- Ensure developer workstations have endpoint protection and disk encryption.
- Deploy the PWA with a strict Content Security Policy to mitigate XSS.
- Audit the open-source codebase before deploying to sensitive environments.
- Treat the browser as a trusted computing boundary, consistent with the fact that developers already use browsers to access GitHub/GitLab directly.

---

## 8. References

- [Web Crypto API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [AES-GCM - NIST SP 800-38D](https://csrc.nist.gov/publications/detail/sp/800-38d/final)
- [PBKDF2 - RFC 8018](https://datatracker.ietf.org/doc/html/rfc8018)
- [IndexedDB API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
