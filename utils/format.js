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

export function getGradientColor(value, min, max) {
    // Returns [mainColor, accentColor] for use in linear-gradient
    if (isNaN(value)) return ['#6c757d', '#495057']; // fallback gray

    let t = (value - min) / (max - min);
    t = Math.max(0, Math.min(1, t));

    let r, g, b;
    if (t < 0.5) {
        // Green to yellow
        r = Math.round(40 + (255 - 40) * (t * 2));
        g = Math.round(167 + (193 - 167) * (t * 2));
        b = Math.round(69 + (7 - 69) * (t * 2));
    } else {
        // Yellow to red
        r = Math.round(255 + (220 - 255) * ((t - 0.5) * 2));
        g = Math.round(193 + (53 - 193) * ((t - 0.5) * 2));
        b = Math.round(7 + (69 - 7) * ((t - 0.5) * 2));
    }
    // Main color
    const mainColor = `rgb(${r},${g},${b})`;
    // Accent color: slightly darker (multiply by 0.85)
    const accent = 0.85;
    const dr = Math.round(r * accent);
    const dg = Math.round(g * accent);
    const db = Math.round(b * accent);
    const accentColor = `rgb(${dr},${dg},${db})`;

    return [mainColor, accentColor];
}

export function formatDuration(seconds) {
    if (isNaN(seconds) || seconds === 0) return "N/A";
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m > 0 ? m + "m " : ""}${s}s`;
}