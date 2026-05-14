let currentTrace = null;

function startTrace(name) {
    currentTrace = {
        name,
        startTime: performance.now(),
        steps: [],
    };
    console.log(`[TRACE START] ${name}`);
}

function logStep(stepName, details = '') {
    if (currentTrace) {
        const timeSinceStart = (performance.now() - currentTrace.startTime).toFixed(2);
        currentTrace.steps.push({ stepName, time: timeSinceStart, details });
        console.log(`[TRACE STEP] ${stepName} (+${timeSinceStart}ms)`, details);
    }
}

function endTrace() {
    if (currentTrace) {
        const totalTime = (performance.now() - currentTrace.startTime).toFixed(2);
        console.log(`[TRACE END] ${currentTrace.name} (Total: ${totalTime}ms)`);
        currentTrace = null;
    }
}

export const tracer = { startTrace, logStep, endTrace };