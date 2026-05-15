// Default Trusted Types policy.
//
// Loaded as a non-module <script> BEFORE any module so it's installed before
// application code runs.
//
// Why permissive: mermaid 11.x uses `innerHTML` internally to build its
// temp render wrapper (PWA_LOCAL_STORAGE_GUIDE §4.7 calls out this exact
// situation for libraries that don't create their own named policy). A
// strict default that throws breaks every mermaid render. We pass strings
// through and log each sink invocation, so the policy is observational —
// future audits can use the console warnings to identify which sinks the
// app reaches and decide whether to harden each one with a named policy.
//
// The rest of the CSP (script-src, style-src, connect-src, object-src,
// frame-ancestors, etc.) is unchanged and still strict — the protections
// that block cross-origin code injection and exfiltration are intact. Only
// the TT same-origin-string-to-DOM defense is reduced to logging.
//
// To switch to throw-mode for hardening audits, flip THROW_ON_USE to true.

const THROW_ON_USE = false;
const _seenSinks = new Set();

function _logSink(sinkType, sink) {
  const key = `${sinkType}:${sink || 'unknown'}`;
  if (_seenSinks.has(key)) return;
  _seenSinks.add(key);
  // eslint-disable-next-line no-console
  console.warn(`[TT default] ${sinkType} used at ${sink || 'unknown sink'} — first occurrence this session`);
}

if (window.trustedTypes && window.trustedTypes.createPolicy) {
  try {
    window.trustedTypes.createPolicy('default', {
      createHTML: (s, sink) => {
        _logSink('createHTML', sink);
        if (THROW_ON_USE) throw new Error('innerHTML sink — use textContent and DOM construction');
        return s;
      },
      createScript: (s, sink) => {
        _logSink('createScript', sink);
        if (THROW_ON_USE) throw new Error('createScript not permitted');
        return s;
      },
      createScriptURL: (s, sink) => {
        _logSink('createScriptURL', sink);
        if (THROW_ON_USE) throw new Error('createScriptURL not permitted');
        return s;
      },
    });
  } catch (e) {
    // A 'default' policy already exists (re-load in dev). Original still applies.
  }
}
