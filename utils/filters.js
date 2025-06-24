import { currentLogTypeFilter } from '../state/state.js';

export function getAvailableEnvironments(logs) {
    const envs = [...new Set(logs.map(log => log.environment).filter(Boolean))];
    return envs.sort();
}

export function getAvailableServers(logs, environment = null) {
    let filteredLogs = logs;
    if (environment) {
        filteredLogs = logs.filter(log => log.environment === environment);
    }
    const servers = [...new Set(filteredLogs.map(log => log.server).filter(Boolean))];
    return servers.sort();
}

export function getAvailableSeverities(logs, environment = null, server = null) {
    let filteredLogs = logs;
    if (environment) {
        filteredLogs = filteredLogs.filter(log => log.environment === environment);
    }
    if (server) {
        filteredLogs = filteredLogs.filter(log => log.server === server);
    }
    const severities = [...new Set(filteredLogs.map(log => {
        const severityText = log.severity_level || log.severity;
        return extractSeverityLevel(severityText);
    }).filter(severity => severity !== 'unknown'))];
    return severities.sort();
}

export function filterLogs(logs, env, server, severity) {
    return logs.filter(log => {
        if (env && log.environment !== env) return false;
        if (server && log.server !== server) return false;
        if (severity) {
            const severityText = (log.severity_level || log.severity || '').toLowerCase();
            console.log("Log severity:", severityText);
            if (!severityText.includes(severity.toLowerCase())) return false;
        }
        return true;
    });
}

export function extractSeverityLevel(severityText) {
    if (!severityText) return 'unknown';
    
    const severityLower = severityText.toLowerCase();
    
    // Check for each severity level in the text
    if (severityLower.includes('critical')) return 'critical';
    if (severityLower.includes('high')) return 'high';
    if (severityLower.includes('medium')) return 'medium';
    if (severityLower.includes('low')) return 'low';
    
    return 'unknown';
}