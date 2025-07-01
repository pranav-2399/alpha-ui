import {
  currentEnv, currentServer, currentSeverity, setCurrentEnv, setCurrentServer, setCurrentSeverity, setCurrentLogTypeFilter, getCurrentEnv, getCurrentServer, getCurrentSeverity,
} from '../state/state.js';
import { 
    getAvailableServers, extractSeverityLevel 
} from '../utils/filters.js';
import { 
    formatServerName, formatEnvironmentName, getSeverityColor 
} from '../utils/format.js';
import { 
    loadAnalysisData 
} from './dashboard.js'; // or where it's defined
import { 
    renderLogAnalysis 
} from './project.js';

export function updateServerFilter(logs) {
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
        setCurrentServer('');
        serverFilter.value = '';
    }
}

export function updateEnvironmentTabs(logs, options = {}) {
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

function createTabElement(envValue, displayText, isActive, clickHandler) {
    const tab = document.createElement('button');
    tab.className = `tab-btn ${isActive ? 'active' : ''}`;
    tab.setAttribute('data-env', envValue);
    tab.textContent = displayText;

    tab.style = `
        padding: 6px 16px;
        font-size: 0.95rem;
        margin: 4px;
        border-radius: 8px;
        background: ${isActive ? '#4f46e5' : '#374151'};
        color: white;
        border: none;
        font-weight: 500;
        transition: background 0.2s ease, transform 0.2s ease;
    `;

    tab.onmouseover = () => {
        tab.style.background = '#6366f1';
        tab.style.transform = 'scale(1.03)';
    };

    tab.onmouseout = () => {
        tab.style.background = isActive ? '#4f46e5' : '#374151';
        tab.style.transform = 'scale(1)';
    };
    
    tab.onclick = (event) => {
        try {
            clickHandler(event);
        } catch (error) {
            console.error('Error handling tab click:', error);
        }
    };
    return tab;
}
/* 
export function renderSeverityBadges(severities, severityCounts) {
    const severitySection = document.getElementById('severityFilterSection');
    if (!severitySection) return;
    
    // Clear existing badges
    severitySection.innerHTML = '';
    
    // Get available severities
    const availableSeverities = Object.keys(severityCounts).filter(s => severityCounts[s] > 0);
    
} */

function handleEnvironmentChange(e) {
    const env = e.target.getAttribute('data-env');
    setCurrentEnv(env || '');
    
    // Reset dependent filters when environment changes
    setCurrentServer('');
    setCurrentSeverity('');
    
    // Update UI
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-env') === currentEnv);
    });
    
    // Reload data with new filters
    loadAnalysisData();
}

export function handleServerChange(e) {
    setCurrentServer(e.target.value);
    // Reset severity filter when server changes
    setCurrentSeverity('');
    
    // Reload data with new filters
    loadAnalysisData();
}

export function clearAllFilters() {
    setCurrentEnv('');
    setCurrentServer('');
    setCurrentSeverity('');
    setCurrentLogTypeFilter('');
    
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

export function updateFilterSummary(filteredCount, totalCount) {
    let summaryDiv = document.getElementById('filterSummary');
    if (!summaryDiv) {
        summaryDiv = document.createElement('div');
        summaryDiv.id = 'filterSummary';
        summaryDiv.className = 'filter-summary';
        summaryDiv.style = `
            margin-bottom: 1rem; 
            padding: 1rem; 
            background: #23272e; 
            border-radius: 8px; 
            border-left: 4px solid #6366f1;
        `;
        
        const analysisSection = document.querySelector('.analysis-section');
        const logTypePanel = document.getElementById('logTypeFilterPanel')
        if (analysisSection && logTypePanel) {
            analysisSection.insertBefore(summaryDiv, logTypePanel.nextSibling);
        } else if (analysisSection) {
            analysisSection.insertBefore(summaryDiv, document.getElementById('analysisGrid'));
        }
    }

    console.log("check hasfilters:");
    console.log(getCurrentEnv(), getCurrentServer(), getCurrentSeverity());
    const hasFilters = currentEnv || currentServer || currentSeverity;
/*     
    if (hasFilters) {
        const activeFilters = [];
        if (currentEnv) activeFilters.push(`<span class="filter-tag env">Environment: <strong>${currentEnv}</></span>`);
        if (currentServer) activeFilters.push(`<span class="filter-tag server">Server: <strong>${currentServer}</strong></span>`);
        if (currentSeverity) activeFilters.push(`
            <span class="filter-tag severity ${currentSeverity}" style="
                background: ${getSeverityColor(currentSeverity)}20; 
                color: ${getSeverityColor(currentSeverity)}; 
                border: 1px solid ${getSeverityColor(currentSeverity)};
            ">
                Severity: <strong>${currentSeverity.toUpperCase()}</strong>
            </span>
        `);
        
        summaryDiv.innerHTML = `
            <div class="filter-info" style="
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                flex-wrap: wrap; 
                gap: 1rem;
            ">
                <div style="
                    display: flex; 
                    align-items: center; 
                    gap: 1rem; 
                    flex-wrap: wrap;
                ">
                    <span style="
                        font-weight: 600; 
                        color:rgb(223, 232, 241);
                    ">
                         Showing ${filteredCount} of ${totalCount} logs
                    </span>
                    <div class="active-filters" style="
                        display: flex; 
                        gap: 0.5rem; 
                        flex-wrap: wrap;
                    ">
                        ${activeFilters.join('')}
                    </div>
                </div>
                <button onclick="clearAllFilters()" class="clear-filters-btn" style="
                    padding: 0.5rem 1rem; 
                    background: #f44336; 
                    color: white; 
                    border: none; 
                    border-radius: 4px; 
                    cursor: pointer; 
                    font-size: 0.9rem; 
                    font-weight: 500;
                " onmouseover="this.style.background='#d32f2f'" onmouseout="this.style.background='#f44336'">
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
            <div class="filter-info" style="text-align: center">
                <span style="
                    font-weight: 600; 
                    color: #1976d2;
                ">
                    📊 Showing all ${totalCount} logs
                </span>
                <p style="
                    margin: 0.5rem 0 0 0; 
                    color: #666; 
                    font-size: 0.9rem;
                ">
                    Use the filters above to narrow down your results
                </p>
            </div>
        `;
    } */

    const activeFilters = [];
    summaryDiv.innerHTML = `
    <div class="filter-info" style="
        display: flex; 
        justify-content: space-between; 
        align-items: center; 
        flex-wrap: wrap; 
        gap: 1rem;
    ">
        <div style="
            display: flex; 
            align-items: center; 
            gap: 1rem; 
            flex-wrap: wrap;
        ">
            <span style="
                font-weight: 600; 
                color:rgb(223, 232, 241);
            ">
                    Showing ${filteredCount} of ${totalCount} logs
            </span>
            <div class="active-filters" style="
                display: flex; 
                gap: 0.5rem; 
                flex-wrap: wrap;
            ">
                ${activeFilters.join('')}
            </div>
        </div>
        <button onclick="clearAllFilters()" class="clear-filters-btn" style="
            padding: 0.5rem 1rem; 
            background: #f44336; 
            color: white; 
            border: none; 
            border-radius: 4px; 
            cursor: pointer; 
            font-size: 0.9rem; 
            font-weight: 500;
        " onmouseover="this.style.background='#d32f2f'" onmouseout="this.style.background='#f44336'">
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

}

export function addSeverityStatistics(logs) {
    const stats = getSeverityStatistics(logs);
    let statsDiv = document.getElementById('severityStats');
    
    if (!statsDiv) {
        statsDiv = document.createElement('div');
        statsDiv.id = 'severityStats';
        statsDiv.className = 'severity-statistics';
        statsDiv.style = `
            margin-bottom: 1rem; 
            padding: 1rem; 
            background: #23272e; 
            border-radius: 8px; 
            border: 1px solid #343a40;
        `;
        
        const analysisSection = document.querySelector('.analysis-section');
        const analysisGrid = document.getElementById('analysisGrid');
        if (analysisSection && analysisGrid) {
            analysisSection.insertBefore(statsDiv, analysisGrid);
        }
    }
    
    const totalLogs = stats.total;
    statsDiv.innerHTML = `
        <h4 style="
            margin: 0 0 1rem 0; 
            color: #ffffff; 
            font-size: 1.1rem;
        ">
            Severity Distribution
        </h4>
        <div class="severity-stats-grid" style="
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); 
            gap: 1rem;
        ">
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
                         onmouseover="
                            this.style.background='${getSeverityColor(severity)}20'; 
                            this.style.borderColor='${getSeverityColor(severity)}';
                        "
                         onmouseout="
                            this.style.background='${getSeverityColor(severity)}10'; 
                            this.style.borderColor='${getSeverityColor(severity)}30';
                        ">
                        <div style="
                            font-size: 1.5rem; 
                            font-weight: bold; 
                            color: ${getSeverityColor(severity)};
                        ">
                            ${count}
                        </div>
                        <div style="
                            font-size: 0.9rem; 
                            color: #666; 
                            margin: 0.25rem 0;
                        ">
                            ${severity.toUpperCase()}
                        </div>
                        <div style="
                            font-size: 0.8rem; 
                            color: #999;
                        ">
                            ${percentage}%
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

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

function handleSeverityBadgeClick(severity) {
    if (currentSeverity === severity) {
        // If clicking the same severity, clear the filter
        setCurrentSeverity('');
    } else {
        // Set new severity filter
        setCurrentSeverity(severity);
    }
    
    // Update dropdown to match
    const severitySelect = document.getElementById('severitySelect');
    if (severitySelect) {
        severitySelect.value = currentSeverity;
    }
    
    loadAnalysisData();
}

/* export function clearSeverityFilter() {
    setCurrentSeverity('');
    const severitySelect = document.getElementById('severitySelect');
    if (severitySelect) {
        severitySelect.value = '';
    }
    loadAnalysisData();
}
window.clearSeverityFilter = clearSeverityFilter; */

window.clearAllFilters = clearAllFilters;
window.handleSeverityBadgeClick = handleSeverityBadgeClick;

document.querySelectorAll('.clear-filters-btn').forEach(btn => {
    btn.addEventListener('click', clearAllFilters);
});

document.querySelectorAll('.severity-badge-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const severity = btn.dataset.severity;
        handleSeverityBadgeClick(severity);
    });
});