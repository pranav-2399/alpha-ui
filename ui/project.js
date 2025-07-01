import { 
    setCurrentEnv, setCurrentServer, setCurrentSeverity, setCurrentLogTypeFilter, setCurrentProject, setCurrentTool, currentEnv, currentServer, currentSeverity, currentLogTypeFilter, API_BASE
} from "../state/state.js";
import { 
    filterLogs, extractSeverityLevel
} from "../utils/filters.js";
import { 
    getLogTypeColor, formatTimestamp
} from "../utils/format.js";
import { 
    getLogType, processMetricsFromLogs
} from "../utils/metrics.js";
import { 
    renderMetricsCharts 
} from './charts.js';
import { 
    showView, createLogTypeFilterPanel, countLogsByType, createMetricsDashboard, updateLogTypeFilterCounts, updateAlertPanel
} from './dashboard.js';
import {
    updateEnvironmentTabs, updateServerFilter, addSeverityStatistics, updateFilterSummary
} from './filters.js';
import { 
    showLoading, showError 
} from './loading.js';
import { 
    renderMetricCards 
} from './metricsCards.js';

export function showProjectDetail(projectName, toolName) {
    // Reset filters when opening a new project
    setCurrentEnv('');
    setCurrentServer('');
    setCurrentSeverity('');
    setCurrentLogTypeFilter('');
    setCurrentProject(projectName);
    setCurrentTool(toolName);
    
    // Update UI
    showView('project');
    document.getElementById('projectTitle').textContent = projectName;
    document.getElementById('projectTitle').dataset.tool = toolName;
    
    // Fetch logs and update filters
    fetchLogsForProject(projectName, toolName);
}

export async function fetchLogsForProject(project, tool) {
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

        // Step 1: Dynamically create the shared wrapper
        let wrapper = document.getElementById('filterStatsWrapper');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.id = 'filterStatsWrapper';
            wrapper.className = 'filter-stats-wrapper';
            wrapper.style = `
                display: flex;
                flex-wrap: wrap;
                gap: 1rem;
                margin-bottom: 1rem;
                justify-content: space-between;
            `;

            const analysisSection = document.querySelector('.analysis-section');
            const analysisGrid = document.getElementById('analysisGrid');
            if (analysisSection && analysisGrid) {
                analysisSection.insertBefore(wrapper, analysisGrid);
            }
        }

        addSeverityStatistics(logs);
        
        // Create and insert log type filter panel
        const existingFilterPanel = document.getElementById('logTypeFilterPanel');
        if (existingFilterPanel) {
            existingFilterPanel.remove();
        }
        
        const filterPanel = createLogTypeFilterPanel();
        const analysisSection = document.querySelector('.analysis-section');
        const analysisGrid = document.getElementById('analysisGrid');
        if (analysisSection && analysisGrid) {
            analysisSection.insertBefore(filterPanel, analysisGrid);
        }
        
        // Update log counts in filter buttons
        const logCounts = countLogsByType(logs);
        updateLogTypeFilterCounts(logCounts, currentLogTypeFilter);
        
        // Render the filtered logs
        renderLogAnalysis(logs);
        updateAlertPanel(logs);
        
    } catch (error) {
        console.error('Error fetching logs:', error);
        showError('Failed to fetch logs: ' + error.message);
    } finally {
        showLoading(false);
    }
}

export function renderLogAnalysis(logs) {
    // Always store the original logs for future filtering
    window.originalLogs = logs;

    // When filtering, always start from window.originalLogs
    const baseLogs = window.originalLogs || logs;

    // Filter logs by currentLogTypeFilter
    const filteredLogs = currentLogTypeFilter
        ? baseLogs.filter(log => getLogType(log) === currentLogTypeFilter)
        : baseLogs;

    // Apply ALL filters including log type filter
    const finalFilteredLogs = filterLogs(filteredLogs, currentEnv, currentServer, currentSeverity);
    window.currentLogs = finalFilteredLogs;
    console.log("filtered logs in project.js ", finalFilteredLogs)
    createMetricsDashboard();
    const metrics = processMetricsFromLogs(finalFilteredLogs); // Process only filtered logs
    renderMetricCards(metrics, finalFilteredLogs);
    renderMetricsCharts(metrics, finalFilteredLogs);
    
    const grid = document.getElementById('analysisGrid');
    if (!grid) return;
    
    // Update filter summary
    updateFilterSummary(finalFilteredLogs.length, logs.length);
    
    grid.innerHTML = '';
    
    if (finalFilteredLogs.length === 0) {
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
    const sortedLogs = finalFilteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
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
                            <span class="log-type-badge" style="
                                background: ${getLogTypeColor(getLogType(log))}; 
                                color: white; 
                                padding: 0.25rem 0.5rem; 
                                border-radius: 12px; 
                                font-size: 0.8rem; 
                                margin-left: 0.5rem;
                            ">
                                ${getLogType(log).toUpperCase()}
                            </span>
                        </div>
                    </div>
                    <div class="analysis-summary">${marked && marked.parse ? marked.parse(firstLine) : firstLine}</div>
                    <span class="severity-badge ${severityLevel}" title="Original: ${severityText}">${severityLevel.toUpperCase()}</span>
                </div>
                <button class="show-response-btn">Show Details</button>
            </div>
            <div class="analysis-details hidden">
                <div class="detail-section">
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
    
    // After filtering and rendering
    const logCounts = countLogsByType(window.originalLogs || logs);
    updateLogTypeFilterCounts(logCounts, currentLogTypeFilter);
}