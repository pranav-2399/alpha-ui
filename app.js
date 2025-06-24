import {
  currentView, currentProject, projects, analysisData, chatMessages,
  currentLogTypeFilter, availableLogTypes, sessionId, currentEnv,
  currentServer, currentSeverity, currentTool, currentTimeFilter,
  currentTimeGranularity, API_BASE,
  setCurrentView, setCurrentProject, setProjects, setAnalysisData, setChatMessages,
  setCurrentLogTypeFilter, setAvailableLogTypes, setSessionId, setCurrentEnv,
  setCurrentServer, setCurrentSeverity, setCurrentTool, setCurrentTimeFilter,
  setCurrentTimeGranularity
} from './state/state.js';
import { 
    initializeApp, renderProjectCards, createProjectCard, bindEventListeners, bindTimeFilterEvents 
} from './ui/dashboard.js';
import { 
    buildProjectStats, calculateLLMCoverage 
} from '../utils/metrics.js';
import { 
    getAvailableEnvironments, getAvailableServers, getAvailableSeverities 
} from '../utils/filters.js';
import { 
    updateServerFilter, updateEnvironmentTabs
} from './ui/filters.js';
import { 
    renderMetricsCharts, renderSuccessTrendChart, renderLogTypeChart, renderErrorTimelineChart, renderQualityMetricsChart, renderBuildDurationChart, renderTestCoverageChart, renderDeploymentFrequencyChart, renderMTTRChart, renderSeverityTimelineChart 
} from './ui/charts.js';
import { 
    renderMetricCards, renderBusinessImpactCard, renderConfidenceScoreCard, renderTechnicalComplexityCard, renderSecurityMetricsCard, renderTechnicalDebtCard
} from './ui/metricsCards.js';
import { 
    showProjectDetail, fetchLogsForProject, renderLogAnalysis 
} from './ui/project.js';
import { 
    showLoading, hideLoading, showError 
} from './ui/loading.js';
import { 
    formatToolName, formatServerName, formatTimestamp, formatEnvironmentName 
} from '../utils/format.js';

const ENVIRONMENTS = ['dev', 'staging', 'prod', 'test'];

document.addEventListener('DOMContentLoaded', initializeApp);

// Global chart instances
let chartInstances = {
    successTrend: null,
    logType: null,
    errorTimeline: null,
    qualityMetrics: null,
    buildDuration: null,
    testCoverage: null,
    codeQuality: null,
    deploymentFrequency: null,
    mttr: null,
    severityTimeline: null
};