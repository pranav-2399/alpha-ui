export function formatToolName(name) {
    return name ? name.toString() : '';
}

export function formatServerName(name) {
    return name ? name.toString() : '';
}

export function formatTimestamp(ts) {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleString();
}

export function formatEnvironmentName(env) {
    if (typeof formatToolName === 'function') {
        return formatToolName(env);
    }
    // Fallback formatting: capitalize first letter and replace underscores/hyphens with spaces
    return env.charAt(0).toUpperCase() + env.slice(1).replace(/[_-]/g, ' ');
}

export function getLogTypeColor(logType) {
    const colors = {
        'build': '#1e40af',
        'deployment': '#059669',
        'test': '#7c3aed',
        'sonarqube': '#dc2626',
        'github_actions': '#374151',
        'git': '#6b7280'
    };
    return colors[logType] || '#6b7280';
}

export function getSeverityColor(severity) {
    const colors = {
        'critical': '#dc3545',
        'high': '#fd7e14', 
        'medium': '#ffc107',
        'low': '#28a745'
    };
    return colors[severity] || '#6c757d';
}
