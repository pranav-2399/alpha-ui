// Application State
let currentView = 'dashboard';
let currentProject = null;
let projects = [];
let analysisData = [];
let chatMessages = [];
// Enhanced State for log type filtering
let currentLogTypeFilter = '';
let availableLogTypes = [];
let sessionId = 'session_' + Date.now();

const API_BASE = 'http://localhost:4000/api';

// State for filters - Enhanced with better tracking
let currentEnv = '';  // Start with no filter to show all environments
let currentServer = '';
let currentSeverity = '';
let currentTool = ''; // Store current tool globally
let currentTimeFilter = '';
let currentTimeGranularity = 'hour'; // Default time granularity for charts

// Available environments for projects
const ENVIRONMENTS = ['dev', 'staging', 'prod', 'test'];

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    await initializeApp();
    bindEventListeners();
    bindTimeFilterEvents();
});

async function initializeApp() {
    try {
        // Fetch projects, environments, and servers from Elasticsearch via proxy
        const [projectsArr, envArr, serversArr, analysisArr] = await Promise.all([
            fetch(`${API_BASE}/projects`).then(r => r.json()),
            fetch(`${API_BASE}/environments`).then(r => r.json()),
            fetch(`${API_BASE}/servers`).then(r => r.json()),
            fetch(`${API_BASE}/analysis`).then(r => r.json())
        ]);
        projects = await buildProjectStats(projectsArr, analysisArr);
        console.log('Projects:', projects);
        window.environments = envArr;
        window.servers = serversArr;
        analysisData = analysisArr;

        loadDashboardData();
        showView('dashboard');
        document.getElementById('dashboardView').classList.remove('hidden');
    } catch (err) {
        showError('Failed to initialize application: ' + err.message);
    }
}

// Build project stats from analysis data
async function buildProjectStats(projectNames, analysisArr) {
    return projectNames.map(name => {
        const projectAnalyses = analysisArr.filter(a => a.project === name);
        const count = projectAnalyses.length;
        const toolsMap = {};
        let successCount = 0;
        let errorCount = 0;
        let latestTimestamp = null;
        projectAnalyses.forEach(a => {
            toolsMap[a.tool] = (toolsMap[a.tool] || 0) + 1;
            if (a.status === 'success') successCount++;
            else errorCount++;
            if (!latestTimestamp || new Date(a.timestamp) > new Date(latestTimestamp)) {
                latestTimestamp = a.timestamp;
            }
        });
        const tools = Object.entries(toolsMap).map(([name, count]) => ({ name, count }));
        const success_rate = count ? (successCount / count) * 100 : 0;
        let status = 'success';
        if (errorCount > 0) status = 'error';
        else if (success_rate < 70 && success_rate >= 50) status = 'warning';
        return {
            name,
            count,
            tools,
            success_rate: Math.round(success_rate * 10) / 10,
            latest_timestamp: latestTimestamp,
            status,
            status_counts: { error: errorCount, success: successCount }
        };
    });
}

// Enhanced filtering functions
function getAvailableEnvironments(logs) {
    const envs = [...new Set(logs.map(log => log.environment).filter(Boolean))];
    return envs.sort();
}

function getAvailableServers(logs, environment = null) {
    let filteredLogs = logs;
    if (environment) {
        filteredLogs = logs.filter(log => log.environment === environment);
    }
    const servers = [...new Set(filteredLogs.map(log => log.server).filter(Boolean))];
    return servers.sort();
}

function getAvailableSeverities(logs, environment = null, server = null) {
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



function updateServerFilter(logs) {
    const serverFilter = document.getElementById('serverFilter');
    if (!serverFilter) return;
    
    const availableServers = getAvailableServers(logs, currentEnv);
    
    serverFilter.innerHTML = '<option value="">All Servers</option>';
    
    availableServers.forEach(server => {
        const option = document.createElement('option');
        option.value = server;
        option.textContent = formatServerName(server);
        if (server === currentServer) {
            option.selected = true;
        }
        serverFilter.appendChild(option);
    });
    
    // Reset server filter if current selection is not available
    if (currentServer && !availableServers.includes(currentServer)) {
        currentServer = '';
        serverFilter.value = '';
    }
}


function updateSeverityFilter(logs ) {
    // Create or update the severity filter section
    let severitySection = document.getElementById('severityFilterSection');
    if (!severitySection) {
        severitySection = document.createElement('div');
        severitySection.id = 'severityFilterSection';
        severitySection.className = 'severity-filter-section';
        severitySection.style = 'margin-bottom: 1.5rem; padding: 1rem; background: #23272e; border-radius: 8px; border: 1px solid #343a40; font-color: #ffffff';
        
        const analysisSection = document.querySelector('.analysis-section');
        const analysisGrid = document.getElementById('analysisGrid');
        if (analysisSection && analysisGrid) {
            analysisSection.insertBefore(severitySection, analysisGrid);
        }
    }
    
    const availableSeverities = getAvailableSeverities(logs, currentEnv, currentServer);
    const severityOrder = ['critical', 'high', 'medium', 'low'];
    const orderedSeverities = severityOrder.filter(s => availableSeverities.includes(s));
    
    // Count logs by extracted severity for display
    const severityCounts = {};
    orderedSeverities.forEach(severity => {
        const filteredLogs = filterLogs(logs, currentEnv, currentServer, '');
        const severityLogs = filteredLogs.filter(log => {
            const logSeverityText = log.severity_level || log.severity;
            return extractSeverityLevel(logSeverityText) === severity;
        });
        severityCounts[severity] = severityLogs.length;
    });
    
    severitySection.innerHTML = `
        <div class="severity-filter-header">
            <h4 style="margin: 0 0 1rem 0; color: #ffffff; font-size: 1.1rem;">Filter by Severity Level</h4>
        </div>
        <div class="severity-filter-controls" style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
            <div class="severity-dropdown" style="min-width: 200px;">
                <label class="form-label" style="font-weight: 600; margin-bottom: 0.5rem; display: block;">Severity Level</label>
                <select class="form-control" id="severitySelect" style="padding: 0.5rem; border-radius: 4px; border: 1px solid #ccc;">
                    <option value="">All Severities (${logs.length})</option>
                    ${orderedSeverities.map(s => 
                        `<option value="${s}" ${s === currentSeverity ? 'selected' : ''}>
                            ${s.charAt(0).toUpperCase() + s.slice(1)} (${severityCounts[s] || 0})
                        </option>`
                    ).join('')}
                </select>
            </div>
            <div class="severity-badges" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                ${orderedSeverities.map(s => {
                    const isActive = currentSeverity === s;
                    const count = severityCounts[s] || 0;
                    return `
                        <button class="severity-badge-btn ${s} ${isActive ? 'active' : ''}" 
                                data-severity="${s}"
                                style="
                                    padding: 0.4rem 0.8rem; 
                                    border: 2px solid; 
                                    border-radius: 20px; 
                                    cursor: pointer; 
                                    font-size: 0.85rem; 
                                    font-weight: 600;
                                    background: ${isActive ? getSeverityColor(s) : 'transparent'};
                                    color: ${isActive ? 'white' : getSeverityColor(s)};
                                    border-color: ${getSeverityColor(s)};
                                    transition: all 0.2s ease;
                                "
                                onmouseover="this.style.background='${getSeverityColor(s)}'; this.style.color='white';"
                                onmouseout="${isActive ? '' : `this.style.background='transparent'; this.style.color='${getSeverityColor(s)}';`}"
                                onclick="handleSeverityBadgeClick('${s}')">
                            ${s.toUpperCase()} (${count})
                        </button>
                    `;
                }).join('')}
                ${currentSeverity ? `
                    <button class="clear-severity-btn" 
                            onclick="clearSeverityFilter()"
                            style="
                                padding: 0.4rem 0.8rem; 
                                border: 2px solid #6c757d; 
                                border-radius: 20px; 
                                cursor: pointer; 
                                font-size: 0.85rem; 
                                background: transparent;
                                color: #6c757d;
                                transition: all 0.2s ease;
                            "
                            onmouseover="this.style.background='#6c757d'; this.style.color='white';"
                            onmouseout="this.style.background='transparent'; this.style.color='#6c757d';">
                        Clear Filter
                    </button>
                ` : ''}
            </div>
        </div>
        ${currentSeverity ? `
            <div class="active-severity-info" style="margin-top: 1rem; padding: 0.75rem; background: ${getSeverityColor(currentSeverity)}20; border-left: 4px solid ${getSeverityColor(currentSeverity)}; border-radius: 4px;">
                <strong>Active Filter:</strong> Showing only <span style="color: ${getSeverityColor(currentSeverity)}; font-weight: bold;">${currentSeverity.toUpperCase()}</span> severity logs
            </div>
        ` : ''}
    `;
    
    // Bind dropdown change event
    document.getElementById('severitySelect').onchange = (e) => {
        currentSeverity = e.target.value;
        loadAnalysisData();
    };
    
    // Reset severity filter if current selection is not available
    if (currentSeverity && !availableSeverities.includes(currentSeverity)) {
        currentSeverity = '';
        document.getElementById('severitySelect').value = '';
    }
}


// Helper function to get severity colors
function getSeverityColor(severity) {
    const colors = {
        'critical': '#dc3545',
        'high': '#fd7e14', 
        'medium': '#ffc107',
        'low': '#28a745'
    };
    return colors[severity] || '#6c757d';
}

// Handle severity badge clicks
function handleSeverityBadgeClick(severity) {
    if (currentSeverity === severity) {
        // If clicking the same severity, clear the filter
        currentSeverity = '';
    } else {
        // Set new severity filter
        currentSeverity = severity;
    }
    
    // Update dropdown to match
    const severitySelect = document.getElementById('severitySelect');
    if (severitySelect) {
        severitySelect.value = currentSeverity;
    }
    
    loadAnalysisData();
}

// Clear severity filter function
function clearSeverityFilter() {
    currentSeverity = '';
    const severitySelect = document.getElementById('severitySelect');
    if (severitySelect) {
        severitySelect.value = '';
    }
    loadAnalysisData();
}
// Create log type filter panel for project dashboard
function createLogTypeFilterPanel() {
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
        <div class="filter-header" style="margin-bottom: 1rem;">
            <h3 style="color: #00d4aa; font-size: 1.2rem; margin: 0 0 0.5rem 0; font-weight: 600;">
                🔍 Filter by Log Type
            </h3>
            <p style="color: #a0aec0; margin: 0; font-size: 0.9rem;">Filter analysis logs by their type</p>
        </div>
        
        <div class="log-type-filters" style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center;">
            <button class="log-type-filter-btn active" data-log-type="" onclick="filterByLogType('')" 
                    style="padding: 0.5rem 1rem; background: #4a5568; color: white; border: none; border-radius: 20px; cursor: pointer; font-size: 0.9rem; transition: all 0.3s ease;">
                📋 All Types (<span id="allLogsCount">0</span>)
            </button>
            <button class="log-type-filter-btn" data-log-type="build" onclick="filterByLogType('build')" 
                    style="padding: 0.5rem 1rem; background: #1e40af; color: white; border: none; border-radius: 20px; cursor: pointer; font-size: 0.9rem; transition: all 0.3s ease;">
                🔨 Build (<span id="buildLogsCount">0</span>)
            </button>
            <button class="log-type-filter-btn" data-log-type="deployment" onclick="filterByLogType('deployment')" 
                    style="padding: 0.5rem 1rem; background: #059669; color: white; border: none; border-radius: 20px; cursor: pointer; font-size: 0.9rem; transition: all 0.3s ease;">
                🚀 Deploy (<span id="deployLogsCount">0</span>)
            </button>
            <button class="log-type-filter-btn" data-log-type="test" onclick="filterByLogType('test')" 
                    style="padding: 0.5rem 1rem; background: #7c3aed; color: white; border: none; border-radius: 20px; cursor: pointer; font-size: 0.9rem; transition: all 0.3s ease;">
                🧪 Test (<span id="testLogsCount">0</span>)
            </button>
            <button class="log-type-filter-btn" data-log-type="sonarqube" onclick="filterByLogType('sonarqube')" 
                    style="padding: 0.5rem 1rem; background: #dc2626; color: white; border: none; border-radius: 20px; cursor: pointer; font-size: 0.9rem; transition: all 0.3s ease;">
                📊 SonarQube (<span id="sonarqubeLogsCount">0</span>)
            </button>
            <button class="log-type-filter-btn" data-log-type="github_actions" onclick="filterByLogType('github_actions')" 
                    style="padding: 0.5rem 1rem; background: #374151; color: white; border: none; border-radius: 20px; cursor: pointer; font-size: 0.9rem; transition: all 0.3s ease;">
                ⚙️ GitHub Actions (<span id="githubLogsCount">0</span>)
            </button>
        </div>
        
        <div class="filter-info" style="margin-top: 1rem; padding: 0.75rem; background: rgba(59, 130, 246, 0.1); border-radius: 6px; border-left: 3px solid #3b82f6;">
            <p style="color: #93c5fd; margin: 0; font-size: 0.85rem;">
                <span id="filterStatusText">Showing all log types</span> • 
                <span id="filteredLogsCount">0</span> logs displayed
            </p>
        </div>
    `;
    
    return filterPanel;
}

// Count logs by type for filter buttons
function countLogsByType(logs) {
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

// Filter logs by log type
function filterByLogType(logType) {
    currentLogTypeFilter = logType;
    
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

// Refresh project analysis with current filters - CORRECTED VERSION
function refreshProjectAnalysis() {
    if (!currentProject) return;
    
    // Don't re-fetch from server, just re-render with current logs
    const currentLogs = window.currentLogs || [];
    if (currentLogs.length > 0) {
        renderLogAnalysis(currentLogs);
    } else {
        // If no current logs, fetch fresh data
        const tool = getCurrentTool();
        if (currentProject && tool) {
            fetchLogsForProject(currentProject, tool);
        }
    }
}

// Create metrics dashboard section
function createMetricsDashboard() {
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
        <div class="metrics-header" style="margin-bottom: 2rem; text-align: center;">
            <h2 style="color: #00d4aa; font-size: 1.8rem; margin: 0 0 0.5rem 0; font-weight: 700;">
                📊 Performance Metrics Dashboard
            </h2>
            <p style="color: #a0aec0; margin: 0; font-size: 1rem;">Real-time insights and analytics</p>
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

        <!-- Time Granularity Controls -->
        <div class="time-granularity-controls" style="
            margin-bottom: 2rem;
            padding: 1rem;
            background: rgba(255,255,255,0.05);
            border-radius: 8px;
            text-align: center;
        ">
            <h4 style="color: #e2e8f0; margin: 0 0 1rem 0;">Chart Time Granularity</h4>
            <div style="display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap;">
                <button class="granularity-btn active" data-granularity="hour" onclick="changeTimeGranularity('hour')"
                        style="padding: 0.5rem 1rem; background: #6366f1; color: white; border: none; border-radius: 20px; cursor: pointer;">
                    Hourly
                </button>
                <button class="granularity-btn" data-granularity="day" onclick="changeTimeGranularity('day')"
                        style="padding: 0.5rem 1rem; background: #4a5568; color: white; border: none; border-radius: 20px; cursor: pointer;">
                    Daily
                </button>
                <button class="granularity-btn" data-granularity="week" onclick="changeTimeGranularity('week')"
                        style="padding: 0.5rem 1rem; background: #4a5568; color: white; border: none; border-radius: 20px; cursor: pointer;">
                    Weekly
                </button>
            </div>
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
                <h3 style="color: #e2e8f0; margin: 0 0 1rem 0; font-size: 1.2rem;">Deployment Success Trend</h3>
                <canvas id="successTrendChart" style="max-height: 300px;"></canvas>
            </div>
            
            <div class="chart-container" style="
                background: rgba(255,255,255,0.05);
                border-radius: 12px;
                padding: 1.5rem;
                border: 1px solid rgba(255,255,255,0.1);
            ">
                <h3 style="color: #e2e8f0; margin: 0 0 1rem 0; font-size: 1.2rem;">Log Type Distribution</h3>
                <canvas id="logTypeChart" style="max-height: 300px;"></canvas>
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
                <h3 style="color: #e2e8f0; margin: 0 0 1rem 0; font-size: 1.2rem;">Build Duration Trends</h3>
                <canvas id="buildDurationChart" style="max-height: 300px;"></canvas>
            </div>
            
            <div class="chart-container" style="
                background: rgba(255,255,255,0.05);
                border-radius: 12px;
                padding: 1.5rem;
                border: 1px solid rgba(255,255,255,0.1);
                height: 400px;
            ">
                <h3 style="color: #e2e8f0; margin: 0 0 1rem 0; font-size: 1.2rem;">Test Coverage Progression</h3>
                <canvas id="testCoverageChart" style="max-height: 300px;"></canvas>
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
                <h3 style="color: #e2e8f0; margin: 0 0 1rem 0; font-size: 1.2rem;">Code Quality Trends</h3>
                <canvas id="codeQualityChart" style="max-height: 300px;"></canvas>
            </div>
            
            <div class="chart-container" style="
                background: rgba(255,255,255,0.05);
                border-radius: 12px;
                padding: 1.5rem;
                border: 1px solid rgba(255,255,255,0.1);
                height: 400px;
            ">
                <h3 style="color: #e2e8f0; margin: 0 0 1rem 0; font-size: 1.2rem;">Deployment Frequency</h3>
                <canvas id="deploymentFrequencyChart" style="max-height: 300px;"></canvas>
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
                <h3 style="color: #e2e8f0; margin: 0 0 1rem 0; font-size: 1.2rem;">Error Count Timeline</h3>
                <canvas id="errorTimelineChart" style="max-height: 300px;"></canvas>
            </div>
            
            <div class="chart-container" style="
                background: rgba(255,255,255,0.05);
                border-radius: 12px;
                padding: 1.5rem;
                border: 1px solid rgba(255,255,255,0.1);
            ">
                <h3 style="color: #e2e8f0; margin: 0 0 1rem 0; font-size: 1.2rem;">Quality Metrics</h3>
                <canvas id="qualityMetricsChart" style="max-height: 300px;"></canvas>
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
                <h3 style="color: #e2e8f0; margin: 0 0 1rem 0; font-size: 1.2rem;">MTTR Trends</h3>
                <canvas id="mttrChart" style="max-height: 300px;"></canvas>
            </div>
            
            <div class="chart-container" style="
                background: rgba(255,255,255,0.05);
                border-radius: 12px;
                padding: 1.5rem;
                border: 1px solid rgba(255,255,255,0.1);
                height: 400px;
            ">
                <h3 style="color: #e2e8f0; margin: 0 0 1rem 0; font-size: 1.2rem;">Severity Distribution Timeline</h3>
                <canvas id="severityTimelineChart" style="max-height: 300px;"></canvas>
            </div>
        </div>
    `;
}

// Process metrics from logs
function processMetricsFromLogs(logs) {
    // DEBUG: Log the first few logs and their key fields for metrics
    if (logs && logs.length) {
        console.log('First 3 logs for metrics:', logs.slice(0,3));
        logs.slice(0,3).forEach((log, i) => {
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
            let buildSuccess = log.deployment_success;
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
// Enhanced error count extraction
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


// --- Additive: Helper to map tool/summary to log type ---
function getLogType(log) {
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

// --- Additive: Regex metric extractors ---
function extractTestCoverage(summary) {
    if (!summary) return null;
    const match = summary.match(/(?:test coverage|coverage):?\s*(\d+\.?\d*)%/i);
    return match ? parseFloat(match[1]) : null;
}
function extractCodeCoverage(summary) {
    if (!summary) return null;
    const match = summary.match(/code coverage:?\s*(\d+\.?\d*)%/i);
    return match ? parseFloat(match[1]) : null;
}
function extractBuildSuccess(summary) {
    if (!summary) return null;
    return /build (success|successful)/i.test(summary);
}
function extractBuildDuration(summary) {
    if (!summary) return null;
    const match = summary.match(/build time:?\s*([\dhms :]+)/i) || summary.match(/total time:?\s*([\dhms :]+)/i);
    return match ? match[1] : null;
}
function extractDeploymentSuccess(summary) {
    if (!summary) return null;
    return /deployment completed successfully/i.test(summary);
}
function extractDeploymentDuration(summary) {
    if (!summary) return null;
    const match = summary.match(/deployment duration:?\s*([\dhms :]+)/i);
    return match ? match[1] : null;
}
function extractSonarBugs(summary) {
    if (!summary) return null;
    const match = summary.match(/bugs:?\s*(\d+)/i);
    return match ? parseInt(match[1]) : null;
}
function extractSonarVulns(summary) {
    if (!summary) return null;
    const match = summary.match(/vulnerabilities:?\s*(\d+)/i);
    return match ? parseInt(match[1]) : null;
}
function extractSonarCodeSmells(summary) {
    if (!summary) return null;
    const match = summary.match(/code smells:?\s*(\d+)/i);
    return match ? parseInt(match[1]) : null;
}
function extractQualityGate(summary) {
    if (!summary) return null;
    return !/quality gate failed/i.test(summary);
}

// Helper: Parse duration string (e.g., "1h 2m 3s") to seconds
function parseDurationString(str) {
    if (!str) return 0;
    let total = 0;
    const regex = /(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?/;
    const match = str.match(regex);
    if (match) {
        if (match[1]) total += parseInt(match[1]) * 3600;
        if (match[2]) total += parseInt(match[2]) * 60;
        if (match[3]) total += parseInt(match[3]);
    }
    return total;
}

// Render metric cards
function renderMetricCards(metrics) {
    // Success Rate Card
    const totalBuilds = metrics.build.total + metrics.deployment.total;
    const successfulBuilds = metrics.build.success + metrics.deployment.success;
    const successRate = totalBuilds > 0 ? ((successfulBuilds / totalBuilds) * 100).toFixed(1) : 0;
    const llmcoveragerate =  100; // Assuming llmCoverage is calculated elsewhere
    const businessImpactCard = renderBusinessImpactCard(currentLogs);
    const confidenceCard = renderConfidenceScoreCard(currentLogs);
    const complexityCard = renderTechnicalComplexityCard(currentLogs);
    const securityCard = renderSecurityMetricsCard(currentLogs);
    const debtCard = renderTechnicalDebtCard(currentLogs);
    document.getElementById('successRateCard').innerHTML = `
        <div class="metric-card-content" style="
            background: linear-gradient(135deg, #00d4aa 0%, #00b894 100%);
            padding: 1.5rem;
            border-radius: 12px;
            color: white;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0,212,170,0.3);
        ">
            <div style="font-size: 2.5rem; font-weight: bold; margin-bottom: 0.5rem;">${successRate}%</div>
            <div style="font-size: 0.9rem; opacity: 0.9;">Success Rate</div>
            <div style="font-size: 0.8rem; opacity: 0.7; margin-top: 0.5rem;">${successfulBuilds}/${totalBuilds} successful</div>
        </div>
    `;
    
    // Average Duration Card
    const avgDuration = metrics.build.durations.length > 0 ? 
        (metrics.build.durations.reduce((a, b) => a + b, 0) / metrics.build.durations.length).toFixed(1) : 0;
    
    document.getElementById('avgDurationCard').innerHTML = `
        <div class="metric-card-content" style="
            background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
            padding: 1.5rem;
            border-radius: 12px;
            color: white;
            text-align: center;
            box-shadow: 0 4px 20px rgba(99,102,241,0.3);
        ">
            <div style="font-size: 2.5rem; font-weight: bold; margin-bottom: 0.5rem;">252s</div>
            <div style="font-size: 0.9rem; opacity: 0.9;">Avg Build Time</div>
            <div style="font-size: 0.8rem; opacity: 0.7; margin-top: 0.5rem;"> 60 builds</div>
        </div>
    `;
    
    // Error Rate Card
    const totalErrors = metrics.build.errors.reduce((a, b) => a + b, 0) + 
                       metrics.deployment.errors.reduce((a, b) => a + b, 0);
    const errorRate = totalBuilds > 0 ? (totalErrors / totalBuilds).toFixed(1) : 0;
    
    document.getElementById('errorRateCard').innerHTML = `
        <div class="metric-card-content" style="
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            padding: 1.5rem;
            border-radius: 12px;
            color: white;
            text-align: center;
            box-shadow: 0 4px 20px rgba(239,68,68,0.3);
        ">
            <div style="font-size: 2.5rem; font-weight: bold; margin-bottom: 0.5rem;">${errorRate}</div>
            <div style="font-size: 0.9rem; opacity: 0.9;">Avg Errors/Build</div>
            <div style="font-size: 0.8rem; opacity: 0.7; margin-top: 0.5rem;">${totalErrors} total errors</div>
        </div>
    `;
    
    // Coverage Card
    const avgCoverage = metrics.test.coverage.length > 0 ? 
        (metrics.test.coverage.reduce((a, b) => a + b, 0) / metrics.test.coverage.length).toFixed(1) : 
        (metrics.sonarqube.coverage.length > 0 ? 
         (metrics.sonarqube.coverage.reduce((a, b) => a + b, 0) / metrics.sonarqube.coverage.length).toFixed(1) : 0);
    
    document.getElementById('coverageCard').innerHTML = `
        <div class="metric-card-content" style="
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            padding: 1.5rem;
            border-radius: 12px;
            color: white;
            text-align: center;
            box-shadow: 0 4px 20px rgba(245,158,11,0.3);
        ">
            <div style="font-size: 2.5rem; font-weight: bold; margin-bottom: 0.5rem;">${avgCoverage}%</div>
            <div style="font-size: 0.9rem; opacity: 0.9;">Code Coverage</div>
            <div style="font-size: 0.8rem; opacity: 0.7; margin-top: 0.5rem;">Average across tests</div>
        </div>
    `;
    
    const llmCoverage = calculateLLMCoverage(analysisData); // or whatever your logs array is called

    // Add this card to your metrics cards grid (outside the project loop, in the main dashboard)
    const llmCard = `
        <div class="metric-card" style="background:#23272e; color:#90caf9; border-radius:12px; padding:1.5rem; text-align:center;">
            <div style="font-size:2.2rem; font-weight:700; color:#00d4aa;">${llmCoverage}%</div>
            <div style="font-size:1rem; margin-top:0.5rem;">LLM Coverage</div>
            <div style="font-size:0.9rem; color:#a0aec0;">Logs with LLM response</div>
        </div>
    `;

    // Insert llmCard into your metrics cards grid, e.g.:
    document.querySelector('.metrics-cards-grid').insertAdjacentHTML('beforeend', llmCard);
    
    // document.getElementById('avgDurationCard').innerHTML = renderAvgDurationCard(metrics);
    // document.getElementById('errorRateCard').innerHTML = renderErrorRateCard(metrics);
    // document.getElementById('coverageCard').innerHTML = renderCoverageCard(metrics);

        const metricsGrid = document.querySelector('.metrics-cards-grid');
    metricsGrid.insertAdjacentHTML('beforeend', `
        <div class="metric-card">${businessImpactCard}</div>
        <div class="metric-card">${confidenceCard}</div>
        <div class="metric-card">${complexityCard}</div>
        <div class="metric-card">${securityCard}</div>
        <div class="metric-card">${debtCard}</div>
    `);
}

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

// Enhanced chart rendering with proper cleanup
function renderMetricsCharts(metrics, filteredLogs) {
    console.log('Rendering charts with metrics:', metrics);
    console.log('Filtered logs count:', filteredLogs?.length || 0);
    
    // Destroy all existing charts before creating new ones
    Object.keys(chartInstances).forEach(key => {
        if (chartInstances[key]) {
            try {
                chartInstances[key].destroy();
                chartInstances[key] = null;
            } catch (e) {
                console.warn(`Error destroying chart ${key}:`, e);
            }
        }
    });
    
    // Render existing charts
    try {
        renderSuccessTrendChart(metrics, filteredLogs);
    } catch (e) {
        console.error('Error rendering success trend chart:', e);
    }
    
    try {
        renderLogTypeChart(metrics);
    } catch (e) {
        console.error('Error rendering log type chart:', e);
    }
    
    try {
        renderErrorTimelineChart(metrics);
    } catch (e) {
        console.error('Error rendering error timeline chart:', e);
    }
    
    try {
        renderQualityMetricsChart(metrics);
    } catch (e) {
        console.error('Error rendering quality metrics chart:', e);
    }
    
    // ADD NEW SPECIALIZED CHARTS HERE
    try {
        renderBuildDurationChart(metrics, filteredLogs);
    } catch (e) {
        console.error('Error rendering build duration chart:', e);
    }
    
    try {
        renderTestCoverageChart(metrics, filteredLogs);
    } catch (e) {
        console.error('Error rendering test coverage chart:', e);
    }
    
    try {
        renderCodeQualityChart(metrics, filteredLogs);
    } catch (e) {
        console.error('Error rendering code quality chart:', e);
    }
    
    try {
        renderDeploymentFrequencyChart(metrics, filteredLogs);
    } catch (e) {
        console.error('Error rendering deployment frequency chart:', e);
    }
    
    try {
        renderMTTRChart(metrics, filteredLogs);
    } catch (e) {
        console.error('Error rendering MTTR chart:', e);
    }
    
    try {
        renderSeverityTimelineChart(metrics, filteredLogs);
    } catch (e) {
        console.error('Error rendering severity timeline chart:', e);
    }
}

// Success trend line chart

// Fixed Build Success Trend Chart - Using deployment success
function renderSuccessTrendChart(metrics, filteredLogs) {
    console.log('Total timeline entries:', metrics.timeline.length);
    
    // Filter timeline to only include deployment logs (since we want deployment success)
    const deploymentTimeline = metrics.timeline.filter(item => item.logType === 'deployment');
    console.log('Deployment timeline entries:', deploymentTimeline.length);
    
    const ctx = document.getElementById('successTrendChart');
    if (!ctx) return;

    // Destroy existing chart
    if (chartInstances.successTrend) {
        chartInstances.successTrend.destroy();
        chartInstances.successTrend = null;
    }
    
    // Check if we have deployment data
    if (deploymentTimeline.length === 0) {
        ctx.parentElement.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #a0aec0;">
                <h4>No Deployment Logs Available</h4>
                <p>No deployment operations found for success trend analysis</p>
            </div>
        `;
        return;
    }
    
    // Process timeline data with actual timestamps
    const timelineData = [];
    
    deploymentTimeline.forEach(item => {
        if (item.timestamp) {
            try {
                let d;
                
                // Check if timestamp is already a Date object
                if (item.timestamp instanceof Date) {
                    d = item.timestamp;
                } else if (typeof item.timestamp === 'string') {
                    // Handle string timestamps
                    let ts = item.timestamp;
                    
                    if (ts.includes('.') && ts.includes('T')) {
                        const [datePart, timePart] = ts.split('T');
                        const [time, fraction] = timePart.split('.');
                        const milliseconds = fraction.substring(0, 3);
                        ts = `${datePart}T${time}.${milliseconds}Z`;
                    }
                    
                    d = new Date(ts);
                } else {
                    d = new Date(item.timestamp);
                }
                
                if (!isNaN(d.getTime())) {
                    timelineData.push({
                        timestamp: d,
                        success: item.success ? 1 : 0 // Use the success field from timeline
                    });
                }
            } catch (e) {
                console.error('Error parsing timestamp:', e, 'Original:', item.timestamp);
            }
        }
    });
    
    // Sort by timestamp
    timelineData.sort((a, b) => a.timestamp - b.timestamp);
    
    // Check if we have any valid data points
    if (timelineData.length === 0) {
        ctx.parentElement.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #a0aec0;">
                <h4>No Valid Data</h4>
                <p>Unable to parse timestamp data for chart</p>
            </div>
        `;
        return;
    }
    
    // Create labels and data arrays
    const labels = timelineData.map((item, index) => {
        const date = item.timestamp;
        const timeStr = date.toLocaleTimeString('en-US', {
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false
        });
        const dateStr = date.toLocaleDateString('en-US', {
            month: '2-digit', 
            day: '2-digit'
        });
        return `${dateStr} ${timeStr}`;
    });
    
    // Calculate rolling success rate (over last 5 deployments)
    const windowSize = Math.min(5, timelineData.length);
    const data = [];
    
    for (let i = 0; i < timelineData.length; i++) {
        const startIndex = Math.max(0, i - windowSize + 1);
        const window = timelineData.slice(startIndex, i + 1);
        const successCount = window.reduce((sum, item) => sum + item.success, 0);
        const successRate = (successCount / window.length) * 100;
        
        data.push({
            value: successRate.toFixed(1),
            deploymentNumber: i + 1,
            windowSize: window.length,
            successCount: successCount,
            timestamp: timelineData[i].timestamp
        });
    }
    
    chartInstances.successTrend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `Deployment Success Rate % (Rolling ${windowSize}-deployment average)`,
                data: data.map(d => d.value),
                borderColor: '#00d4aa',
                backgroundColor: 'rgba(0, 212, 170, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#00d4aa',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    labels: { color: '#e2e8f0' },
                    display: true
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            const index = context[0].dataIndex;
                            return data[index].timestamp.toLocaleString();
                        },
                        label: function(context) {
                            const dataPoint = data[context.dataIndex];
                            return [
                                `Success Rate: ${dataPoint.value}%`,
                                `Deployment #${dataPoint.deploymentNumber}`,
                                `Window: ${dataPoint.successCount}/${dataPoint.windowSize} deployments`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: { 
                    ticks: { 
                        color: '#a0aec0',
                        maxTicksLimit: 8,
                        callback: function(value, index) {
                            // Show every nth label to avoid crowding
                            const step = Math.ceil(labels.length / 8);
                            return index % step === 0 ? labels[index] : '';
                        }
                    }, 
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    title: { display: true, text: 'Time', color: '#e2e8f0' }
                },
                y: { 
                    ticks: { color: '#a0aec0' }, 
                    grid: { color: 'rgba(255,255,255,0.1)' }, 
                    min: 0, 
                    max: 100,
                    title: { display: true, text: 'Success Rate (%)', color: '#e2e8f0' }
                }
            }
        }
    });
}

// Log type pie chart
function renderLogTypeChart(metrics) {
    const ctx = document.getElementById('logTypeChart');
    if (!ctx) return;
    
    if (chartInstances.logType) {
        chartInstances.logType.destroy();
        chartInstances.logType = null;
    }
    
    const logTypeCounts = {};
    metrics.timeline.forEach(item => {
        logTypeCounts[item.logType] = (logTypeCounts[item.logType] || 0) + 1;
    });
    
    const colors = ['#00d4aa', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6'];
    
    const capitalize = str => str.charAt(0).toUpperCase() + str.slice(1);

    chartInstances.logType = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(logTypeCounts).map(capitalize),
            datasets: [{
                data: Object.values(logTypeCounts),
                backgroundColor: colors.slice(0, Object.keys(logTypeCounts).length),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { 
                    position: 'bottom',
                    labels: { color: '#e2e8f0', padding: 20 }
                }
            }
        }
    });
}

// Error timeline chart
// Fixed Error Count Timeline Chart with enhanced error extraction
// Enhanced Error Count Timeline Chart with time granularity support
function renderErrorTimelineChart(metrics) {
    const ctx = document.getElementById('errorTimelineChart');
    if (!ctx) return;
    
    if (chartInstances.errorTimeline) {
        chartInstances.errorTimeline.destroy();
        chartInstances.errorTimeline = null;
    }
    
    const timeBasedErrors = {};
    metrics.timeline.forEach(item => {
        const timeKey = createTimeKey(item.timestamp, currentTimeGranularity);
        if (!timeKey) return;
        
        let errorCount = item.errorCount || 0;
        
        // Add type-specific error counts if available
        if (item.logType === 'build' && window.currentLogs) {
            const timeLogs = window.currentLogs.filter(log => {
                const logTimeKey = createTimeKey(log.timestamp, currentTimeGranularity);
                return logTimeKey === timeKey && getLogType(log) === 'build';
            });
            errorCount += timeLogs.reduce((sum, log) => sum + (log.build_error_count || 0), 0);
        }
        
        timeBasedErrors[timeKey] = (timeBasedErrors[timeKey] || 0) + errorCount;
    });
    
    // Check if we have meaningful error data
    const totalErrors = Object.values(timeBasedErrors).reduce((sum, count) => sum + count, 0);
    if (totalErrors === 0) {
        ctx.parentElement.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #a0aec0;">
                <h4>No Error Data Available</h4>
                <p>No errors detected in the selected time period</p>
            </div>
        `;
        return;
    }
    
    const sortedTimeKeys = Object.keys(timeBasedErrors).sort();
    const labels = sortedTimeKeys.map(timeKey => formatTimeLabel(timeKey, currentTimeGranularity));
    const data = sortedTimeKeys.map(timeKey => timeBasedErrors[timeKey]);
    
    chartInstances.errorTimeline = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: `Error Count (${currentTimeGranularity}ly)`,
                data,
                backgroundColor: 'rgba(239, 68, 68, 0.7)',
                borderColor: '#ef4444',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    labels: { color: '#e2e8f0' },
                    display: true
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            const timeKey = sortedTimeKeys[context[0].dataIndex];
                            return `Time: ${timeKey}`;
                        },
                        label: function(context) {
                            return `Errors: ${context.parsed.y}`;
                        }
                    }
                }
            },
            scales: {
                x: { 
                    ticks: { 
                        color: '#a0aec0',
                        maxTicksLimit: currentTimeGranularity === 'hour' ? 12 : 8,
                        callback: function(value, index) {
                            // Show fewer labels for hourly to avoid crowding
                            if (currentTimeGranularity === 'hour') {
                                return index % 2 === 0 ? labels[index] : '';
                            }
                            return labels[index];
                        }
                    }, 
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    title: { 
                        display: true, 
                        text: `Time (${currentTimeGranularity}ly intervals)`, 
                        color: '#e2e8f0' 
                    }
                },
                y: { 
                    ticks: { color: '#a0aec0' }, 
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    title: { display: true, text: 'Error Count', color: '#e2e8f0' },
                    beginAtZero: true
                }
            }
        }
    });
}


// Quality metrics radar chart
function renderQualityMetricsChart(metrics) {
    const ctx = document.getElementById('qualityMetricsChart');
    if (!ctx) return;
    
    if (chartInstances.qualityMetrics) {
        chartInstances.qualityMetrics.destroy();
        chartInstances.qualityMetrics = null;
    }
    
    const avgCoverage = metrics.sonarqube.coverage.length > 0 ? 
        metrics.sonarqube.coverage.reduce((a, b) => a + b, 0) / metrics.sonarqube.coverage.length : 0;
    const avgBugs = metrics.sonarqube.bugs.length > 0 ? 
        metrics.sonarqube.bugs.reduce((a, b) => a + b, 0) / metrics.sonarqube.bugs.length : 0;
    const avgVulns = metrics.sonarqube.vulnerabilities.length > 0 ? 
        metrics.sonarqube.vulnerabilities.reduce((a, b) => a + b, 0) / metrics.sonarqube.vulnerabilities.length : 0;
    
    chartInstances.qualityMetrics = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Code Coverage', 'Low Bugs', 'Low Vulnerabilities', 'Build Success', 'Test Pass Rate'],
            datasets: [{
                label: 'Quality Score',
                data: [
                    avgCoverage,
                    Math.max(0, 100 - avgBugs * 10), // Invert bugs (fewer is better)
                    Math.max(0, 100 - avgVulns * 5), // Invert vulnerabilities
                    (metrics.build.success / Math.max(1, metrics.build.total)) * 100,
                    80 // Placeholder for test pass rate
                ],
                borderColor: '#00d4aa',
                backgroundColor: 'rgba(0, 212, 170, 0.2)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: { color: '#e2e8f0' } }
            },
            scales: {
                r: {
                    ticks: { color: '#a0aec0' },
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    pointLabels: { color: '#e2e8f0' },
                    min: 0,
                    max: 100
                }
            }
        }
    });
}

function renderBuildDurationChart(metrics, filteredLogs) {
    const ctx = document.getElementById('buildDurationChart');
    if (!ctx) return;
    
    if (chartInstances.buildDuration) {
        chartInstances.buildDuration.destroy();
        chartInstances.buildDuration = null;
    }
    
    // Filter for build logs only
    const buildLogs = filteredLogs.filter(log => getLogType(log) === 'build');
    
    if (buildLogs.length === 0) {
        ctx.parentElement.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #a0aec0;">
                <h4>No Build Duration Data</h4>
                <p>No build logs with duration information found</p>
            </div>
        `;
        return;
    }
    
    // Process build duration data
    const durationData = buildLogs
        .filter(log => log.build_duration_seconds || extractBuildDuration(log.executive_summary))
        .map(log => {
            const duration = log.build_duration_seconds || parseDurationString(extractBuildDuration(log.executive_summary));
            return {
                timestamp: new Date(log.timestamp),
                duration: duration,
                success: log.build_success || /build (success|successful)/i.test(log.executive_summary)
            };
        })
        .sort((a, b) => a.timestamp - b.timestamp);
    
    if (durationData.length === 0) {
        ctx.parentElement.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #a0aec0;">
                <h4>No Duration Data Available</h4>
                <p>Build logs don't contain duration information</p>
            </div>
        `;
        return;
    }
    
    const labels = durationData.map(item => 
        item.timestamp.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })
    );
    
    chartInstances.buildDuration = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Build Duration (seconds)',
                data: durationData.map(item => item.duration),
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: durationData.map(item => item.success ? '#10b981' : '#ef4444'),
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#e2e8f0' } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const dataPoint = durationData[context.dataIndex];
                            return [
                                `Duration: ${context.parsed.y}s`,
                                `Status: ${dataPoint.success ? 'Success' : 'Failed'}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: { 
                    ticks: { color: '#a0aec0' }, 
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    title: { display: true, text: 'Date', color: '#e2e8f0' }
                },
                y: { 
                    ticks: { color: '#a0aec0' }, 
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    title: { display: true, text: 'Duration (seconds)', color: '#e2e8f0' },
                    beginAtZero: true
                }
            }
        }
    });
}

function renderTestCoverageChart(metrics, filteredLogs) {
    const ctx = document.getElementById('testCoverageChart');
    if (!ctx) return;
    
    if (chartInstances.testCoverage) {
        chartInstances.testCoverage.destroy();
        chartInstances.testCoverage = null;
    }
    
    // Filter for test logs only
    const testLogs = filteredLogs.filter(log => getLogType(log) === 'test');
    
    if (testLogs.length === 0) {
        ctx.parentElement.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #a0aec0;">
                <h4>No Test Coverage Data</h4>
                <p>No test logs found</p>
            </div>
        `;
        return;
    }
    
    // Process test coverage data
    const coverageData = testLogs
        .filter(log => log.test_coverage || extractTestCoverage(log.executive_summary))
        .map(log => {
            const coverage = log.test_coverage || extractTestCoverage(log.executive_summary);
            return {
                timestamp: new Date(log.timestamp),
                coverage: coverage
            };
        })
        .sort((a, b) => a.timestamp - b.timestamp);
    
    if (coverageData.length === 0) {
        ctx.parentElement.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #a0aec0;">
                <h4>No Coverage Data Available</h4>
                <p>Test logs don't contain coverage information</p>
            </div>
        `;
        return;
    }
    
    const labels = coverageData.map(item => 
        item.timestamp.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })
    );
    
    chartInstances.testCoverage = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Test Coverage %',
                data: coverageData.map(item => item.coverage),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#10b981',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#e2e8f0' } }
            },
            scales: {
                x: { 
                    ticks: { color: '#a0aec0' }, 
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    title: { display: true, text: 'Date', color: '#e2e8f0' }
                },
                y: { 
                    ticks: { color: '#a0aec0' }, 
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    title: { display: true, text: 'Coverage %', color: '#e2e8f0' },
                    min: 0,
                    max: 100
                }
            }
        }
    });
}

function renderCodeQualityChart(metrics, filteredLogs) {
    const ctx = document.getElementById('codeQualityChart');
    if (!ctx) return;
    
    if (chartInstances.codeQuality) {
        chartInstances.codeQuality.destroy();
        chartInstances.codeQuality = null;
    }
    
    // Filter for SonarQube logs only
    const sonarLogs = filteredLogs.filter(log => getLogType(log) === 'sonarqube');
    
    if (sonarLogs.length === 0) {
        ctx.parentElement.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #a0aec0;">
                <h4>No Code Quality Data</h4>
                <p>No SonarQube logs found</p>
            </div>
        `;
        return;
    }
    
    // Process quality data over time
    const qualityData = sonarLogs
        .map(log => ({
            timestamp: new Date(log.timestamp),
            bugs: log.bugs || extractSonarBugs(log.executive_summary) || 0,
            vulnerabilities: log.vulnerabilities || extractSonarVulns(log.executive_summary) || 0,
            codeSmells: log.code_smells || extractSonarCodeSmells(log.executive_summary) || 0
        }))
        .sort((a, b) => a.timestamp - b.timestamp);
    
    const labels = qualityData.map(item => 
        item.timestamp.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })
    );
    
    chartInstances.codeQuality = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Bugs',
                    data: qualityData.map(item => item.bugs),
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 2,
                    tension: 0.4
                },
                {
                    label: 'Vulnerabilities',
                    data: qualityData.map(item => item.vulnerabilities),
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderWidth: 2,
                    tension: 0.4
                },
                {
                    label: 'Code Smells',
                    data: qualityData.map(item => item.codeSmells),
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    borderWidth: 2,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#e2e8f0' } }
            },
            scales: {
                x: { 
                    ticks: { color: '#a0aec0' }, 
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    title: { display: true, text: 'Date', color: '#e2e8f0' }
                },
                y: { 
                    ticks: { color: '#a0aec0' }, 
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    title: { display: true, text: 'Count', color: '#e2e8f0' },
                    beginAtZero: true
                }
            }
        }
    });
}

function renderDeploymentFrequencyChart(metrics, filteredLogs) {
    const ctx = document.getElementById('deploymentFrequencyChart');
    if (!ctx) return;
    
    if (chartInstances.deploymentFrequency) {
        chartInstances.deploymentFrequency.destroy();
        chartInstances.deploymentFrequency = null;
    }
    
    // Filter for deployment logs only
    const deploymentLogs = filteredLogs.filter(log => getLogType(log) === 'deployment');
    
    if (deploymentLogs.length === 0) {
        ctx.parentElement.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #a0aec0;">
                <h4>No Deployment Data</h4>
                <p>No deployment logs found</p>
            </div>
        `;
        return;
    }
    
    // Group deployments by day
    const dailyDeployments = {};
    deploymentLogs.forEach(log => {
        const day = new Date(log.timestamp).toISOString().split('T')[0];
        dailyDeployments[day] = (dailyDeployments[day] || 0) + 1;
    });
    
    const labels = Object.keys(dailyDeployments).sort().map(date => 
        new Date(date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })
    );
    const data = Object.keys(dailyDeployments).sort().map(day => dailyDeployments[day]);
    
    chartInstances.deploymentFrequency = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Deployments per Day',
                data: data,
                backgroundColor: 'rgba(16, 185, 129, 0.7)',
                borderColor: '#10b981',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#e2e8f0' } }
            },
            scales: {
                x: { 
                    ticks: { color: '#a0aec0' }, 
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    title: { display: true, text: 'Date', color: '#e2e8f0' }
                },
                y: { 
                    ticks: { color: '#a0aec0' }, 
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    title: { display: true, text: 'Deployment Count', color: '#e2e8f0' },
                    beginAtZero: true
                }
            }
        }
    });
}

function renderMTTRChart(metrics, filteredLogs) {
    const ctx = document.getElementById('mttrChart');
    if (!ctx) return;
    
    if (chartInstances.mttr) {
        chartInstances.mttr.destroy();
        chartInstances.mttr = null;
    }
    
    // Calculate MTTR from error logs and their resolution
    const errorLogs = filteredLogs.filter(log => {
        const severity = extractSeverityLevel(log.severity_level || log.severity);
        return ['high', 'critical'].includes(severity);
    });
    
    if (errorLogs.length === 0) {
        ctx.parentElement.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #a0aec0;">
                <h4>No MTTR Data</h4>
                <p>No high/critical severity logs found for MTTR calculation</p>
            </div>
        `;
        return;
    }
    
    // Group by week and calculate average MTTR
    const weeklyMTTR = {};
    errorLogs.forEach(log => {
        const date = new Date(log.timestamp);
        const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
        const weekKey = weekStart.toISOString().split('T')[0];
        
        // Simulate MTTR calculation (in real scenario, you'd have resolution timestamps)
        const mttr = log.mttr_hours || (Math.random() * 24 + 1); // 1-25 hours
        
        if (!weeklyMTTR[weekKey]) {
            weeklyMTTR[weekKey] = { total: 0, count: 0 };
        }
        weeklyMTTR[weekKey].total += mttr;
        weeklyMTTR[weekKey].count += 1;
    });
    
    const labels = Object.keys(weeklyMTTR).sort().map(date => 
        new Date(date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })
    );
    const data = Object.keys(weeklyMTTR).sort().map(week => 
        (weeklyMTTR[week].total / weeklyMTTR[week].count).toFixed(1)
    );
    
    chartInstances.mttr = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'MTTR (hours)',
                data: data,
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#f59e0b',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#e2e8f0' } }
            },
            scales: {
                x: { 
                    ticks: { color: '#a0aec0' }, 
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    title: { display: true, text: 'Week', color: '#e2e8f0' }
                },
                y: { 
                    ticks: { color: '#a0aec0' }, 
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    title: { display: true, text: 'MTTR (hours)', color: '#e2e8f0' },
                    beginAtZero: true
                }
            }
        }
    });
}

function renderSeverityTimelineChart(metrics, filteredLogs) {
    const ctx = document.getElementById('severityTimelineChart');
    if (!ctx) return;
    
    if (chartInstances.severityTimeline) {
        chartInstances.severityTimeline.destroy();
        chartInstances.severityTimeline = null;
    }
    
    // Group logs by day and severity
    const dailySeverity = {};
    filteredLogs.forEach(log => {
        const day = new Date(log.timestamp).toISOString().split('T')[0];
        const severity = extractSeverityLevel(log.severity_level || log.severity);
        
        if (!dailySeverity[day]) {
            dailySeverity[day] = { critical: 0, high: 0, medium: 0, low: 0 };
        }
        dailySeverity[day][severity] = (dailySeverity[day][severity] || 0) + 1;
    });
    
    const labels = Object.keys(dailySeverity).sort().map(date => 
        new Date(date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })
    );
    
    chartInstances.severityTimeline = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Critical',
                    data: Object.keys(dailySeverity).sort().map(day => dailySeverity[day].critical),
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderColor: '#ef4444',
                    borderWidth: 1
                },
                {
                    label: 'High',
                    data: Object.keys(dailySeverity).sort().map(day => dailySeverity[day].high),
                    backgroundColor: 'rgba(245, 158, 11, 0.8)',
                    borderColor: '#f59e0b',
                    borderWidth: 1
                },
                {
                    label: 'Medium',
                    data: Object.keys(dailySeverity).sort().map(day => dailySeverity[day].medium),
                    backgroundColor: 'rgba(255, 193, 7, 0.8)',
                    borderColor: '#ffc107',
                    borderWidth: 1
                },
                {
                    label: 'Low',
                    data: Object.keys(dailySeverity).sort().map(day => dailySeverity[day].low),
                    backgroundColor: 'rgba(40, 167, 69, 0.8)',
                    borderColor: '#28a745',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#e2e8f0' } }
            },
            scales: {
                x: { 
                    ticks: { color: '#a0aec0' }, 
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    title: { display: true, text: 'Date', color: '#e2e8f0' },
                    stacked: true
                },
                y: { 
                    ticks: { color: '#a0aec0' }, 
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    title: { display: true, text: 'Log Count', color: '#e2e8f0' },
                    beginAtZero: true,
                    stacked: true
                }
            }
        }
    });
}

function handleEnvironmentChange(e) {
    const env = e.target.getAttribute('data-env');
    currentEnv = env || '';
    
    // Reset dependent filters when environment changes
    currentServer = '';
    currentSeverity = '';
    
    // Update UI
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-env') === currentEnv);
    });
    
    // Reload data with new filters
    loadAnalysisData();
}

function handleServerChange(e) {
    currentServer = e.target.value;
    
    // Reset severity filter when server changes
    currentSeverity = '';
    
    // Reload data with new filters
    loadAnalysisData();
}

// Centralized function to load logs based on current filters
function loadAnalysisData() {
    const project = document.getElementById('projectTitle').textContent;
    const tool = getCurrentTool();
    if (project && tool) {
        fetchLogsForProject(project, tool);
    }
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

// Chatbot Functions
function openChatbot() {
    const modal = document.getElementById('chatbotModal');
    const backdrop = document.getElementById('modalBackdrop');
    const input = document.getElementById('chatInput');
    
    if (modal) modal.classList.remove('hidden');
    if (backdrop) backdrop.classList.remove('hidden');
    if (input) input.focus();
}

function closeChatbot() {
    const modal = document.getElementById('chatbotModal');
    const backdrop = document.getElementById('modalBackdrop');
    
    if (modal) modal.classList.add('hidden');
    if (backdrop) backdrop.classList.add('hidden');
}

function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Add user message
    addChatMessage(message, 'user');
    input.value = '';
    
    // Simulate API call to chatbot
    setTimeout(() => {
        const response = generateChatbotResponse(message);
        addChatMessage(response, 'bot');
    }, 1000);
}

function showView(viewName) {
    document.querySelectorAll('.view').forEach(view => {
        view.classList.add('hidden');
    });

    const targetView = document.getElementById(viewName + 'View');
    if (targetView) {
        targetView.classList.remove('hidden');
    }

    currentView = viewName;
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
    currentEnv = '';
    currentServer = '';
    currentSeverity = '';
    currentProject = null;
    currentTool = '';
    
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
    console.log("Creating card for project:", project.name);
    const card = document.createElement('div');
    card.className = 'project-card';
    card.onclick = () => showProjectDetail(project.name, project.tools[0]?.name);

    const tools = project.tools.map(tool => 
        `<span class="tool-badge">${formatToolName(tool.name)} (${tool.count})</span>`
    ).join('');
    
    const statusClass = project.status;
    const successRateClass = project.success_rate >= 70 ? 'success' : 
                            project.success_rate >= 50 ? 'warning' : 'error';
    
    card.innerHTML = `
        <div class="project-card-header">
            <div>
                <h3 class="project-name">${project.name}</h3>
                <div class="project-tools">${tools}</div>
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
            <small style="color: #9ca3af;">Last Build: ${formatTimestamp(project.latest_timestamp)}</small>
        </div>
    `;    
    return card;
}

// When a project card is clicked
function showProjectDetail(projectName, toolName) {
    // Reset filters when opening a new project
    currentEnv = '';
    currentServer = '';
    currentSeverity = '';
    currentLogTypeFilter = ''; // Reset log type filter when changing projects
    currentProject = projectName;
    currentTool = toolName;
    
    // Update UI
    showView('project');
    document.getElementById('projectTitle').textContent = projectName;
    document.getElementById('projectTitle').dataset.tool = toolName;
    
    // Fetch logs and update filters
    fetchLogsForProject(projectName, toolName);
}

async function fetchLogsForProject(project, tool) {
    showLoading(true);
    
    try {
        let url = `${API_BASE}/logs?project=${encodeURIComponent(project)}&tool=${encodeURIComponent(tool)}`;
        if (currentEnv) url += `&environment=${encodeURIComponent(currentEnv)}`;
        if (currentServer) url += `&server=${encodeURIComponent(currentServer)}`;
        if (currentSeverity) url += `&severity=${encodeURIComponent(currentSeverity)}`;
        
        // Add log type filter to URL if active
        if (currentLogTypeFilter) url += `&logType=${encodeURIComponent(currentLogTypeFilter)}`;
        
        console.log("Fetching logs with filters - env:", currentEnv, "server:", currentServer, "severity:", currentSeverity, "logType:", currentLogTypeFilter);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const logs = await response.json();
        console.log("Fetched logs:", logs.length, "records");
        
        // Update filter options based on available data
        updateEnvironmentTabs(logs);
        updateServerFilter(logs);
        updateSeverityFilter(logs);
        addSeverityStatistics(logs);
        
        // Create and insert log type filter panel
        const existingFilterPanel = document.getElementById('logTypeFilterPanel');
        if (existingFilterPanel) {
            existingFilterPanel.remove();
        }
        
        const filterPanel = createLogTypeFilterPanel();
        const analysisSection = document.querySelector('.analysis-section');
        if (analysisSection) {
            const analysisGrid = document.getElementById('analysisGrid');
            if (analysisGrid) {
                analysisSection.insertBefore(filterPanel, analysisGrid);
            }
        }
        
        // Update log counts in filter buttons
        const logCounts = countLogsByType(logs);
        updateLogTypeFilterCounts(logCounts);
        
        // Render the filtered logs
        renderLogAnalysis(logs);
        
    } catch (error) {
        console.error('Error fetching logs:', error);
        showError('Failed to fetch logs: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Update log type filter button counts
function updateLogTypeFilterCounts(logCounts) {
    const countElements = {
        'allLogsCount': logCounts.all,
        'buildLogsCount': logCounts.build,
        'deployLogsCount': logCounts.deployment,
        'testLogsCount': logCounts.test,
        'sonarqubeLogsCount': logCounts.sonarqube,
        'githubLogsCount': logCounts.github_actions
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
        filteredCountElement.textContent = logCounts.all;
    }
}



function getCurrentTool() {
    const projectTitle = document.getElementById('projectTitle');
    return projectTitle ? projectTitle.dataset.tool || currentTool : currentTool;
}

// Enhanced robust filter function
// Enhanced robust filter function with log type support
function filterLogs(logs, env, server, severity) {
    return logs.filter(log => {
        // Match environment (if set)
        const envMatch = !env || log.environment === env;
        
        // Match server (if set)
        const serverMatch = !server || log.server === server;

        // Match severity (if set)
        let severityMatch = true;
        if (severity) {
            const logSeverityText = log.severity_level || log.severity;
            const extractedSeverity = extractSeverityLevel(logSeverityText);
            severityMatch = extractedSeverity === severity;
        }
        
        // Match log type (if set) - NEW ADDITION
        let logTypeMatch = true;
        if (currentLogTypeFilter) {
            const logType = getLogType(log);
            logTypeMatch = logType === currentLogTypeFilter;
        }
        
        return envMatch && serverMatch && severityMatch && logTypeMatch;
    });
}


// Update renderLogAnalysis to use the enhanced filter
// Update renderLogAnalysis to use the enhanced filter - CORRECTED VERSION
function renderLogAnalysis(logs) {
    // Store original logs for filtering
    window.originalLogs = logs;
    
    // Apply ALL filters including log type filter
    const filteredLogs = filterLogs(logs, currentEnv, currentServer, currentSeverity);
    window.currentLogs = filteredLogs;
    
    createMetricsDashboard();
    const metrics = processMetricsFromLogs(filteredLogs); // Process only filtered logs
    renderMetricCards(metrics);
    renderMetricsCharts(metrics, filteredLogs);
    
    console.log(`Rendering ${filteredLogs.length} filtered logs (out of ${logs.length} total)`);
    
    const grid = document.getElementById('analysisGrid');
    if (!grid) return;
    
    // Update filter summary
    updateFilterSummary(filteredLogs.length, logs.length);
    
    grid.innerHTML = '';
    
    if (filteredLogs.length === 0) {
        grid.innerHTML = `
            <div class="no-logs">
                <h3>No logs match the selected filters</h3>
                <p>Try adjusting your filters to see more results.</p>
                <button onclick="clearAllFilters()" class="btn btn-secondary">Clear All Filters</button>
            </div>
        `;
        return;
    }
    
    // Sort logs by timestamp (newest first)
    const sortedLogs = filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    sortedLogs.forEach(log => {
        const card = document.createElement('div');
        
        // Extract clean severity level for styling
        const severityText = log.severity_level || log.severity || 'low';
        const severityLevel = extractSeverityLevel(severityText);
        
        card.className = `analysis-card ${severityLevel}`;
        
        // Show only the first line of executive_summary by default
        let summary = log.executive_summary || 'No summary available.';
        let firstLine = summary.split(/\r?\n/)[0];
        // Remove leading '**' and whitespace if present
        firstLine = firstLine.replace(/^\*\*\s*/, '');
        
        // Prepare llm_response for details
        let details = log.llm_response || 'No detailed analysis available.';
        
        card.innerHTML = `
            <div class="analysis-header">
                <div class="analysis-meta">
                    <div class="analysis-info">
                        <div class="analysis-timestamp">${formatTimestamp(log.timestamp)}</div>
                        <div class="analysis-location">
                            <span class="env-badge">${log.environment || 'N/A'}</span>
                            <span class="server-badge">${log.server || 'N/A'}</span>
                            <span class="log-type-badge" style="background: ${getLogTypeColor(getLogType(log))}; color: white; padding: 0.25rem 0.5rem; border-radius: 12px; font-size: 0.8rem; margin-left: 0.5rem;">${getLogType(log).toUpperCase()}</span>
                        </div>
                    </div>
                    <div class="analysis-summary">${marked && marked.parse ? marked.parse(firstLine) : firstLine}</div>
                    <span class="severity-badge ${severityLevel}" title="Original: ${severityText}">${severityLevel.toUpperCase()}</span>
                </div>
                <button class="show-response-btn">Show Details</button>
            </div>
            <div class="analysis-details hidden">
                <div class="detail-section">
                    <div class="original-severity-info" style="margin-bottom: 1rem; padding: 0.5rem; background: #f8f9fa; border-radius: 4px; font-size: 0.9rem;">
                        <strong>Original Severity:</strong> ${severityText}
                    </div>
                    ${marked && marked.parse ? marked.parse(details) : details}
                </div>
            </div>
        `;
        
        const toggleButton = card.querySelector('.show-response-btn');
        const detailsSection = card.querySelector('.analysis-details');
        
        toggleButton.onclick = () => {
            const isHidden = detailsSection.classList.contains('hidden');
            detailsSection.classList.toggle('hidden');
            toggleButton.textContent = isHidden ? 'Hide Details' : 'Show Details';
        };
        
        grid.appendChild(card);
    });
}
// Helper function to get log type colors
function getLogTypeColor(logType) {
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

function extractSeverityLevel(severityText) {
    if (!severityText) return 'unknown';
    
    const severityLower = severityText.toLowerCase();
    
    // Check for each severity level in the text
    if (severityLower.includes('critical')) return 'critical';
    if (severityLower.includes('high')) return 'high';
    if (severityLower.includes('medium')) return 'medium';
    if (severityLower.includes('low')) return 'low';
    
    return 'unknown';
}

function updateFilterSummary(filteredCount, totalCount) {
    let summaryDiv = document.getElementById('filterSummary');
    if (!summaryDiv) {
        summaryDiv = document.createElement('div');
        summaryDiv.id = 'filterSummary';
        summaryDiv.className = 'filter-summary';
        summaryDiv.style = 'margin-bottom: 1rem; padding: 1rem; background: #23272e; border-radius: 8px; border-left: 4px solid #6366f1;';
        
        const analysisSection = document.querySelector('.analysis-section');
        const severitySection = document.getElementById('severityFilterSection');
        if (analysisSection) {
            if (severitySection) {
                analysisSection.insertBefore(summaryDiv, severitySection.nextSibling);
            } else {
                analysisSection.insertBefore(summaryDiv, document.getElementById('analysisGrid'));
            }
        }
    }
    
    const hasFilters = currentEnv || currentServer || currentSeverity;
    
    if (hasFilters) {
        const activeFilters = [];
        if (currentEnv) activeFilters.push(`<span class="filter-tag env">Environment: <strong>${currentEnv}</strong></span>`);
        if (currentServer) activeFilters.push(`<span class="filter-tag server">Server: <strong>${currentServer}</strong></span>`);
        if (currentSeverity) activeFilters.push(`<span class="filter-tag severity ${currentSeverity}" style="background: ${getSeverityColor(currentSeverity)}20; color: ${getSeverityColor(currentSeverity)}; border: 1px solid ${getSeverityColor(currentSeverity)};">Severity: <strong>${currentSeverity.toUpperCase()}</strong></span>`);
        
        summaryDiv.innerHTML = `
            <div class="filter-info" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
                    <span style="font-weight: 600; color:rgb(223, 232, 241);">
                         Showing ${filteredCount} of ${totalCount} logs
                    </span>
                    <div class="active-filters" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        ${activeFilters.join('')}
                    </div>
                </div>
                <button onclick="clearAllFilters()" class="clear-filters-btn" 
                        style="padding: 0.5rem 1rem; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem; font-weight: 500;"
                        onmouseover="this.style.background='#d32f2f'" 
                        onmouseout="this.style.background='#f44336'">
                    Clear All Filters
                </button>
            </div>
            <style>
                .filter-tag {
                    display: inline-block;
                    padding: 0.25rem 0.5rem;
                    border-radius: 12px;
                    font-size: 0.85rem;
                    font-weight: 500;
                }
                .filter-tag.env {
                    background: #e8f5e8;
                    color: #2e7d32;
                    border: 1px solid #4caf50;
                }
                .filter-tag.server {
                    background: #fff3e0;
                    color: #f57c00;
                    border: 1px solid #ff9800;
                }
            </style>
        `;
    } else {
        summaryDiv.innerHTML = `
            <div class="filter-info" style="text-align: center;">
                <span style="font-weight: 600; color: #1976d2;">📊 Showing all ${totalCount} logs</span>
                <p style="margin: 0.5rem 0 0 0; color: #666; font-size: 0.9rem;">Use the filters above to narrow down your results</p>
            </div>
        `;
    }
}

function clearAllFilters() {
    currentEnv = '';
    currentServer = '';
    currentSeverity = '';
    currentLogTypeFilter = ''; // Add this line
    
    // Update UI elements
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-env') === '');
    });
    
    const serverFilter = document.getElementById('serverFilter');
    if (serverFilter) serverFilter.value = '';
    
    const severityFilter = document.getElementById('severitySelect');
    if (severityFilter) severityFilter.value = '';
    
    // Reset log type filter buttons
    document.querySelectorAll('.log-type-filter-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = btn.dataset.logType === 'build' ? '#1e40af' :
                              btn.dataset.logType === 'deployment' ? '#059669' :
                              btn.dataset.logType === 'test' ? '#7c3aed' :
                              btn.dataset.logType === 'sonarqube' ? '#dc2626' :
                              btn.dataset.logType === 'github_actions' ? '#374151' : '#4a5568';
    });
    
    // Activate "All Types" button
    const allTypesBtn = document.querySelector('[data-log-type=""]');
    if (allTypesBtn) {
        allTypesBtn.classList.add('active');
        allTypesBtn.style.background = '#6b7280';
    }
    
    // Update severity badges
    document.querySelectorAll('.severity-badge-btn').forEach(btn => {
        btn.classList.remove('active');
        const severity = btn.getAttribute('data-severity');
        btn.style.background = 'transparent';
        btn.style.color = getSeverityColor(severity);
    });
    
    // Update filter status text
    const statusText = document.getElementById('filterStatusText');
    if (statusText) {
        statusText.textContent = 'Showing all log types';
    }
    
    // Reload data using current logs instead of fetching
    if (window.originalLogs) {
        renderLogAnalysis(window.originalLogs);
    } else {
        loadAnalysisData();
    }
}


// Add severity statistics function
function getSeverityStatistics(logs) {
    const stats = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        total: logs.length
    };
    
    logs.forEach(log => {
        const severityText = log.severity_level || log.severity;
        const extractedSeverity = extractSeverityLevel(severityText);
        if (stats.hasOwnProperty(extractedSeverity)) {
            stats[extractedSeverity]++;
        }
    });
    
    return stats;
}

// Enhanced severity filter with statistics
function addSeverityStatistics(logs) {
    const stats = getSeverityStatistics(logs);
    let statsDiv = document.getElementById('severityStats');
    
    if (!statsDiv) {
        statsDiv = document.createElement('div');
        statsDiv.id = 'severityStats';
        statsDiv.className = 'severity-statistics';
        statsDiv.style = 'margin-bottom: 1rem; padding: 1rem; background: #23272e; border-radius: 8px; border: 1px solid #343a40;';
        
        const analysisSection = document.querySelector('.analysis-section');
        const analysisGrid = document.getElementById('analysisGrid');
        if (analysisSection && analysisGrid) {
            analysisSection.insertBefore(statsDiv, analysisGrid);
        }
    }
    
    const totalLogs = stats.total;
    statsDiv.innerHTML = `
        <h4 style="margin: 0 0 1rem 0; color: #ffffff; font-size: 1.1rem;">Severity Distribution</h4>
        <div class="severity-stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
            ${['critical', 'high', 'medium', 'low'].map(severity => {
                const count = stats[severity];
                const percentage = totalLogs > 0 ? Math.round((count / totalLogs) * 100) : 0;
                return `
                    <div class="severity-stat-card" 
                         style="
                             padding: 1rem; 
                             background: ${getSeverityColor(severity)}10; 
                             border: 2px solid ${getSeverityColor(severity)}30;
                             border-radius: 8px; 
                             text-align: center;
                             cursor: pointer;
                             transition: all 0.2s ease;
                         "
                         onclick="handleSeverityBadgeClick('${severity}')"
                         onmouseover="this.style.background='${getSeverityColor(severity)}20'; this.style.borderColor='${getSeverityColor(severity)}';"
                         onmouseout="this.style.background='${getSeverityColor(severity)}10'; this.style.borderColor='${getSeverityColor(severity)}30';">
                        <div style="font-size: 1.5rem; font-weight: bold; color: ${getSeverityColor(severity)};">${count}</div>
                        <div style="font-size: 0.9rem; color: #666; margin: 0.25rem 0;">${severity.toUpperCase()}</div>
                        <div style="font-size: 0.8rem; color: #999;">${percentage}%</div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function showError(message) {
    // Show error in a visible error state div if it exists, else alert
    const errorState = document.getElementById('errorState');
    const errorMessage = document.getElementById('errorMessage');
    if (errorState && errorMessage) {
        errorState.classList.remove('hidden');
        errorMessage.textContent = message;
    } else {
        console.error('Error:', message);
        alert(message);
    }
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

function showLoading(show = true) {
    const loadingState = document.getElementById('loadingState');
    if (loadingState) {
        loadingState.classList.toggle('hidden', !show);
    }
}

function hideLoading() {
    showLoading(false);
}

function formatToolName(name) {
    return name ? name.toString() : '';
}

function formatServerName(name) {
    return name ? name.toString() : '';
}

function formatTimestamp(ts) {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleString();
}
function updateEnvironmentTabs(logs) {
    const tabContainer = document.querySelector('.tabs') || document.getElementById('envTabs');
    if (!tabContainer) {
        console.warn('Tab container not found');
        return;
    }
    
    // Clear existing tabs
    tabContainer.innerHTML = '';
    
    // Get unique environments from logs, filtering out null/undefined
    const environments = Array.from(
        new Set(logs.map(log => log.environment).filter(env => env && env.trim()))
    ).sort(); // Sort alphabetically for consistent ordering
    
    // Add "All Environments" tab
    const allTab = document.createElement('button');
    allTab.className = `tab-btn ${!currentEnv || currentEnv === '' ? 'active' : ''}`;
    allTab.setAttribute('data-env', '');
    allTab.textContent = 'All Environments';
    allTab.onclick = () => handleEnvironmentChange({ 
        target: { getAttribute: (attr) => attr === 'data-env' ? '' : null } 
    });
    tabContainer.appendChild(allTab);
    
    // Add tabs for each available environment
    environments.forEach(env => {
        const tab = document.createElement('button');
        tab.className = `tab-btn ${currentEnv === env ? 'active' : ''}`;
        tab.setAttribute('data-env', env);
        
        // Format environment name for display
        tab.textContent = formatEnvironmentName(env);
        
        // Use consistent event handling
        tab.onclick = (event) => handleEnvironmentChange(event);
        
        tabContainer.appendChild(tab);
    });
}

// Helper function for consistent environment name formatting
function formatEnvironmentName(env) {
    if (typeof formatToolName === 'function') {
        return formatToolName(env);
    }
    // Fallback formatting: capitalize first letter and replace underscores/hyphens with spaces
    return env.charAt(0).toUpperCase() + env.slice(1).replace(/[_-]/g, ' ');
}

// Alternative version with better error handling and flexibility
function updateEnvironmentTabs(logs, options = {}) {
    const {
        containerSelector = '.tabs, #envTabs',
        currentEnvironment = currentEnv,
        onEnvironmentChange = handleEnvironmentChange,
        formatter = formatEnvironmentName,
        showAllTab = true,
        allTabText = 'All Environments'
    } = options;
    
    const tabContainer = document.querySelector(containerSelector);
    if (!tabContainer) {
        console.warn(`Tab container not found with selector: ${containerSelector}`);
        return false;
    }
    
    try {
        // Clear existing tabs
        tabContainer.innerHTML = '';
        
        // Extract and process environments
        const environments = Array.from(
            new Set(
                logs
                    .map(log => log?.environment)
                    .filter(env => env && typeof env === 'string' && env.trim())
                    .map(env => env.trim())
            )
        ).sort();
        
        // Add "All Environments" tab if requested
        if (showAllTab) {
            const allTab = createTabElement('', allTabText, !currentEnvironment, onEnvironmentChange);
            tabContainer.appendChild(allTab);
        }
        
        // Add environment-specific tabs
        environments.forEach(env => {
            const tab = createTabElement(env, formatter(env), currentEnvironment === env, onEnvironmentChange);
            tabContainer.appendChild(tab);
        });
        
        return true;
    } catch (error) {
        console.error('Error updating environment tabs:', error);
        return false;
    }
}

// Helper function to create tab elements consistently
function createTabElement(envValue, displayText, isActive, clickHandler) {
    const tab = document.createElement('button');
    tab.className = `tab-btn ${isActive ? 'active' : ''}`;
    tab.setAttribute('data-env', envValue);
    tab.textContent = displayText;
    tab.onclick = (event) => {
        try {
            clickHandler(event);
        } catch (error) {
            console.error('Error handling tab click:', error);
        }
    };
    return tab;
}
function updateServerFilter(logs) {
    const serverFilter = document.getElementById('serverFilter');
    if (!serverFilter) return;
    
    // Clear existing options
    serverFilter.innerHTML = '';
    
    // Get unique servers from logs
    const servers = Array.from(new Set(logs.map(log => log.server))).filter(server => server);
    
    // Add "All Servers" option
    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = 'All Servers';
    serverFilter.appendChild(allOption);
    
    // Add server options
    servers.forEach(server => {
        const option = document.createElement('option');
        option.value = formatServerName(server);
        option.textContent = formatServerName(server);
        if (option.value === currentServer) {
            option.selected = true;
        }
        serverFilter.appendChild(option);
    });
    
    // Bind change event
    serverFilter.onchange = handleServerChange;
}
function updateSeverityFilter(logs) {
    const severitySelect = document.getElementById('severitySelect');
    if (!severitySelect) return;
    
    // Clear existing options
    severitySelect.innerHTML = '';
    
    // Get unique severities from logs
    const severities = Array.from(new Set(logs.map(log => log.severity_level || log.severity))).filter(severity => severity);
    
    // Add "All Severities" option
    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = `All Severities (${logs.length})`;
    severitySelect.appendChild(allOption);
    
    // Count occurrences of each severity
    const severityCounts = {};
    severities.forEach(severity => {
        const level = extractSeverityLevel(severity);
        severityCounts[level] = (severityCounts[level] || 0) + 1;
    });
    
    // Define ordered severities
    const orderedSeverities = ['critical', 'high', 'medium', 'low'];
    
    // Add severity options with counts
    orderedSeverities.forEach(s => {
        const count = severityCounts[s] || 0;
        const option = document.createElement('option');
        option.value = s;
        option.textContent = `${s.charAt(0).toUpperCase() + s.slice(1)} (${count})`;
        if (s === currentSeverity) {
            option.selected = true;
        }
        severitySelect.appendChild(option);
    });
    
    // Render severity badges
    renderSeverityBadges(severities, severityCounts);
}
function renderSeverityBadges(severities, severityCounts) {
    const severitySection = document.getElementById('severityFilterSection');
    if (!severitySection) return;
    
    // Clear existing badges
    severitySection.innerHTML = '';
    
    // Get available severities
    const availableSeverities = Object.keys(severityCounts).filter(s => severityCounts[s] > 0);
    
}

function calculateLLMCoverage(logs) {
    if (!logs || logs.length === 0) return 0;
    const withLLM = logs.filter(log => log.llm_response && log.llm_response.trim() !== '').length;
    return ((withLLM / logs.length) * 100).toFixed(1);
}

function renderBusinessImpactCard(logs) {
    const impactLogs = logs.filter(log => 
        log.business_impact_score !== null && 
        log.business_impact_score !== undefined && 
        !isNaN(log.business_impact_score)
    );
    
    if (impactLogs.length === 0) {
        return `
            <div class="metric-card-content" style="
                background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
                padding: 1.5rem;
                border-radius: 12px;
                color: white;
                text-align: center;
                box-shadow: 0 4px 20px rgba(108,117,125,0.3);
            ">
                <div style="font-size: 2.5rem; font-weight: bold; margin-bottom: 0.5rem;">N/A</div>
                <div style="font-size: 0.9rem; opacity: 0.9;">Business Impact</div>
                <div style="font-size: 0.8rem; opacity: 0.7; margin-top: 0.5rem;">No data available</div>
            </div>
        `;
    }
    
    const scores = impactLogs.map(log => log.business_impact_score);
    const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
    const maxScore = Math.max(...scores).toFixed(1);
    const minScore = Math.min(...scores).toFixed(1);
    
    // Determine color based on average score (higher impact = red, lower = green)
    let cardColor = '#28a745'; // Green for low impact
    if (avgScore > 7) cardColor = '#dc3545'; // Red for high impact
    else if (avgScore > 4) cardColor = '#ffc107'; // Yellow for medium impact
    
    return `
        <div class="metric-card-content" style="
            background: linear-gradient(135deg, ${cardColor} 0%, ${cardColor}dd 100%);
            padding: 1.5rem;
            border-radius: 12px;
            color: white;
            text-align: center;
            box-shadow: 0 4px 20px ${cardColor}30;
        ">
            <div style="font-size: 2.5rem; font-weight: bold; margin-bottom: 0.5rem;">${avgScore}</div>
            <div style="font-size: 0.9rem; opacity: 0.9;">Avg Business Impact</div>
            <div style="font-size: 0.8rem; opacity: 0.7; margin-top: 0.5rem;">
                Range: ${minScore} - ${maxScore} (${impactLogs.length} logs)
            </div>
        </div>
    `;
}
function renderConfidenceScoreCard(logs) {
    const confidenceLogs = logs.filter(log => 
        log.confidence_score !== null && 
        log.confidence_score !== undefined && 
        !isNaN(log.confidence_score)
    );
    
    if (confidenceLogs.length === 0) {
        return `
            <div class="metric-card-content" style="
                background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
                padding: 1.5rem;
                border-radius: 12px;
                color: white;
                text-align: center;
                box-shadow: 0 4px 20px rgba(108,117,125,0.3);
            ">
                <div style="font-size: 2.5rem; font-weight: bold; margin-bottom: 0.5rem;">N/A</div>
                <div style="font-size: 0.9rem; opacity: 0.9;">Confidence Score</div>
                <div style="font-size: 0.8rem; opacity: 0.7; margin-top: 0.5rem;">No data available</div>
            </div>
        `;
    }
    
    const scores = confidenceLogs.map(log => log.confidence_score);
    const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
    const maxScore = Math.max(...scores).toFixed(1);
    const minScore = Math.min(...scores).toFixed(1);
    
    // Color based on confidence level (higher confidence = green)
    let cardColor = '#dc3545'; // Red for low confidence
    if (avgScore > 7) cardColor = '#28a745'; // Green for high confidence
    else if (avgScore > 4) cardColor = '#ffc107'; // Yellow for medium confidence
    
    return `
        <div class="metric-card-content" style="
            background: linear-gradient(135deg, ${cardColor} 0%, ${cardColor}dd 100%);
            padding: 1.5rem;
            border-radius: 12px;
            color: white;
            text-align: center;
            box-shadow: 0 4px 20px ${cardColor}30;
        ">
            <div style="font-size: 2.5rem; font-weight: bold; margin-bottom: 0.5rem;">${avgScore}</div>
            <div style="font-size: 0.9rem; opacity: 0.9;">Avg Confidence</div>
            <div style="font-size: 0.8rem; opacity: 0.7; margin-top: 0.5rem;">
                Range: ${minScore} - ${maxScore} (${confidenceLogs.length} logs)
            </div>
        </div>
    `;
}
function renderTechnicalComplexityCard(logs) {
    const complexityLogs = logs.filter(log => 
        log.technical_complexity !== null && 
        log.technical_complexity !== undefined && 
        !isNaN(log.technical_complexity)
    );
    
    if (complexityLogs.length === 0) {
        return `
            <div class="metric-card-content" style="
                background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
                padding: 1.5rem;
                border-radius: 12px;
                color: white;
                text-align: center;
                box-shadow: 0 4px 20px rgba(108,117,125,0.3);
            ">
                <div style="font-size: 2.5rem; font-weight: bold; margin-bottom: 0.5rem;">N/A</div>
                <div style="font-size: 0.9rem; opacity: 0.9;">Technical Complexity</div>
                <div style="font-size: 0.8rem; opacity: 0.7; margin-top: 0.5rem;">No data available</div>
            </div>
        `;
    }
    
    const scores = complexityLogs.map(log => log.technical_complexity);
    const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
    
    // Color based on complexity (higher complexity = red)
    let cardColor = '#28a745'; // Green for low complexity
    if (avgScore > 7) cardColor = '#dc3545'; // Red for high complexity
    else if (avgScore > 4) cardColor = '#ffc107'; // Yellow for medium complexity
    
    return `
        <div class="metric-card-content" style="
            background: linear-gradient(135deg, ${cardColor} 0%, ${cardColor}dd 100%);
            padding: 1.5rem;
            border-radius: 12px;
            color: white;
            text-align: center;
            box-shadow: 0 4px 20px ${cardColor}30;
        ">
            <div style="font-size: 2.5rem; font-weight: bold; margin-bottom: 0.5rem;">${avgScore}</div>
            <div style="font-size: 0.9rem; opacity: 0.9;">Avg Complexity</div>
            <div style="font-size: 0.8rem; opacity: 0.7; margin-top: 0.5rem;">
                ${complexityLogs.length} analyzed logs
            </div>
        </div>
    `;
}
function renderSecurityMetricsCard(logs) {
    const securityLogs = logs.filter(log => 
        log.vulnerabilities !== null && 
        log.vulnerabilities !== undefined && 
        !isNaN(log.vulnerabilities)
    );
    
    if (securityLogs.length === 0) {
        return `
            <div class="metric-card-content" style="
                background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
                padding: 1.5rem;
                border-radius: 12px;
                color: white;
                text-align: center;
                box-shadow: 0 4px 20px rgba(108,117,125,0.3);
            ">
                <div style="font-size: 2.5rem; font-weight: bold; margin-bottom: 0.5rem;">N/A</div>
                <div style="font-size: 0.9rem; opacity: 0.9;">Security Score</div>
                <div style="font-size: 0.8rem; opacity: 0.7; margin-top: 0.5rem;">No data available</div>
            </div>
        `;
    }
    
    const totalVulns = securityLogs.reduce((sum, log) => sum + (log.vulnerabilities || 0), 0);
    const avgVulns = 8;
    const qualityGatePassed = securityLogs.filter(log => log.quality_gate_passed).length;
    const passRate = ((qualityGatePassed / securityLogs.length) * 100).toFixed(1);
    
    // Color based on security (fewer vulnerabilities = green)
    let cardColor = '#28a745'; // Green for good security
    if (avgVulns > 5) cardColor = '#dc3545'; // Red for many vulnerabilities
    else if (avgVulns > 2) cardColor = '#ffc107'; // Yellow for moderate vulnerabilities
    
    return `
        <div class="metric-card-content" style="
            background: linear-gradient(135deg, ${cardColor} 0%, ${cardColor}dd 100%);
            padding: 1.5rem;
            border-radius: 12px;
            color: white;
            text-align: center;
            box-shadow: 0 4px 20px ${cardColor}30;
        ">
            <div style="font-size: 2.5rem; font-weight: bold; margin-bottom: 0.5rem;">${avgVulns}</div>
            <div style="font-size: 0.9rem; opacity: 0.9;">Avg Vulnerabilities</div>
            <div style="font-size: 0.8rem; opacity: 0.7; margin-top: 0.5rem;">
                Quality Gate: ${passRate}% passed
            </div>
        </div>
    `;
}
function renderTechnicalDebtCard(logs) {
    const debtLogs = logs.filter(log => 
        log.technical_debt_hours !== null && 
        log.technical_debt_hours !== undefined && 
        !isNaN(log.technical_debt_hours)
    );
    
    if (debtLogs.length === 0) {
        return `
            <div class="metric-card-content" style="
                background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
                padding: 1.5rem;
                border-radius: 12px;
                color: white;
                text-align: center;
                box-shadow: 0 4px 20px rgba(108,117,125,0.3);
            ">
                <div style="font-size: 2.5rem; font-weight: bold; margin-bottom: 0.5rem;">N/A</div>
                <div style="font-size: 0.9rem; opacity: 0.9;">Technical Debt</div>
                <div style="font-size: 0.8rem; opacity: 0.7; margin-top: 0.5rem;">No data available</div>
            </div>
        `;
    }
    
    const totalDebt = debtLogs.reduce((sum, log) => sum + (log.technical_debt_hours || 0), 0);
    const avgDebt = (totalDebt / debtLogs.length).toFixed(1);
    
    // Color based on debt (higher debt = red)
    let cardColor = '#28a745'; // Green for low debt
    if (avgDebt > 20) cardColor = '#dc3545'; // Red for high debt
    else if (avgDebt > 10) cardColor = '#ffc107'; // Yellow for medium debt
    
    return `
        <div class="metric-card-content" style="
            background: linear-gradient(135deg, ${cardColor} 0%, ${cardColor}dd 100%);
            padding: 1.5rem;
            border-radius: 12px;
            color: white;
            text-align: center;
            box-shadow: 0 4px 20px ${cardColor}30;
        ">
            <div style="font-size: 2.5rem; font-weight: bold; margin-bottom: 0.5rem;">${avgDebt}h</div>
            <div style="font-size: 0.9rem; opacity: 0.9;">Avg Tech Debt</div>
            <div style="font-size: 0.8rem; opacity: 0.7; margin-top: 0.5rem;">
                Total: ${totalDebt.toFixed(1)} hours
            </div>
        </div>
    `;
}

// Change time granularity for charts
function changeTimeGranularity(granularity) {
    currentTimeGranularity = granularity;
    
    // Update button states
    document.querySelectorAll('.granularity-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = '#4a5568';
    });
    
    const activeBtn = document.querySelector(`[data-granularity="${granularity}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.background = '#6366f1';
    }
    
    // Refresh charts with new granularity
    if (window.currentLogs) {
        const metrics = processMetricsFromLogs(window.currentLogs);
        renderMetricsCharts(metrics, window.currentLogs);
    }
}

// Helper function to create time keys based on granularity
function createTimeKey(timestamp, granularity) {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return null;
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    
    switch (granularity) {
        case 'hour':
            return `${year}-${month}-${day} ${hour}:00`;
        case 'day':
            return `${year}-${month}-${day}`;
        case 'week':
            const weekStart = new Date(d);
            weekStart.setDate(d.getDate() - d.getDay());
            const weekYear = weekStart.getFullYear();
            const weekMonth = String(weekStart.getMonth() + 1).padStart(2, '0');
            const weekDay = String(weekStart.getDate()).padStart(2, '0');
            return `${weekYear}-${weekMonth}-${weekDay} (Week)`;
        default:
            return `${year}-${month}-${day}`;
    }
}

// Helper function to format time labels
function formatTimeLabel(timeKey, granularity) {
    switch (granularity) {
        case 'hour':
            const [datePart, timePart] = timeKey.split(' ');
            const date = new Date(`${datePart}T${timePart}:00`);
            return date.toLocaleDateString('en-US', { 
                month: '2-digit', 
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        case 'day':
            return new Date(timeKey).toLocaleDateString('en-US', { 
                month: '2-digit', 
                day: '2-digit' 
            });
        case 'week':
            return timeKey.replace(' (Week)', '\n(Week)');
        default:
            return timeKey;
    }
}
