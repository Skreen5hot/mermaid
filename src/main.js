// Entry point. Replaces the inline <script type="module"> blocks formerly
// embedded in index.html. Keeping the boot logic in a same-origin module is
// a prerequisite for the strict CSP that lands in the next slice.

import { initializeApp } from './synchronizations.js';
import { uiConcept } from './concepts/uiConcept.js';

document.addEventListener('DOMContentLoaded', () => {
  initializeApp();

  // The file <input>'s change event is wired here instead of inside the
  // uiConcept because it produces a payload (a FileList) that no other
  // concept layer accesses — keep the boundary thin.
  const uploadInput = document.getElementById('upload-diagrams-input');
  if (uploadInput) {
    uploadInput.addEventListener('change', (event) => {
      uiConcept.notify('ui:uploadMmdClicked', { files: event.target.files });
    });
  }
});
