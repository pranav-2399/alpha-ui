import { 
    fetchProjects, fetchEnvironments, fetchServers, fetchAnalysis 
} from '../api/api.js';
import { 
    sendChatMessage 
} from '../chatbot/chatbot.js';
import {
  currentView, currentProject, currentTool, setCurrentView, setCurrentProject, setCurrentEnv, setCurrentServer, setCurrentSeverity, setCurrentTool, setProjects, setAnalysisData, projects,
  setCurrentLogTypeFilter
} from '../state/state.js';
import { 
    formatToolName, formatTimestamp 
} from '../utils/format.js';
import { 
    buildProjectStats, getLogType 
} from '../utils/metrics.js';
import { 
    handleServerChange 
} from './filters.js';
import { 
    showLoading, hideLoading, showError 
} from './loading.js';
import { 
    showProjectDetail, fetchLogsForProject, renderLogAnalysis 
} from './project.js';

document.addEventListener('DOMContentLoaded', async function() {
    await initializeApp();
    bindEventListeners();
    bindTimeFilterEvents();
});

export async function initializeApp() {
    try {
        // Fetch projects, environments, and servers from Elasticsearch via proxy
        const [projectsArr, envArr, serversArr, analysisArr] = await Promise.all([
            fetchProjects(),
            fetchEnvironments(),
            fetchServers(),
            fetchAnalysis()
        ]);
        setProjects(await buildProjectStats(projectsArr, analysisArr));
        window.environments = envArr;
        window.servers = serversArr;
        setAnalysisData(analysisArr);

        loadDashboardData();
        
        showView('dashboard');
        document.getElementById('dashboardView').classList.remove('hidden');
    } catch (err) {
        showError('Failed to initialize application: ' + err.message);
    }
}

function renderProjectCards() {
    const grid = document.getElementById('projectsGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    console.log("Rendering projects:", projects);
    projects.forEach(project => {
        console.log("Project card data:", project);
        const card = createProjectCard(project);
        grid.appendChild(card);
    });
}

function createProjectCard(project) {
    console.log("Creating card for project:", project.name, "tool:", project.tool);
    const card = document.createElement('div');
    card.className = 'project-card';
    card.onclick = () => showProjectDetail(project.name, project.tool);

    const toolBadge = `<span class="tool-badge">${formatToolName(project.tool)}</span>`;
    
    const statusClass = project.status;
    const successRateClass = project.success_rate >= 70 ? 'success' : 
                            project.success_rate >= 50 ? 'warning' : 'error';

    card.innerHTML = `
        <div class="project-card-header">
            <div>
                <h3 class="project-name">${project.name}</h3>
                <div class="project-tools">${toolBadge}</div>
            </div>
            <div class="status-badge ${statusClass}">${project.status}</div>
        </div>
        
        <div class="project-metrics">
            <div class="metric">
                <span class="metric-value">${project.count}</span>
                <span class="metric-label">Total Builds</span>
            </div>
            <div class="metric">
                <span class="metric-value success-rate ${successRateClass}">${project.success_rate}%</span>
                <span class="metric-label">Success Rate</span>
            </div>
        </div>
        
        <div class="project-footer">
            <small style="color: #9ca3af">Last Build: ${formatTimestamp(project.latest_timestamp)}</small>
        </div>
    `;    
    return card;
}

function bindEventListeners() {
    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshData);
    }
    
    // Breadcrumb navigation
    const breadcrumb = document.getElementById('breadcrumb');
    if (breadcrumb) {
        breadcrumb.addEventListener('click', handleBreadcrumbClick);
    }
    
    // Server filter
    const serverFilter = document.getElementById('serverFilter');
    if (serverFilter) {
        serverFilter.onchange = handleServerChange;
    }
    
    // Chatbot event listeners
    const chatbotToggle = document.getElementById('chatbotToggle');
    const closeChatbot = document.getElementById('closeChatbot');
    const modalBackdrop = document.getElementById('modalBackdrop');
    const sendMessage = document.getElementById('sendMessage');
    const chatInput = document.getElementById('chatInput');
    
    if (chatbotToggle) chatbotToggle.addEventListener('click', openChatbot);
    if (closeChatbot) closeChatbot.addEventListener('click', closeChatbot);
    if (modalBackdrop) modalBackdrop.addEventListener('click', closeChatbot);
    if (sendMessage) sendMessage.addEventListener('click', sendChatMessage);
    if (chatInput) {
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendChatMessage();
            }
        });
    }
}

function bindTimeFilterEvents() {
    const timeButtons = document.querySelectorAll('.time-filter-btn');
    timeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            timeButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            // Optionally update inline styles for active/inactive
            timeButtons.forEach(b => {
                if (b.classList.contains('active')) {
                    b.style.background = '#6366f1';
                    b.style.color = '#fff';
                    b.style.border = '1px solid #6366f1';
                    b.style.boxShadow = '0 4px 16px rgba(99,102,241,0.12)';
                } else {
                    b.style.background = '#2d2d2d';
                    b.style.color = '#fff';
                    b.style.border = '1px solid #404040';
                    b.style.boxShadow = 'none';
                }
            });
            // Update filter state and reload dashboard data
            currentTimeFilter = this.getAttribute('data-range');
            loadDashboardData();
        });
    });
}

export function showView(viewName) {
    document.querySelectorAll('.view').forEach(view => {
        view.classList.add('hidden');
    });

    const targetView = document.getElementById(viewName + 'View');
    if (targetView) {
        targetView.classList.remove('hidden');
    }

    setCurrentView(viewName);
    updateBreadcrumb();
}

function updateBreadcrumb() {
    const breadcrumb = document.getElementById('breadcrumb');
    if (!breadcrumb) return;
    
    if (currentView === 'dashboard') {
        breadcrumb.innerHTML = '<span class="breadcrumb-item active">Dashboard</span>';
    } else if (currentView === 'project') {
        breadcrumb.innerHTML = `
            <span class="breadcrumb-item" onclick="showDashboard()">Dashboard</span>
            <span class="breadcrumb-separator">></span>
            <span class="breadcrumb-item active">${currentProject}</span>
        `;
    }
}

function handleBreadcrumbClick(e) {
    if (e.target.classList.contains('breadcrumb-item') && !e.target.classList.contains('active')) {
        showDashboard();
    }
}

function showDashboard() {
    // Reset filters when going back to dashboard
    setCurrentEnv('')
    setCurrentServer('');
    setCurrentSeverity('');
    setCurrentProject(null);
    setCurrentTool('');
    
    showView('dashboard');
    loadDashboardData();
}

function loadDashboardData() {
    showLoading();

    // Simulate API delay
    setTimeout(() => {
        try {
            renderDashboard();
        } catch (error) {
            showError('Failed to load dashboard data');
        } finally {
            hideLoading();
        }
    }, 500);
}

function renderDashboard() {
    updateDashboardStats();
    renderProjectCards();
    /* updateAlertPanel(window.originalLogs); */
}

function updateDashboardStats() {
    const totalProjects = projects.length;
    const activeBuilds = projects.reduce((sum, p) => sum + p.count, 0);
    const overallSuccessRate = projects.length > 0 ? 
        projects.reduce((sum, p) => sum + p.success_rate, 0) / projects.length : 0;
    
    const totalProjectsEl = document.getElementById('totalProjects');
    const activeBuildsEl = document.getElementById('activeBuilds');
    const successRateEl = document.getElementById('successRate');
    
    if (totalProjectsEl) totalProjectsEl.textContent = totalProjects;
    if (activeBuildsEl) activeBuildsEl.textContent = activeBuilds;
    if (successRateEl) successRateEl.textContent = Math.round(overallSuccessRate) + '%';
}

export function createMetricsDashboard() {
    let metricsSection = document.getElementById('metricsSection');
    if (!metricsSection) {
        metricsSection = document.createElement('div');
        metricsSection.id = 'metricsSection';
        metricsSection.className = 'metrics-dashboard';
        metricsSection.style = `
            margin: 2rem 0;
            padding: 2rem;
            background: linear-gradient(135deg, #1a1d29 0%, #2d3748 100%);
            border-radius: 12px;
            border: 1px solid #4a5568;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        `;
        
        const analysisSection = document.querySelector('.analysis-section');
        const analysisGrid = document.getElementById('analysisGrid');
        if (analysisSection && analysisGrid) {
            analysisSection.insertBefore(metricsSection, analysisGrid);
        }
    }
    
    metricsSection.innerHTML = `
        <div class="metrics-header" style="
            margin-bottom: 2rem; 
            text-align: center;
        ">
            <h2 style="
                color: #00d4aa; 
                font-size: 1.8rem; 
                margin: 0 0 0.5rem 0; 
                font-weight: 700;
            ">
                📊 Performance Metrics Dashboard
            </h2>
            <p style="
                color: #a0aec0; 
                margin: 0; 
                font-size: 1rem;
            ">
                Real-time insights and analytics
            </p>
        </div>
        
        <!-- Key Metrics Cards -->
        <div class="metrics-cards-grid" style="
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        ">
            <div id="successRateCard" class="metric-card"></div>
            <div id="avgDurationCard" class="metric-card"></div>
            <div id="errorRateCard" class="metric-card"></div>
            <div id="coverageCard" class="metric-card"></div>
        </div>

        <!-- Existing Charts Grid -->
        <div class="charts-grid" style="
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2rem;
            margin-bottom: 2rem;
        ">
            <div class="chart-container" style="
                background: rgba(255,255,255,0.05);
                border-radius: 12px;
                padding: 1.5rem;
                border: 1px solid rgba(255,255,255,0.1);
                height: 400px;
            ">
                <h3 style="
                    color: #e2e8f0; 
                    margin: 0 0 1rem 0; 
                    font-size: 1.2rem;
                ">
                    Deployment Success Trend
                </h3>
                <canvas id="successTrendChart" style="max-height: 300px"></canvas>
            </div>
            
            <div class="chart-container" style="
                background: rgba(255,255,255,0.05);
                border-radius: 12px;
                padding: 1.5rem;
                border: 1px solid rgba(255,255,255,0.1);
            ">
                <h3 style="
                    color: #e2e8f0; 
                    margin: 0 0 1rem 0; 
                    font-size: 1.2rem;
                ">
                    Log Type Distribution
                </h3>
                <canvas id="logTypeChart" style="max-height: 300px"></canvas>
            </div>
        </div>
        
        <!-- New Specialized Charts Grid -->
        <div class="specialized-charts-grid" style="
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2rem;
            margin-bottom: 2rem;
        ">
            <div class="chart-container" style="
                background: rgba(255,255,255,0.05);
                border-radius: 12px;
                padding: 1.5rem;
                border: 1px solid rgba(255,255,255,0.1);
                height: 400px;
            ">
                <h3 style="
                    color: #e2e8f0; 
                    margin: 0 0 1rem 0; 
                    font-size: 1.2rem;
                ">
                    Build Duration Trends
                </h3>
                <canvas id="buildDurationChart" style="max-height: 300px"></canvas>
            </div>
            
            <div class="chart-container" style="
                background: rgba(255,255,255,0.05);
                border-radius: 12px;
                padding: 1.5rem;
                border: 1px solid rgba(255,255,255,0.1);
                height: 400px;
            ">
                <h3 style="
                    color: #e2e8f0; 
                    margin: 0 0 1rem 0; 
                    font-size: 1.2rem;
                ">
                    Test Coverage Progression
                </h3>
                <canvas id="testCoverageChart" style="max-height: 300px"></canvas>
            </div>
        </div>
        
        <div class="specialized-charts-grid" style="
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2rem;
            margin-bottom: 2rem;
        ">
            <div class="chart-container" style="
                background: rgba(255,255,255,0.05);
                border-radius: 12px;
                padding: 1.5rem;
                border: 1px solid rgba(255,255,255,0.1);
                height: 400px;
            ">
                <h3 style="
                    color: #e2e8f0; 
                    margin: 0 0 1rem 0; 
                    font-size: 1.2rem;
                ">
                    Code Quality Trends
                </h3>
                <canvas id="codeQualityChart" style="max-height: 300px"></canvas>
            </div>
            
            <div class="chart-container" style="
                background: rgba(255,255,255,0.05);
                border-radius: 12px;
                padding: 1.5rem;
                border: 1px solid rgba(255,255,255,0.1);
                height: 400px;
            ">
                <h3 style="
                    color: #e2e8f0; 
                    margin: 0 0 1rem 0; 
                    font-size: 1.2rem;
                ">
                    Deployment Frequency
                </h3>
                <canvas id="deploymentFrequencyChart" style="max-height: 300px"></canvas>
            </div>
        </div>
        
        <div class="charts-grid" style="
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2rem;
        ">
            <div class="chart-container" style="
                background: rgba(255,255,255,0.05);
                border-radius: 12px;
                padding: 1.5rem;
                border: 1px solid rgba(255,255,255,0.1);
                height: 400px;
            ">
                <h3 style="
                    color: #e2e8f0; 
                    margin: 0 0 1rem 0; 
                    font-size: 1.2rem;
                ">
                    Error Count Timeline
                </h3>
                <canvas id="errorTimelineChart" style="max-height: 300px"></canvas>
            </div>
            
            <div class="chart-container" style="
                background: rgba(255,255,255,0.05);
                border-radius: 12px;
                padding: 1.5rem;
                border: 1px solid rgba(255,255,255,0.1);
            ">
                <h3 style="
                    color: #e2e8f0; 
                    margin: 0 0 1rem 0; 
                    font-size: 1.2rem;
                ">
                    Quality Metrics
                </h3>
                <canvas id="qualityMetricsChart" style="max-height: 300px"></canvas>
            </div>
        </div>
        
        <!-- MTTR and Performance Charts -->
        <div class="performance-charts-grid" style="
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2rem;
            margin-top: 2rem;
        ">
            <div class="chart-container" style="
                background: rgba(255,255,255,0.05);
                border-radius: 12px;
                padding: 1.5rem;
                border: 1px solid rgba(255,255,255,0.1);
                height: 400px;
            ">
                <h3 style="
                    color: #e2e8f0; 
                    margin: 0 0 1rem 0; 
                    font-size: 1.2rem;
                ">
                    MTTR Trends
                </h3>
                <canvas id="mttrChart" style="max-height: 300px"></canvas>
            </div>
            
            <div class="chart-container" style="
                background: rgba(255,255,255,0.05);
                border-radius: 12px;
                padding: 1.5rem;
                border: 1px solid rgba(255,255,255,0.1);
                height: 400px;
            ">
                <h3 style="
                    color: #e2e8f0; 
                    margin: 0 0 1rem 0; 
                    font-size: 1.2rem;
                ">
                    Severity Distribution Timeline
                </h3>
                <canvas id="severityTimelineChart" style="max-height: 300px"></canvas>
            </div>
        </div>
    `;
}

export function updateLogTypeFilterCounts(logCounts, currentLogTypeFilter = '') {
    const countElements = {
        'allLogsCount': logCounts.all,
        'buildLogsCount': logCounts.build,
        'deployLogsCount': logCounts.deployment,
        'testLogsCount': logCounts.test,
        'sonarqubeLogsCount': logCounts.sonarqube,
    };
    
    Object.entries(countElements).forEach(([elementId, count]) => {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = count || 0;
        }
    });
    
    // Update filtered logs count display
    const filteredCountElement = document.getElementById('filteredLogsCount');
    if (filteredCountElement) {
        let filteredCount = logCounts.all;
        if (currentLogTypeFilter && logCounts.hasOwnProperty(currentLogTypeFilter)) {
            filteredCount = logCounts[currentLogTypeFilter];
        }
        console.log("filtered count:", filteredCount);
        filteredCountElement.textContent = filteredCount;
    }
}

function getCurrentTool() {
    const projectTitle = document.getElementById('projectTitle');
    return projectTitle ? projectTitle.dataset.tool || currentTool : currentTool;
}

function refreshData() {
    // Reload dashboard data and hide error state if visible
    const errorState = document.getElementById('errorState');
    if (errorState) errorState.classList.add('hidden');
    
    if (currentView === 'dashboard') {
        loadDashboardData();
    } else if (currentView === 'project') {
        loadAnalysisData();
    }
}

export function loadAnalysisData() {
    const project = document.getElementById('projectTitle').textContent;
    const tool = getCurrentTool();
    if (project && tool) {
        fetchLogsForProject(project, tool);
    }
}

function refreshProjectAnalysis() {
    if (!currentProject) return;
    
    // Don't re-fetch from server, just re-render with current logs
    const currentLogs = window.currentLogs || [];
    if (currentLogs.length > 0) {
        renderLogAnalysis(window.originalLogs);
    } else {
        // If no current logs, fetch fresh data
        const tool = getCurrentTool();
        if (currentProject && tool) {
            fetchLogsForProject(currentProject, tool);
        }
    }
}

export function countLogsByType(logs) {
    const counts = {
        all: logs.length,
        build: 0,
        deployment: 0,
        test: 0,
        sonarqube: 0,
        github_actions: 0
    };
    
    logs.forEach(log => {
        const logType = getLogType(log);
        if (counts.hasOwnProperty(logType)) {
            counts[logType]++;
        }
    });
    
    return counts;
}

function filterByLogType(logType) {
    setCurrentLogTypeFilter(logType)
    
    // Update button states
    document.querySelectorAll('.log-type-filter-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = btn.dataset.logType === 'build' ? '#1e40af' :
                              btn.dataset.logType === 'deployment' ? '#059669' :
                              btn.dataset.logType === 'test' ? '#7c3aed' :
                              btn.dataset.logType === 'sonarqube' ? '#dc2626' :
                              btn.dataset.logType === 'github_actions' ? '#374151' : '#4a5568';
    });
    
    const activeBtn = document.querySelector(`[data-log-type="${logType}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.background = logType === 'build' ? '#2563eb' :
                                   logType === 'deployment' ? '#047857' :
                                   logType === 'test' ? '#8b5cf6' :
                                   logType === 'sonarqube' ? '#dc2626' :
                                   logType === 'github_actions' ? '#4b5563' : '#6b7280';
    }
    
    // Apply filter and refresh display
    refreshProjectAnalysis();
    
    // Update filter status text
    const statusText = document.getElementById('filterStatusText');
    if (statusText) {
        statusText.textContent = logType ? `Showing ${logType} logs only` : 'Showing all log types';
    }
}

export function createLogTypeFilterPanel() {
    const filterPanel = document.createElement('div');
    filterPanel.id = 'logTypeFilterPanel';
    filterPanel.className = 'log-type-filter-panel';
    filterPanel.style = `
        margin: 1rem 0 2rem 0;
        padding: 1.5rem;
        background: linear-gradient(135deg, #1a1d29 0%, #2d3748 100%);
        border-radius: 8px;
        border: 1px solid #4a5568;
        box-shadow: 0 4px 16px rgba(0,0,0,0.2);
    `;
    
    filterPanel.innerHTML = `
        <div class="filter-header" style="margin-bottom: 1rem">
            <h3 style="
                color: #00d4aa; 
                font-size: 1.2rem; 
                margin: 0 0 0.5rem 0; 
                font-weight: 600;
            ">
                🔍 Filter by Log Type
            </h3>
            <p style="
                color: #a0aec0; 
                margin: 0; 
                font-size: 0.9rem;
            ">
                Filter analysis logs by their type
            </p>
        </div>
        
        <div class="log-type-filters" style="
            display: flex; 
            gap: 0.75rem; 
            flex-wrap: wrap; 
            align-items: center;
        ">
            <button class="log-type-filter-btn active" data-log-type="" onclick="filterByLogType('')" 
                    style="
                        padding: 0.5rem 1rem; 
                        background: #4a5568; 
                        color: white; 
                        border: none; 
                        border-radius: 20px; 
                        cursor: pointer; 
                        font-size: 0.9rem; 
                        transition: all 0.3s ease;
                    ">
                📋 All Types (<span id="allLogsCount">0</span>)
            </button>
            <button class="log-type-filter-btn" data-log-type="build" onclick="filterByLogType('build')" style="
                padding: 0.5rem 1rem; 
                background: #1e40af; 
                color: white; 
                border: none; 
                border-radius: 20px; 
                cursor: pointer; 
                font-size: 0.9rem; 
                transition: all 0.3s ease;
            ">
                🔨 Build (<span id="buildLogsCount">0</span>)
            </button>
            <button class="log-type-filter-btn" data-log-type="deployment" onclick="filterByLogType('deployment')" 
                style="
                    padding: 0.5rem 1rem; 
                    background: #059669; 
                    color: white; 
                    border: none; 
                    border-radius: 20px; 
                    cursor: pointer; 
                    font-size: 0.9rem; 
                    transition: all 0.3s ease;
                ">
                    🚀 Deploy (<span id="deployLogsCount">0</span>)
            </button>
            <button class="log-type-filter-btn" data-log-type="test" onclick="filterByLogType('test')" style="
                padding: 0.5rem 1rem; 
                background: #7c3aed; 
                color: white; 
                border: none; 
                border-radius: 20px; 
                cursor: pointer; 
                font-size: 0.9rem; 
                transition: all 0.3s ease;
            ">
                🧪 Test (<span id="testLogsCount">0</span>)
            </button>
            <button class="log-type-filter-btn" data-log-type="sonarqube" onclick="filterByLogType('sonarqube')" style="
                padding: 0.5rem 1rem; 
                background: #dc2626; 
                color: white; 
                border: none; 
                border-radius: 20px; 
                cursor: pointer; 
                font-size: 0.9rem; 
                transition: all 0.3s ease;
            ">
                📊 SonarQube (<span id="sonarqubeLogsCount">0</span>)
            </button>
        </div>
    `;
    
    return filterPanel;
}

window.filterByLogType = filterByLogType;
window.showDashboard = showDashboard;

export function updateAlertPanel(logs) {
    const alertPanel = document.getElementById('alertPanel');
    const alertList = document.getElementById('alertList');
    const alertBadge = document.getElementById('alertBadge');

    console.log("inside updateAlertPanel");
    console.log(logs);
    // Filter for high/critical logs
    const criticalLogs = logs.filter(log => {
        if (!log.severity_level) return false;
        const cleaned = log.severity_level.replace(/[^a-z]/g, '').toLowerCase();
        return ['high', 'critical'].includes(cleaned);
    });

    console.log(criticalLogs);

    // Update badge
    if (criticalLogs.length > 0) {
        alertBadge.textContent = criticalLogs.length;
        alertBadge.classList.remove('hidden');
    } else {
        alertBadge.textContent = '0';
        alertBadge.classList.add('hidden');
    }

    // Populate alert panel
    alertList.innerHTML = '';
    if (criticalLogs.length === 0) {
        alertList.innerHTML = `<div style="color:#aaa">No critical alerts 🎉</div>`;
    } else {
        criticalLogs.forEach(log => {
            const div = document.createElement('div');
            div.className = 'alert-item';
            div.style = `
                background: #2d2d2d;
                color: #fff;
                border-left: 4px solid ${log.severity_level.replace(/[^a-z]/g, '').toLowerCase() === 'critical' ? '#f44336' : '#ff9800'};
                margin-bottom: 0.75rem;
                padding: 0.75rem 1rem;
                border-radius: 6px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            `;
            div.innerHTML = `
                <div style="font-weight: 600">
                    [${log.severity_level.replace(/[^a-z]/g, '').toUpperCase()}] ${
                        log.executive_summary
                            ? log.executive_summary.split('\n')[0].replace(/^\*+\s*/, '')
                            : log.message || log.summary || 'No message'
                    }
                </div>
                <div style="
                    font-size: 0.9em; 
                    color:#bbb;
                ">
                    ${log.project ? `Project: ${log.project}<br>` : ''}
                    ${log.tool ? `Tool: ${log.tool}<br>` : ''}
                    ${log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
                    ${log.server ? ' | ' + log.server : ''}
                </div>
            `;
            alertList.appendChild(div);
        });
    }
}

document.getElementById('alertBtn').onclick = () => {
    document.getElementById('alertPanel').classList.toggle('hidden');
};
document.getElementById('closeAlertPanelBtn').onclick = () => {
    document.getElementById('alertPanel').classList.add('hidden');
};