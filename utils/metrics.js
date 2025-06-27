import { extractSeverityLevel } from "../utils/filters.js";

export async function buildProjectStats(projectNames, analysisArr) {
    // Get all unique (project, tool) pairs
    const pairs = [];
    projectNames.forEach(name => {
        const tools = Array.from(
            new Set(
                analysisArr
                    .filter(a => a.project === name)
                    .map(a => a.tool)
                    .filter(Boolean)
            )
        );
        tools.forEach(tool => {
            pairs.push({ name, tool });
        });
    });

    // Build stats for each (project, tool) pair
    return pairs.map(({ name, tool }) => {
        const projectAnalyses = analysisArr.filter(a => a.project === name && a.tool === tool);
        const count = projectAnalyses.length;
        let successCount = 0;
        let errorCount = 0;
        let latestTimestamp = null;
        projectAnalyses.forEach(a => {
            if (a.status === 'success') successCount++;
            else errorCount++;
            if (!latestTimestamp || new Date(a.timestamp) > new Date(latestTimestamp)) {
                latestTimestamp = a.analysis_timestamp;
            }
        });
        const success_rate = count ? (successCount / count) * 100 : 0;
        let status = 'success';
        if (errorCount > 0) status = 'error';
        else if (success_rate < 70 && success_rate >= 50) status = 'warning';
        return {
            name,
            tool,
            count,
            success_rate: Math.round(success_rate * 10) / 10,
            latest_timestamp: latestTimestamp,
            status,
            status_counts: { error: errorCount, success: successCount }
        };
    });
}

export function calculateLLMCoverage(logs) {
    if (!logs || logs.length === 0) return 0;
    const withLLM = logs.filter(log => log.llm_response && log.llm_response.trim() !== '').length;
    return ((withLLM / logs.length) * 100).toFixed(1);
}

export function processMetricsFromLogs(logs) {
    // DEBUG: Log the first few logs and their key fields for metrics
    if (logs && logs.length) {
        console.log('All logs for metrics:', logs);
/*         logs.slice(0,3).forEach((log, i) => {
            console.log(`Log #${i+1} type:`, getLogType(log), 'build_success:', log.build_success, 'build_duration_seconds:', log.build_duration_seconds, 'deployment_success:', log.deployment_success, 'test_coverage:', log.test_coverage, 'code_coverage:', log.code_coverage);
        }); */
        logs.forEach((log, i) => {
            console.log(`Log #${i+1} type:`, getLogType(log), 'build_success:', log.build_success, 'build_duration_seconds:', log.build_duration_seconds, 'deployment_success:', log.deployment_success, 'test_coverage:', log.test_coverage, 'code_coverage:', log.code_coverage);
        });
    }
    const metrics = {
        build: { success: 0, total: 0, durations: [], errors: [], warnings: [] },
        deployment: { success: 0, total: 0, durations: [], errors: [] },
        test: { coverage: [], cases: [], failures: [], errors: [] },
        sonarqube: { coverage: [], bugs: [], vulnerabilities: [], debt: [] },
        git: { errors: [], fatal: 0 },
        timeline: []
    };
    logs.forEach(log => {
        const summary = log.executive_summary || log.llm_response || '';
        const logType = getLogType(log);
        const timestamp = new Date(log.timestamp);
        // Build metrics
        if (logType === 'build') {
            metrics.build.total++;
            let buildSuccess = log.build_success;
            if (buildSuccess == null) buildSuccess = /build (success|successful)/i.test(summary);
            if (buildSuccess) metrics.build.success++;

            let buildDuration = log.build_duration_seconds;
            if (buildDuration == null) buildDuration = extractBuildDuration(summary); // as string
            if (typeof buildDuration === 'string') buildDuration = parseDurationString(buildDuration);
            if (buildDuration) metrics.build.durations.push(buildDuration);
            if (log.build_error_count) metrics.build.errors.push(log.build_error_count);
            if (log.build_warning_count) metrics.build.warnings.push(log.build_warning_count);
        }
        // Deployment metrics
        if (logType === 'deployment') {
            metrics.deployment.total++;
            let deploySuccess = log.deployment_success;
            if (deploySuccess == null) deploySuccess = /deployment completed successfully/i.test(summary);
            if (deploySuccess) metrics.deployment.success++;
            let deployDuration = log.deployment_duration;
            if (deployDuration == null) deployDuration = extractDeploymentDuration(summary);
            if (typeof deployDuration === 'string') deployDuration = parseDurationString(deployDuration);
            if (deployDuration) metrics.deployment.durations.push(deployDuration);
            if (log.deployment_error_count) metrics.deployment.errors.push(log.deployment_error_count);
        }
        // Test metrics
        if (logType === 'test') {
            let coverage = log.test_coverage;
            if (coverage == null) coverage = extractTestCoverage(summary);
            if (coverage != null) metrics.test.coverage.push(coverage);
            if (log.test_cases_found) metrics.test.cases.push(log.test_cases_found);
            if (log.test_error_count) metrics.test.errors.push(log.test_error_count);
        }
        // SonarQube metrics
        if (logType === 'sonarqube') {
            let codeCoverage = log.code_coverage;
            if (codeCoverage == null) codeCoverage = extractCodeCoverage(summary);
            if (codeCoverage != null) metrics.sonarqube.coverage.push(codeCoverage);
            let bugs = log.bugs;
            if (bugs == null) bugs = extractSonarBugs(summary);
            if (bugs != null) metrics.sonarqube.bugs.push(bugs);
            let vulns = log.vulnerabilities;
            if (vulns == null) vulns = extractSonarVulns(summary);
            if (vulns != null) metrics.sonarqube.vulnerabilities.push(vulns);
            let smells = log.code_smells;
            if (smells == null) smells = extractSonarCodeSmells(summary);
            if (smells != null) metrics.sonarqube.code_smells = metrics.sonarqube.code_smells || [];
            if (smells != null) metrics.sonarqube.code_smells.push(smells);
            let qg = log.quality_gate_passed;
            if (qg == null) qg = extractQualityGate(summary);
            if (qg) metrics.sonarqube.quality_gate_passed = (metrics.sonarqube.quality_gate_passed || 0) + 1;
        }
        // Timeline data
        // Enhanced timeline processing with better error extraction
    metrics.timeline.push({
    timestamp,
    logType,
    success: getLogTypeSpecificSuccess(log, logType),
    errorCount: extractTotalErrorCount(log, logType), // Enhanced error extraction
    severity: extractSeverityLevel(log.severity_level || log.severity),
    deploymentSuccess: logType === 'deployment' ? getLogTypeSpecificSuccess(log, logType) : null,
    buildSuccess: logType === 'build' ? getLogTypeSpecificSuccess(log, logType) : null
    
});

    });
    return metrics;
}

function extractTotalErrorCount(log, logType) {
    let totalErrors = log.error_count || 0;
    
    // Add type-specific error counts
    switch (logType) {
        case 'build':
            totalErrors += (log.build_error_count || 0) + (log.build_warning_count || 0);
            break;
        case 'deployment':
            totalErrors += (log.deployment_error_count || 0);
            if (log.deployment_fatal) totalErrors += 1;
            break;
        case 'test':
            totalErrors += (log.test_error_count || 0) + (log.test_failures || 0);
            break;
        case 'sonarqube':
            totalErrors += (log.bugs || 0) + (log.vulnerabilities || 0);
            break;
        case 'git':
            totalErrors += (log.git_errors ? log.git_errors.length : 0);
            if (log.git_fatal) totalErrors += 1;
            break;
    }
    
    // Extract errors from summary text if no explicit counts
    if (totalErrors === 0) {
        const summary = log.executive_summary || log.llm_response || '';
        const errorMatches = summary.match(/ERROR:/g) || [];
        const failureMatches = summary.match(/FAILED:/g) || [];
        const fatalMatches = summary.match(/FATAL:/g) || [];
        totalErrors = errorMatches.length + failureMatches.length + fatalMatches.length;
    }
    
    return totalErrors;
}

function getLogTypeSpecificSuccess(log, logType) {
    const summary = log.executive_summary || log.llm_response || '';
    
    switch (logType) {
        case 'build':
            return log.build_success !== undefined ? 
                log.build_success : 
                /build (success|successful)/i.test(summary);
                
        case 'deployment':
            return log.deployment_success !== undefined ? 
                log.deployment_success : 
                /deployment completed successfully/i.test(summary);
                
        case 'test':
            return log.test_pass_rate !== undefined ? 
                log.test_pass_rate > 80 : 
                !/test.*fail/i.test(summary);
                
        case 'sonarqube':
            return log.quality_gate_passed !== undefined ? 
                log.quality_gate_passed : 
                !/quality gate failed/i.test(summary);
                
        default:
            return log.status === 'success';
    }
}

export function getLogType(log) {
    if (log.log_type && typeof log.log_type === 'string' && log.log_type.trim()) {
        return log.log_type.trim().toLowerCase();
    }
    if (log.tool && typeof log.tool === 'string' && log.tool.trim()) {
        const tool = log.tool.toLowerCase();
        if (tool.includes('sonar')) return 'sonarqube';
        if (tool.includes('test')) return 'test';
        if (tool.includes('build')) return 'build';
        if (tool.includes('deploy')) return 'deployment';
        if (tool.includes('git')) return 'git';
        if (tool === 'github_actions') {
            const summary = (log.executive_summary || log.llm_response || '').toLowerCase();
            if (/sonarqube|quality gate/.test(summary)) return 'sonarqube';
            if (/test(ing|s|ed)/.test(summary)) return 'test';
            if (/build/.test(summary)) return 'build';
            if (/deploy/.test(summary)) return 'deployment';
        }
        return tool;
    }
    return 'unknown';
}

export function extractTestCoverage(summary) {
    if (!summary) return null;
    const match = summary.match(/(?:Test\s+coverage|Coverage):\s*([\d.]+)%/i);
    return match ? parseFloat(match[1]) : null;
}

function extractCodeCoverage(summary) {
    if (!summary) return null;
    const match = summary.match(/code coverage:?\s*(\d+\.?\d*)%/i);
    return match ? parseFloat(match[1]) : null;
}

function extractBuildDuration(summary) {
    if (!summary) return null;
    const match = summary.match(/build time:?\s*([\dhms :]+)/i) || summary.match(/total time:?\s*([\dhms :]+)/i);
    return match ? match[1] : null;
}

function extractDeploymentDuration(summary) {
    if (!summary) return null;
    const match = summary.match(/deployment duration:?\s*([\dhms :]+)/i);
    return match ? match[1] : null;
}

export function extractSonarBugs(summary) {
    if (!summary) return null;
    const match = summary.match(/bugs:?\s*(\d+)/i);
    return match ? parseInt(match[1]) : null;
}

export function extractSonarVulns(summary) {
    if (!summary) return null;
    const match = summary.match(/vulnerabilities:?\s*(\d+)/i);
    return match ? parseInt(match[1]) : null;
}

export function extractSonarCodeSmells(summary) {
    if (!summary) return null;
    const match = summary.match(/code smells:?\s*(\d+)/i);
    return match ? parseInt(match[1]) : null;
}

function extractQualityGate(summary) {
    if (!summary) return null;
    return !/quality gate failed/i.test(summary);
}

export function parseDurationString(str) {
    if (!str) return 0;
    let total = 0;
    const minMatch = str.match(/(\d+)\s*m/);
    const secMatch = str.match(/(\d+)\s*s/);
    if (minMatch) total += parseInt(minMatch[1], 10) * 60;
    if (secMatch) total += parseInt(secMatch[1], 10);
    return total;
}

export function formatDuration(seconds) {
    if (isNaN(seconds) || seconds === 0) return "N/A";
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m > 0 ? m + "m " : ""}${s}s`;
}