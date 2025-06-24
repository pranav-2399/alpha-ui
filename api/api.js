import { API_BASE } from '../state/state.js';

export async function fetchProjects() {
    return fetch(`${API_BASE}/projects`).then(r => r.json());
}
export async function fetchEnvironments() {
    return fetch(`${API_BASE}/environments`).then(r => r.json());
}
export async function fetchServers() {
    return fetch(`${API_BASE}/servers`).then(r => r.json());
}
export async function fetchAnalysis() {
    return fetch(`${API_BASE}/analysis`).then(r => r.json());
}
export async function fetchLogsForProject(project, tool, filters = {}) {
    let url = `${API_BASE}/logs?project=${encodeURIComponent(project)}&tool=${encodeURIComponent(tool)}`;
    if (filters.environment) url += `&environment=${encodeURIComponent(filters.environment)}`;
    if (filters.server) url += `&server=${encodeURIComponent(filters.server)}`;
    if (filters.severity) url += `&severity=${encodeURIComponent(filters.severity)}`;
    if (filters.logType) url += `&logType=${encodeURIComponent(filters.logType)}`;
    return fetch(url).then(r => r.json());
}