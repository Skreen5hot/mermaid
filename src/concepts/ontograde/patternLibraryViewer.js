/**
 * @module patternLibraryViewer
 * @description UI component for displaying the Pattern Library browser modal.
 * Allows users to browse, search, and learn about CCO design patterns.
 */

import {
  PATTERN_CATEGORIES,
  PATTERN_STATUS,
  SEVERITY,
  getActivePatterns,
  getAllPatterns,
  getPatternById,
  getPatternsByCategory,
  getPatternCountsByCategory,
  searchPatterns,
} from './patternLibrary.js';

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

export const patternLibraryViewer = {
  state: {
    isInitialized: false,
    modalElements: {},
    currentView: 'grid', // 'grid' or 'list'
    currentCategory: 'all',
    searchQuery: '',
    selectedPattern: null,
    activeTab: 'overview', // 'overview', 'rules', 'examples', 'tests'
  },

  actions: {
    /**
     * Initializes the pattern library viewer
     */
    initialize() {
      console.log('[patternLibraryViewer] Initializing...');

      patternLibraryViewer.state.modalElements = {
        modal: document.getElementById('pattern-library-modal'),
        closeBtn: document.getElementById('pattern-library-close-btn'),
        searchInput: document.getElementById('pattern-search'),
        categoryFilter: document.getElementById('category-filter'),
        gridViewBtn: document.getElementById('grid-view-btn'),
        listViewBtn: document.getElementById('list-view-btn'),
        patternGrid: document.getElementById('pattern-grid'),
        detailModal: document.getElementById('pattern-detail-modal'),
        detailCloseBtn: document.getElementById('pattern-detail-close-btn'),
        detailContent: document.getElementById('pattern-detail-content'),
      };

      patternLibraryViewer.helpers.setupEventListeners();
      patternLibraryViewer.state.isInitialized = true;

      console.log('[patternLibraryViewer] Initialized successfully');
    },

    /**
     * Shows the pattern library modal
     */
    showLibrary() {
      if (!patternLibraryViewer.state.isInitialized) {
        patternLibraryViewer.actions.initialize();
      }

      console.log('[patternLibraryViewer] Opening Pattern Library');

      // Reset state
      patternLibraryViewer.state.searchQuery = '';
      patternLibraryViewer.state.currentCategory = 'all';
      patternLibraryViewer.state.selectedPattern = null;

      // Reset UI
      if (patternLibraryViewer.state.modalElements.searchInput) {
        patternLibraryViewer.state.modalElements.searchInput.value = '';
      }
      if (patternLibraryViewer.state.modalElements.categoryFilter) {
        patternLibraryViewer.state.modalElements.categoryFilter.value = 'all';
      }

      // Render patterns
      patternLibraryViewer.helpers.renderPatternGrid();

      // Show modal
      patternLibraryViewer.state.modalElements.modal.style.display = 'flex';

      notify('libraryOpened', {});
    },

    /**
     * Hides the pattern library modal
     */
    hideLibrary() {
      console.log('[patternLibraryViewer] Closing Pattern Library');
      patternLibraryViewer.state.modalElements.modal.style.display = 'none';
      notify('libraryClosed', {});
    },

    /**
     * Shows pattern details in the detail modal
     * @param {string} patternId - The pattern ID to show
     */
    showPatternDetails(patternId) {
      const pattern = getPatternById(patternId);
      if (!pattern) {
        console.error(`[patternLibraryViewer] Pattern not found: ${patternId}`);
        return;
      }

      console.log(`[patternLibraryViewer] Showing details for: ${pattern.name}`);

      patternLibraryViewer.state.selectedPattern = pattern;
      patternLibraryViewer.state.activeTab = 'overview';

      patternLibraryViewer.helpers.renderPatternDetail(pattern);
      patternLibraryViewer.state.modalElements.detailModal.style.display = 'flex';

      notify('patternSelected', { patternId, pattern });
    },

    /**
     * Hides the pattern detail modal
     */
    hidePatternDetails() {
      console.log('[patternLibraryViewer] Closing pattern details');
      patternLibraryViewer.state.modalElements.detailModal.style.display = 'none';
      patternLibraryViewer.state.selectedPattern = null;
      notify('patternDeselected', {});
    },

    /**
     * Switches to a different tab in the pattern detail view
     * @param {string} tabName - The tab to switch to
     */
    switchTab(tabName) {
      patternLibraryViewer.state.activeTab = tabName;
      patternLibraryViewer.helpers.updateTabContent();
      notify('tabChanged', { tab: tabName });
    },

    /**
     * Filters patterns by category
     * @param {string} category - The category to filter by ('all' for all patterns)
     */
    filterByCategory(category) {
      patternLibraryViewer.state.currentCategory = category;
      patternLibraryViewer.helpers.renderPatternGrid();
      notify('categoryChanged', { category });
    },

    /**
     * Searches patterns by query
     * @param {string} query - The search query
     */
    search(query) {
      patternLibraryViewer.state.searchQuery = query;
      patternLibraryViewer.helpers.renderPatternGrid();
      notify('searchChanged', { query });
    },

    /**
     * Toggles between grid and list view
     * @param {string} view - 'grid' or 'list'
     */
    setView(view) {
      patternLibraryViewer.state.currentView = view;
      patternLibraryViewer.helpers.updateViewToggle();
      patternLibraryViewer.helpers.renderPatternGrid();
      notify('viewChanged', { view });
    },

    /**
     * Opens the pattern library to a specific pattern
     * Used for "Learn More" links from validation reports
     * @param {string} patternId - The pattern ID to open
     * @param {string} tab - Optional tab to open (default: 'rules')
     */
    openToPattern(patternId, tab = 'rules') {
      patternLibraryViewer.actions.showLibrary();
      patternLibraryViewer.state.activeTab = tab;
      patternLibraryViewer.actions.showPatternDetails(patternId);
    },
  },

  helpers: {
    /**
     * Sets up event listeners for the pattern library
     */
    setupEventListeners() {
      const { modal, closeBtn, searchInput, categoryFilter, gridViewBtn, listViewBtn, detailModal, detailCloseBtn } =
        patternLibraryViewer.state.modalElements;

      // Close buttons
      closeBtn?.addEventListener('click', () => {
        patternLibraryViewer.actions.hideLibrary();
      });

      detailCloseBtn?.addEventListener('click', () => {
        patternLibraryViewer.actions.hidePatternDetails();
      });

      // Close on background click
      modal?.addEventListener('click', (e) => {
        if (e.target === modal) {
          patternLibraryViewer.actions.hideLibrary();
        }
      });

      detailModal?.addEventListener('click', (e) => {
        if (e.target === detailModal) {
          patternLibraryViewer.actions.hidePatternDetails();
        }
      });

      // Search input
      searchInput?.addEventListener('input', (e) => {
        patternLibraryViewer.actions.search(e.target.value);
      });

      // Category filter
      categoryFilter?.addEventListener('change', (e) => {
        patternLibraryViewer.actions.filterByCategory(e.target.value);
      });

      // View toggle buttons
      gridViewBtn?.addEventListener('click', () => {
        patternLibraryViewer.actions.setView('grid');
      });

      listViewBtn?.addEventListener('click', () => {
        patternLibraryViewer.actions.setView('list');
      });

      // Close on Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          if (detailModal?.style.display === 'flex') {
            patternLibraryViewer.actions.hidePatternDetails();
          } else if (modal?.style.display === 'flex') {
            patternLibraryViewer.actions.hideLibrary();
          }
        }
      });
    },

    /**
     * Gets the filtered patterns based on current state
     * @returns {Object[]} Array of filtered patterns
     */
    getFilteredPatterns() {
      let patterns = [];

      // Apply category filter
      if (patternLibraryViewer.state.currentCategory === 'all') {
        patterns = getAllPatterns();
      } else {
        patterns = getPatternsByCategory(patternLibraryViewer.state.currentCategory);
      }

      // Apply search filter
      if (patternLibraryViewer.state.searchQuery) {
        const query = patternLibraryViewer.state.searchQuery.toLowerCase();
        patterns = patterns.filter(
          (p) => p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query)
        );
      }

      return patterns;
    },

    /**
     * Renders the pattern grid/list
     */
    renderPatternGrid() {
      const { patternGrid } = patternLibraryViewer.state.modalElements;
      if (!patternGrid) return;

      const patterns = patternLibraryViewer.helpers.getFilteredPatterns();
      const isGrid = patternLibraryViewer.state.currentView === 'grid';

      patternGrid.className = isGrid ? 'pattern-grid' : 'pattern-list';

      if (patterns.length === 0) {
        patternGrid.innerHTML = `
          <div class="pattern-empty">
            <p>No patterns found matching your criteria.</p>
          </div>
        `;
        return;
      }

      patternGrid.innerHTML = patterns.map((pattern) => patternLibraryViewer.helpers.renderPatternCard(pattern)).join('');

      // Add click handlers to cards
      patternGrid.querySelectorAll('.pattern-card').forEach((card) => {
        card.addEventListener('click', () => {
          const patternId = card.dataset.patternId;
          patternLibraryViewer.actions.showPatternDetails(patternId);
        });
      });
    },

    /**
     * Renders a single pattern card
     * @param {Object} pattern - The pattern object
     * @returns {string} HTML string for the card
     */
    renderPatternCard(pattern) {
      const statusBadge =
        pattern.status === PATTERN_STATUS.ACTIVE
          ? '<span class="pattern-badge active">Active</span>'
          : '<span class="pattern-badge draft">Draft</span>';

      const categoryBadge = `<span class="pattern-badge category-${pattern.category}">${pattern.category}</span>`;

      return `
        <div class="pattern-card" data-pattern-id="${pattern.id}">
          <div class="pattern-card-header">
            <h3>${pattern.name}</h3>
            <div class="pattern-badges">
              ${statusBadge}
              ${categoryBadge}
            </div>
          </div>
          <div class="pattern-card-body">
            <p class="pattern-description">${pattern.description}</p>
            <div class="pattern-structure">
              <code>${patternLibraryViewer.helpers.truncateStructure(pattern.structure)}</code>
            </div>
          </div>
          <div class="pattern-card-footer">
            <div class="pattern-stats">
              <span class="stat" title="Validation Rules">
                <span class="stat-icon">📝</span> ${pattern.rules.length} Rules
              </span>
              <span class="stat" title="Test Count">
                <span class="stat-icon">🧪</span> ${pattern.testCount} Tests
              </span>
            </div>
            <button class="btn-view-details">View Details</button>
          </div>
        </div>
      `;
    },

    /**
     * Truncates the structure text for card display
     * @param {string} structure - The structure text
     * @returns {string} Truncated structure
     */
    truncateStructure(structure) {
      const lines = structure.trim().split('\n');
      if (lines.length <= 3) return structure.trim();
      return lines.slice(0, 3).join('\n') + '...';
    },

    /**
     * Renders the pattern detail modal content
     * @param {Object} pattern - The pattern object
     */
    renderPatternDetail(pattern) {
      const { detailContent } = patternLibraryViewer.state.modalElements;
      if (!detailContent) return;

      detailContent.innerHTML = `
        <div class="pattern-detail-header">
          <h2>${pattern.name}</h2>
          <div class="pattern-badges">
            ${
              pattern.status === PATTERN_STATUS.ACTIVE
                ? '<span class="pattern-badge active">Active</span>'
                : '<span class="pattern-badge draft">Draft</span>'
            }
            <span class="pattern-badge category-${pattern.category}">${pattern.category}</span>
          </div>
        </div>

        <div class="pattern-detail-tabs">
          <button class="tab-btn active" data-tab="overview">Overview</button>
          <button class="tab-btn" data-tab="rules">Validation Rules</button>
          <button class="tab-btn" data-tab="examples">Examples</button>
          <button class="tab-btn" data-tab="bfo">BFO Rationale</button>
        </div>

        <div class="pattern-detail-body">
          ${patternLibraryViewer.helpers.renderOverviewTab(pattern)}
          ${patternLibraryViewer.helpers.renderRulesTab(pattern)}
          ${patternLibraryViewer.helpers.renderExamplesTab(pattern)}
          ${patternLibraryViewer.helpers.renderBfoTab(pattern)}
        </div>
      `;

      // Setup tab event listeners
      detailContent.querySelectorAll('.tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          patternLibraryViewer.actions.switchTab(btn.dataset.tab);
        });
      });

      // Update tab visibility
      patternLibraryViewer.helpers.updateTabContent();
    },

    /**
     * Renders the Overview tab content
     * @param {Object} pattern - The pattern object
     * @returns {string} HTML string
     */
    renderOverviewTab(pattern) {
      return `
        <div class="tab-content" data-tab="overview">
          <h3>Description</h3>
          <p class="pattern-full-description">${pattern.fullDescription.replace(/\n/g, '<br>')}</p>

          <h3>Structure</h3>
          <div class="pattern-structure-full">
            <pre><code>${pattern.structure}</code></pre>
          </div>

          ${
            pattern.relatedPatterns && pattern.relatedPatterns.length > 0
              ? `
            <h3>Related Patterns</h3>
            <div class="related-patterns">
              ${pattern.relatedPatterns
                .map((id) => {
                  const related = getPatternById(id);
                  const name = related ? related.name : id;
                  return `<a href="#" class="pattern-link" data-pattern-id="${id}">${name}</a>`;
                })
                .join(' ')}
            </div>
          `
              : ''
          }

          ${
            pattern.ccoReference
              ? `
            <h3>CCO Reference</h3>
            <a href="${pattern.ccoReference}" target="_blank" class="cco-link">
              View in CCO Documentation →
            </a>
          `
              : ''
          }
        </div>
      `;
    },

    /**
     * Renders the Rules tab content
     * @param {Object} pattern - The pattern object
     * @returns {string} HTML string
     */
    renderRulesTab(pattern) {
      if (!pattern.rules || pattern.rules.length === 0) {
        return `
          <div class="tab-content" data-tab="rules" style="display: none;">
            <p class="no-rules">No validation rules defined for this pattern yet.</p>
          </div>
        `;
      }

      const rulesHtml = pattern.rules
        .map(
          (rule) => `
        <div class="validation-rule">
          <div class="rule-header">
            <span class="rule-severity ${rule.severity}">${rule.severity.toUpperCase()}</span>
            <h4>${rule.name}</h4>
          </div>
          <div class="rule-body">
            <p><strong>What:</strong> ${rule.what}</p>
            <p><strong>Why:</strong> ${rule.why}</p>
            <p><strong>Impact:</strong> ${rule.impact}</p>
            <p class="rule-fix"><strong>Fix:</strong> ${rule.fix}</p>
          </div>
        </div>
      `
        )
        .join('');

      return `
        <div class="tab-content" data-tab="rules" style="display: none;">
          <h3>Validation Rules (${pattern.rules.length})</h3>
          <div class="validation-rules">
            ${rulesHtml}
          </div>
        </div>
      `;
    },

    /**
     * Renders the Examples tab content
     * @param {Object} pattern - The pattern object
     * @returns {string} HTML string
     */
    renderExamplesTab(pattern) {
      const correctExample = pattern.examples?.correct;
      const violations = pattern.examples?.violations || [];

      return `
        <div class="tab-content" data-tab="examples" style="display: none;">
          ${
            correctExample
              ? `
            <h3>Correct Implementation</h3>
            <div class="example-correct">
              <h4>${correctExample.title}</h4>
              <div class="example-diagram">
                <pre><code class="language-mermaid">${correctExample.mermaid}</code></pre>
              </div>
              <p class="example-description">${correctExample.description}</p>
            </div>
          `
              : ''
          }

          ${
            violations.length > 0
              ? `
            <h3>Common Violations</h3>
            <div class="example-violations">
              ${violations
                .map(
                  (v) => `
                <div class="example-violation">
                  <h4>${v.title}</h4>
                  <div class="example-diagram">
                    <pre><code class="language-mermaid">${v.mermaid}</code></pre>
                  </div>
                  <div class="violation-info">
                    <span class="violation-error">${v.error}</span>
                    <span class="violation-impact">Score Impact: ${v.scoreImpact}</span>
                  </div>
                </div>
              `
                )
                .join('')}
            </div>
          `
              : ''
          }
        </div>
      `;
    },

    /**
     * Renders the BFO Rationale tab content
     * @param {Object} pattern - The pattern object
     * @returns {string} HTML string
     */
    renderBfoTab(pattern) {
      return `
        <div class="tab-content" data-tab="bfo" style="display: none;">
          <h3>BFO/CCO Rationale</h3>
          <div class="bfo-rationale">
            <p>${pattern.bfoRationale.replace(/\n/g, '<br>')}</p>
          </div>

          <h3>Expert Review Status</h3>
          <div class="expert-status">
            ${
              pattern.status === PATTERN_STATUS.ACTIVE
                ? `
              <span class="status-approved">✅ Approved by CCO/BFO Expert (2026-01-09)</span>
              <p>This pattern has been reviewed and approved as compliant with BFO/CCO standards.</p>
            `
                : `
              <span class="status-draft">⏳ Pending Expert Review</span>
              <p>This pattern is a draft and has not yet been validated by a CCO/BFO expert.</p>
            `
            }
          </div>
        </div>
      `;
    },

    /**
     * Updates the tab visibility based on active tab
     */
    updateTabContent() {
      const { detailContent } = patternLibraryViewer.state.modalElements;
      if (!detailContent) return;

      const activeTab = patternLibraryViewer.state.activeTab;

      // Update tab buttons
      detailContent.querySelectorAll('.tab-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.tab === activeTab);
      });

      // Update tab content visibility
      detailContent.querySelectorAll('.tab-content').forEach((content) => {
        content.style.display = content.dataset.tab === activeTab ? 'block' : 'none';
      });
    },

    /**
     * Updates the view toggle buttons
     */
    updateViewToggle() {
      const { gridViewBtn, listViewBtn } = patternLibraryViewer.state.modalElements;
      const isGrid = patternLibraryViewer.state.currentView === 'grid';

      gridViewBtn?.classList.toggle('active', isGrid);
      listViewBtn?.classList.toggle('active', !isGrid);
    },

    /**
     * Generates category options HTML
     * @returns {string} HTML string for category options
     */
    getCategoryOptionsHtml() {
      const counts = getPatternCountsByCategory();

      let html = '<option value="all">All Categories</option>';
      for (const [key, value] of Object.entries(PATTERN_CATEGORIES)) {
        const count = counts[value] || 0;
        if (count > 0) {
          html += `<option value="${value}">${key} (${count})</option>`;
        }
      }

      return html;
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

export default patternLibraryViewer;
