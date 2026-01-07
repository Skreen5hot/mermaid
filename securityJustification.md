# Security Architecture & Justification

## Executive Summary
This document outlines the security model of the Mermaid IDE PWA. Unlike traditional enterprise applications that rely on **Centralized Security** (trusting a central server), this application adopts a **Zero-Knowledge / Host-Proof** architecture.

We acknowledge that handling Personal Access Tokens (PATs) on the client side presents specific risks. However, we argue that for a personal developer tool, this model offers superior privacy and eliminates the risk of a mass data breach, provided the delivery pipeline is secure.

## 1. The "Host-Proof" Philosophy
In a standard SaaS model, a central server holds the keys to the kingdom. If that server is breached, every user's intellectual property and credentials are compromised simultaneously.

*   **Our Approach:** This application has **no backend database**.
*   **The Benefit:** The application provider cannot see, sell, leak, or lose user data because we never possess it.
*   **The Result:** A breach of our hosting provider (GitHub Pages) does not yield a database of user secrets.

## 2. Credential Handling & Encryption
We utilize the browser's native **Web Crypto API** to ensure industry-standard encryption at rest.

### Implementation Details (`securityConcept.js`)
*   **Algorithm:** AES-GCM (Galois/Counter Mode) for authenticated encryption.
*   **Key Derivation:** PBKDF2 with SHA-256 and 100,000 iterations.
*   **Salting:** Unique random salts and IVs (Initialization Vectors) are generated for every encryption operation using `crypto.getRandomValues`.
*   **Storage:** Only the *encrypted* blob (ciphertext) is stored in IndexedDB (`storageConcept.js`). The plain-text token is never written to disk.

### The "Dangerous" Aspect
Security audits correctly flag that if the browser environment is compromised (e.g., via XSS), the in-memory token could be read.
*   **Mitigation:** This is an inherent trade-off of "Thick Client" applications. We mitigate this by minimizing external dependencies and ensuring the token is only decrypted in memory when the session is explicitly unlocked by the user.

### Token Expiration Strategy
We strongly recommend users configure their Personal Access Tokens (PATs) with **short expiration periods** (e.g., 30 days).
*   **Benefit:** If a token is compromised, its validity is temporally limited.
*   **Rotation:** Since the app is stateless regarding auth, rotating a token is trivial: simply update the project settings with the new token.

## 3. Supply Chain Integrity
Since the application code itself is the "root of trust," we enforce strict integrity in our delivery pipeline to prevent code injection attacks.

*   **Immutable Builds:** Our CI/CD pipeline uses `npm ci` (Clean Install) instead of `npm install`. This forces the build server to use the exact cryptographic hashes defined in `package-lock.json`, preventing dependency substitution attacks during the build process.
*   **Transparency:** The entire codebase is open source, allowing for auditability of the logic that handles credentials.

## 4. Threat Model Comparison

| Threat Vector | Centralized Server (Traditional) | Decentralized PWA (Our Model) |
| :--- | :--- | :--- |
| **Database Breach** | **Critical:** All users exposed. | **None:** No database exists. |
| **Insider Threat** | **High:** Rogue admin can read data. | **None:** We have no access. |
| **XSS / Malware** | **Low:** Tokens usually HttpOnly cookies. | **High:** Requires secure browser. |
| **Data Sovereignty** | **Low:** Data lives on vendor servers. | **High:** Data lives on user device. |

## Conclusion
We classify this tool as **"High Responsibility"** rather than "High Risk." It empowers the user with total control over their data, removing the reliance on a third-party custodian.

By using this tool, the organization accepts that **endpoint security** (the developer's laptop and browser) is the primary security boundary, rather than a vendor's firewall.

## 5. Strategic Alignment: Linked Data & The Semantic Web
Our security model is a deliberate architectural choice to align with the **Linked Data** vision (as outlined in our Data Architecture Refactor plan).

### Decentralization Requires Client-Side Authority
In the vision of a decentralized web (Web 3.0 / Semantic Web), the user's device acts as the primary **User Agent**, manipulating data across distributed Personal Data Stores (in our case, Git repositories).
*   **The Conflict:** Centralized security models rely on a "trusted server" to hold keys. This creates a data silo, antithetical to Linked Data principles.
*   **The Resolution:** To achieve true decentralization, the application logic and credentials *must* reside with the user. The "High Risk" of client-side token handling is a necessary trade-off to achieve **Data Sovereignty**. We mitigate this risk via the "Host-Proof" architecture, ensuring that while the *capability* is local, the *persistence* is secure.

### Integrity of the Knowledge Graph
By adopting **BFO-aligned JSON-LD**, we are transforming the repository into a node in a global knowledge graph.
*   **Provenance:** The security of the token is paramount not just for privacy, but for **Data Integrity**. A compromised token could allow an attacker to inject false assertions into the knowledge graph.
*   **Mitigation:** Our strict supply chain security (`npm ci`, immutable builds) ensures that the *logic* generating this Linked Data is untampered with, preserving the trustworthiness of the semantic data produced by the tool.