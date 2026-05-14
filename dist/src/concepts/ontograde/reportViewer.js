/**
 * @module reportViewer
 * @description UI component for displaying OntoGrade reports in a modal
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

export const reportViewer = {
  state: {
    currentReport: null,
    modalElements: {},
    isInitialized: false,
  },

  actions: {
    /**
     * Initializes the report viewer by caching DOM elements
     */
    initialize() {
      console.log('[reportViewer] Initializing...');

      // Cache all modal elements
      reportViewer.state.modalElements = {
        modal: document.getElementById('ontograde-report-modal'),
        closeBtn: document.getElementById('ontograde-close-btn'),
        doneBtn: document.getElementById('ontograde-done-btn'),
        downloadBtn: document.getElementById('ontograde-download-btn'),

        // Score display
        finalScore: document.getElementById('ontograde-final-score'),
        scoreLabel: document.getElementById('ontograde-score-label'),

        // Summary
        summaryBfo: document.getElementById('summary-bfo'),
        summaryPatterns: document.getElementById('summary-patterns'),
        summaryLogic: document.getElementById('summary-logic'),

        // Breakdown
        breakdownBfoScore: document.getElementById('breakdown-bfo-score'),
        breakdownBfoBar: document.getElementById('breakdown-bfo-bar'),
        breakdownBfoDetails: document.getElementById('breakdown-bfo-details'),

        breakdownPatternsScore: document.getElementById('breakdown-patterns-score'),
        breakdownPatternsBar: document.getElementById('breakdown-patterns-bar'),
        breakdownPatternsDetails: document.getElementById('breakdown-patterns-details'),

        breakdownLogicScore: document.getElementById('breakdown-logic-score'),
        breakdownLogicBar: document.getElementById('breakdown-logic-bar'),
        breakdownLogicDetails: document.getElementById('breakdown-logic-details'),

        // Violations
        violationsSection: document.getElementById('ontograde-violations'),
        violationCount: document.getElementById('violation-count'),
        violationsList: document.getElementById('violations-list'),

        // Recommendations
        recommendationsList: document.getElementById('recommendations-list'),

        // Footer
        timestamp: document.getElementById('report-timestamp'),
      };

      // Set up event listeners
      reportViewer.helpers.setupEventListeners();

      reportViewer.state.isInitialized = true;
      console.log('[reportViewer] Initialized successfully');
    },

    /**
     * Shows the report modal with the given report data
     * @param {Object} params
     * @param {Object} params.report - JSON-LD report from reportGenerator
     */
    showReport({ report }) {
      if (!reportViewer.state.isInitialized) {
        reportViewer.actions.initialize();
      }

      console.log('[reportViewer] Displaying report for score:', report.final_score);

      reportViewer.state.currentReport = report;

      // Populate modal with report data
      reportViewer.helpers.populateScore(report);
      reportViewer.helpers.populateSummary(report);
      reportViewer.helpers.populateBreakdown(report);
      reportViewer.helpers.populateViolations(report);
      reportViewer.helpers.populateRecommendations(report);
      reportViewer.helpers.populateMetadata(report);

      // Show the modal
      reportViewer.state.modalElements.modal.style.display = 'flex';

      notify('reportModalOpened', { report });
    },

    /**
     * Hides the report modal
     */
    hideReport() {
      console.log('[reportViewer] Closing report modal');
      reportViewer.state.modalElements.modal.style.display = 'none';
      notify('reportModalClosed', {});
    },

    /**
     * Downloads the current report as JSON-LD
     */
    downloadReport() {
      if (!reportViewer.state.currentReport) {
        console.error('[reportViewer] No report to download');
        return;
      }

      const report = reportViewer.state.currentReport;
      const jsonString = JSON.stringify(report, null, 2);
      const blob = new Blob([jsonString], { type: 'application/ld+json' });
      const url = URL.createObjectURL(blob);

      const timestamp = new Date(report.timestamp).toISOString().split('T')[0];
      const filename = `ontograde-report-${timestamp}.jsonld`;

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log(`[reportViewer] Downloaded report: ${filename}`);
      notify('reportDownloaded', { filename });
    },
  },

  helpers: {
    /**
     * Sets up event listeners for modal buttons
     */
    setupEventListeners() {
      const { closeBtn, doneBtn, downloadBtn, modal } = reportViewer.state.modalElements;

      // Close button
      closeBtn.addEventListener('click', () => {
        reportViewer.actions.hideReport();
      });

      // Done button
      doneBtn.addEventListener('click', () => {
        reportViewer.actions.hideReport();
      });

      // Download button
      downloadBtn.addEventListener('click', () => {
        reportViewer.actions.downloadReport();
      });

      // Close on background click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          reportViewer.actions.hideReport();
        }
      });

      // Close on Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
          reportViewer.actions.hideReport();
        }
      });
    },

    /**
     * Populates the score display section
     * @param {Object} report
     */
    populateScore(report) {
      const { finalScore, scoreLabel } = reportViewer.state.modalElements;

      // Check if vocabulary is unrecognized - show UNKNOWN instead of numeric score
      if (report.hasUnknownVocabulary || report.final_score === null) {
        finalScore.textContent = 'UNKNOWN';
        finalScore.className = 'final-score unknown';
        scoreLabel.textContent = `${report.unknownPercentage || 0}% unrecognized vocabulary`;
        scoreLabel.className = 'score-label unknown';
        return;
      }

      finalScore.textContent = report.final_score.toFixed(1);
      finalScore.className = 'final-score';

      // Determine score category
      let label, cssClass;
      if (report.final_score >= 4.5) {
        label = 'Excellent Ontology!';
        cssClass = 'excellent';
      } else if (report.final_score >= 3.5) {
        label = 'Good Ontology';
        cssClass = 'good';
      } else if (report.final_score >= 2.5) {
        label = 'Fair Ontology';
        cssClass = 'fair';
      } else {
        label = 'Needs Improvement';
        cssClass = 'poor';
      }

      scoreLabel.textContent = label;
      scoreLabel.className = `score-label ${cssClass}`;
    },

    /**
     * Populates the summary section
     * @param {Object} report
     */
    populateSummary(report) {
      const { summaryBfo, summaryPatterns, summaryLogic } = reportViewer.state.modalElements;

      reportViewer.helpers.setSummaryValue(summaryBfo, report.summary.bfo_rooting);
      reportViewer.helpers.setSummaryValue(summaryPatterns, report.summary.pattern_adherence);
      reportViewer.helpers.setSummaryValue(summaryLogic, report.summary.logic_consistency);
    },

    /**
     * Sets a summary value with appropriate CSS class
     * @param {HTMLElement} element
     * @param {string} value
     */
    setSummaryValue(element, value) {
      element.textContent = value;

      // Determine CSS class
      if (value === 'Pass') {
        element.className = 'summary-value pass';
      } else if (value.includes('Unknown')) {
        element.className = 'summary-value unknown';
      } else if (value.includes('Partial')) {
        element.className = 'summary-value partial';
      } else {
        element.className = 'summary-value fail';
      }
    },

    /**
     * Populates the breakdown section
     * @param {Object} report
     */
    populateBreakdown(report) {
      const { breakdown } = report;

      // BFO
      reportViewer.helpers.setBreakdownSection('bfo', breakdown.bfo_rooting);

      // Patterns
      reportViewer.helpers.setBreakdownSection('patterns', breakdown.pattern_adherence);

      // Logic
      reportViewer.helpers.setBreakdownSection('logic', breakdown.logic_consistency);
    },

    /**
     * Sets a breakdown section with score, bar, and details
     * @param {string} name - 'bfo', 'patterns', or 'logic'
     * @param {Object} data - Breakdown data
     */
    setBreakdownSection(name, data) {
      const elements = reportViewer.state.modalElements;
      const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);

      // Check for unknown vocabulary status - applies to ALL validators
      const vocabStatus = data.details?.vocabularyStatus;
      const hasUnknown = vocabStatus?.hasUnknownVocabulary || false;
      const unknownPercentage = vocabStatus?.unknownPercentage || 0;

      // Set score - show "UNKNOWN" for ANY validator when vocabulary is unrecognized
      const scoreElement = elements[`breakdown${capitalizedName}Score`];
      if (hasUnknown) {
        scoreElement.textContent = `UNKNOWN (${unknownPercentage}% unrecognized)`;
        scoreElement.className = 'breakdown-score unknown';
      } else {
        scoreElement.textContent = `${data.score}% (weight: ${(data.weight * 100).toFixed(0)}%)`;
        scoreElement.className = 'breakdown-score';
      }

      // Set progress bar - show orange for unknown portion
      const bar = elements[`breakdown${capitalizedName}Bar`];
      const barParent = bar.parentElement;

      // Remove any existing unknown bar
      const existingUnknownBar = barParent.querySelector('.breakdown-fill-unknown');
      if (existingUnknownBar) {
        existingUnknownBar.remove();
      }

      setTimeout(() => {
        if (hasUnknown) {
          // Show orange bar for unknown portion (applies to all validators)
          bar.style.width = `${vocabStatus.recognizedPercentage}%`;
          bar.className = 'breakdown-fill';

          // Add orange bar for unknown portion
          const unknownBar = document.createElement('div');
          unknownBar.className = 'breakdown-fill-unknown';
          unknownBar.style.width = `${unknownPercentage}%`;
          unknownBar.style.left = `${vocabStatus.recognizedPercentage}%`;
          barParent.appendChild(unknownBar);
        } else {
          bar.style.width = `${data.score}%`;
          bar.className = 'breakdown-fill';
        }
      }, 100); // Delay for animation

      // Set details - show vocabulary message for ALL validators when unknown
      let details;
      if (hasUnknown) {
        details = `${vocabStatus.unknownEntities} entities and ${vocabStatus.unknownPredicates} predicates not in CCO/BFO vocabulary`;
      } else {
        details = `Contribution to final score: ${data.contribution.toFixed(1)} points`;
        if (data.details) {
          if (name === 'bfo') {
            details += ` | ${data.details.rootedClasses}/${data.details.totalClasses} classes rooted`;
          } else if (name === 'patterns') {
            details += ` | ${data.details.violations} violation(s)`;
          } else if (name === 'logic') {
            details += ` | ${data.details.inconsistencies} inconsistency(ies)`;
          }
        }
      }
      elements[`breakdown${capitalizedName}Details`].textContent = details;
    },

    /**
     * Populates the violations section
     * @param {Object} report
     */
    populateViolations(report) {
      const { violationsSection, violationCount, violationsList } = reportViewer.state.modalElements;

      if (report.violations.length === 0) {
        violationsSection.style.display = 'none';
        return;
      }

      violationsSection.style.display = 'block';
      violationCount.textContent = report.violations.length;

      // Clear existing violations
      violationsList.innerHTML = '';

      // Add each violation
      report.violations.forEach(violation => {
        const item = document.createElement('div');
        item.className = `violation-item ${violation.severity}`;

        const typeSpan = document.createElement('span');
        typeSpan.className = `violation-type ${violation.severity}`;
        typeSpan.textContent = violation.type;

        const descSpan = document.createElement('span');
        descSpan.className = 'violation-desc';
        descSpan.textContent = violation.description;

        const entityDiv = document.createElement('div');
        entityDiv.className = 'violation-entity';
        entityDiv.textContent = violation.entity;

        item.appendChild(typeSpan);
        item.appendChild(descSpan);
        item.appendChild(entityDiv);

        violationsList.appendChild(item);
      });
    },

    /**
     * Populates the recommendations section
     * @param {Object} report
     */
    populateRecommendations(report) {
      const { recommendationsList } = reportViewer.state.modalElements;

      // Clear existing recommendations
      recommendationsList.innerHTML = '';

      // Add each recommendation
      report.recommendations.forEach(rec => {
        const li = document.createElement('li');
        li.textContent = rec;

        // Mark positive recommendations
        if (rec.includes('🎉') || rec.includes('Excellent')) {
          li.classList.add('positive');
        }

        recommendationsList.appendChild(li);
      });
    },

    /**
     * Populates the metadata footer
     * @param {Object} report
     */
    populateMetadata(report) {
      const { timestamp } = reportViewer.state.modalElements;

      const date = new Date(report.timestamp);
      timestamp.textContent = `Generated: ${date.toLocaleString()}`;
    },
  },

  subscribe(fn) {
    subscribers.add(fn);
  },

  unsubscribe(fn) {
    subscribers.delete(fn);
  },

  notify, // Expose for testing
};
