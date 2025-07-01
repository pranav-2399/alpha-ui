export let currentView = 'dashboard';
export let currentProject = null;
export let projects = [];
export let analysisData = [];
export let chatMessages = [];
export let currentLogTypeFilter = '';
export let availableLogTypes = [];
export let sessionId = 'session_' + Date.now();
export let currentEnv = '';
export let currentServer = '';
export let currentSeverity = '';
export let currentTool = '';
export let currentTimeFilter = '';
export let currentTimeGranularity = 'hour';
export const API_BASE = `http://localhost:4000/api`;

// To update state from other modules, export setter functions:
export function setCurrentView(view) { currentView = view; }
export function setProjects(p) { projects = p; }
export function setCurrentProject(p) { currentProject = p; }
export function setAnalysisData(data) { analysisData = data; }
export function setChatMessages(msgs) { chatMessages = msgs; }
export function setCurrentLogTypeFilter(f) { currentLogTypeFilter = f; }
export function setAvailableLogTypes(types) { availableLogTypes = types; }
export function setSessionId(id) { sessionId = id; }
export function setCurrentEnv(env) { currentEnv = env; }
export function setCurrentServer(server) { currentServer = server; }
export function setCurrentSeverity(sev) { currentSeverity = sev; }
export function setCurrentTool(t) { currentTool = t; }
export function setCurrentTimeFilter(f) { currentTimeFilter = f; }
export function setCurrentTimeGranularity(g) { currentTimeGranularity = g; }


export function getCurrentEnv() { return currentEnv; }
export function getCurrentServer() { return currentServer; }
export function getCurrentSeverity() { return currentSeverity; }