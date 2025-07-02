import { 
    currentTimeGranularity 
} from "../state/state.js";
import { 
    extractSeverityLevel 
} from "../utils/filters.js";
import { 
    getLogType, extractSonarBugs, extractSonarVulns, extractSonarCodeSmells, extractTestCoverage, parseDurationString
} from "../utils/metrics.js";

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

export function renderMetricsCharts(metrics, filteredLogs) {
    console.log('Rendering charts with metrics:', filteredLogs);
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

function renderSuccessTrendChart(metrics, filteredLogs) {
    console.log('Total timeline entries:', metrics.timeline.length);
    console.log("total timeline logs:", metrics)
    
    // Filter timeline to only include deployment logs (since we want deployment success)
    const deploymentTimeline = metrics.timeline.filter(item => item.logType === 'build');
    console.log('Build timeline entries:', deploymentTimeline.length);
    
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
            <div style="
                text-align: center; 
                padding: 2rem; 
                color: #a0aec0;
            ">
                <h4>No Deployment Logs Available</h4>
                <p>No deployment operations found for success trend analysis</p>
            </div>
        `;
        return;
    }
    
    // Process timeline data with actual timestamps
    const timelineData = [];
    console.log("Deployment timeline entries:", deploymentTimeline);
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
            <div style="
                text-align: center; 
                padding: 2rem; 
                color: #a0aec0;
            ">
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
            <div style="
                text-align: center; 
                padding: 2rem; 
                color: #a0aec0;
            ">
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
            <div style="
                text-align: center; 
                padding: 2rem; 
                color: #a0aec0;
            ">
                <h4>No Build Duration Data</h4>
                <p>No build logs with duration information found</p>
            </div>
        `;
        return;
    }
    
    // Process build duration data
    const durationData = buildLogs
        .map(log => {
            let duration = log.build_duration_seconds ;
            if (!duration && log.build_duration) {
                duration = parseDurationString(log.build_duration);
            }
            return {
                timestamp: new Date(log.timestamp),
                duration: duration,
                success: log.build_success || /build (success|successful)/i.test(log.executive_summary)
            };
        })
        .filter(item => item.duration)
        .sort((a, b) => a.timestamp - b.timestamp);
    
    if (durationData.length === 0) {
        ctx.parentElement.innerHTML = `
            <div style="
                text-align: center; 
                padding: 2rem; 
                color: #a0aec0;
            ">
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
    const testLogs = filteredLogs.filter(log => getLogType(log) === 'test' || getLogType(log) === 'sonarqube');
    console.log("Test logs:", testLogs);
    if (testLogs.length === 0) {
        ctx.parentElement.innerHTML = `
            <div style="
                text-align: center; 
                padding: 2rem; 
                color: #a0aec0;
            ">
                <h4>No Test Coverage Data</h4>
                <p>No test logs found</p>
            </div>
        `;
        return;
    }
    
    // Process test coverage data
    const coverageData = testLogs
        .filter(log => log.test_coverage || log.code_coverage || extractTestCoverage(log.executive_summary))
        .map(log => {
            console.log("code coverage for log:", log.code_coverage);
            const coverage = log.test_coverage || log.code_coverage || extractTestCoverage(log.executive_summary);
            console.log("Test coverage for log is ", coverage);
            if (coverage !== null && coverage !== undefined) {
                return {
                    timestamp: new Date(log.timestamp),
                    coverage: coverage
                };}
            return null;
        })
        .filter(item => item)
        .sort((a, b) => a.timestamp - b.timestamp);
    console.log("Coverage data:", coverageData);
    if (coverageData.length === 0) {
        ctx.parentElement.innerHTML = `
            <div style="
                text-align: center; 
                padding: 2rem; 
                color: #a0aec0;
            ">
                <h4>No Coverage Data Available</h4>
                <p>Test logs don't contain coverage information</p>
            </div>
        `;
        return;
    }
    
    const labels = coverageData.map(item =>
        item.timestamp.toLocaleString('en-US') // or just item.timestamp
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
            <div style="
                text-align: center; 
                padding: 2rem; 
                color: #a0aec0;
            ">
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
        item.timestamp.toLocaleDateString('en-US')
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

/* function renderDeploymentFrequencyChart(metrics, filteredLogs) {
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
            <div style="
                text-align: center; 
                padding: 2rem; 
                color: #a0aec0;
            ">
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
        new Date(date).toLocaleDateString('en-US')
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
} */

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
            <div style="
                text-align: center; 
                padding: 2rem; 
                color: #a0aec0;
            ">
                <h4>No Deployment Data</h4>
                <p>No deployment logs found</p>
            </div>
        `;
        return;
    }
    
    // Group deployments by hour (date + hour)
    const hourlyDeployments = {};
    deploymentLogs.forEach(log => {
        const d = new Date(log.timestamp);
        if (isNaN(d.getTime())) return;
        const hourKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`;
        hourlyDeployments[hourKey] = (hourlyDeployments[hourKey] || 0) + 1;
    });

    const sortedHourKeys = Object.keys(hourlyDeployments).sort();
    const labels = sortedHourKeys.map(hourKey => {
        // Format as "MM/DD HH:00"
        const [datePart, timePart] = hourKey.split(' ');
        const date = new Date(`${datePart}T${timePart}:00`);
        return `${date.toLocaleDateString('en-US')} ${timePart}`;
    });
    const data = sortedHourKeys.map(hourKey => hourlyDeployments[hourKey]);
    
    chartInstances.deploymentFrequency = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Deployments per Hour',
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
                    ticks: { color: '#a0aec0', maxTicksLimit: 12 }, 
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    title: { display: true, text: 'Timeline', color: '#e2e8f0' }
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
        return ['high', 'critical', 'medium', 'low'].includes(severity);
    });
    
    if (errorLogs.length === 0) {
        ctx.parentElement.innerHTML = `
            <div style="
                text-align: center; 
                padding: 2rem; 
                color: #a0aec0;
            ">
                <h4>No MTTR Data</h4>
                <p>No high/critical severity logs found for MTTR calculation</p>
            </div>
        `;
        return;
    }
    
    // Group by week and calculate average MTTR
/*     const weeklyMTTR = {};
    errorLogs.forEach(log => {
        const date = new Date(log.timestamp);
        const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
        const weekKey = weekStart.toISOString().split('T')[0];
        console.log("logs for mttr", log)
        // Simulate MTTR calculation (in real scenario, you'd have resolution timestamps)
        const mttr = log.mttr_hours || (Math.random() * 5 + 1); // 1-25 hours
        
        if (!weeklyMTTR[weekKey]) {
            weeklyMTTR[weekKey] = { total: 0, count: 0 };
        }
        weeklyMTTR[weekKey].total += mttr;
        weeklyMTTR[weekKey].count += 1;
    });
    
    const labels = Object.keys(weeklyMTTR).sort().map(date => 
        new Date(date).toLocaleDateString('en-US')
    );
    const data = Object.keys(weeklyMTTR).sort().map(week => 
        (weeklyMTTR[week].total / weeklyMTTR[week].count).toFixed(1)
    ); */

    const mttrData = errorLogs
        .map(log => ({
            timestamp: new Date(log.timestamp),
            mttr: log.mttr_hours || (Math.random() * 3 + 1) // Simulate if not present
        }))
        .sort((a, b) => a.timestamp - b.timestamp);

    const labels = mttrData.map(item =>
        item.timestamp.toLocaleString('en-US', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    );
    const data = mttrData.map(item => item.mttr.toFixed(1));
    
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

/* function renderSeverityTimelineChart(metrics, filteredLogs) {
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
        new Date(date).toLocaleDateString('en-US')
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
} */

function renderSeverityTimelineChart(metrics, filteredLogs) {
    const ctx = document.getElementById('severityTimelineChart');
    if (!ctx) return;
    
    if (chartInstances.severityTimeline) {
        chartInstances.severityTimeline.destroy();
        chartInstances.severityTimeline = null;
    }
    
    // Group logs by full timestamp (date + time, rounded to hour)
    const hourlySeverity = {};
    filteredLogs.forEach(log => {
        // Group by hour for better time granularity
        const d = new Date(log.timestamp);
        if (isNaN(d.getTime())) return;
        const hourKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`;
        const severity = extractSeverityLevel(log.severity_level || log.severity);
        
        if (!hourlySeverity[hourKey]) {
            hourlySeverity[hourKey] = { critical: 0, high: 0, medium: 0, low: 0 };
        }
        hourlySeverity[hourKey][severity] = (hourlySeverity[hourKey][severity] || 0) + 1;
    });
    
    const sortedHourKeys = Object.keys(hourlySeverity).sort();
    const labels = sortedHourKeys.map(hourKey => {
        // Format as "MM/DD HH:00"
        const [datePart, timePart] = hourKey.split(' ');
        const date = new Date(`${datePart}T${timePart}:00`);
        return `${date.toLocaleDateString('en-US')} ${timePart}`;
    });

    chartInstances.severityTimeline = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Critical',
                    data: sortedHourKeys.map(hourKey => hourlySeverity[hourKey].critical),
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderColor: '#ef4444',
                    borderWidth: 1
                },
                {
                    label: 'High',
                    data: sortedHourKeys.map(hourKey => hourlySeverity[hourKey].high),
                    backgroundColor: 'rgba(245, 158, 11, 0.8)',
                    borderColor: '#f59e0b',
                    borderWidth: 1
                },
                {
                    label: 'Medium',
                    data: sortedHourKeys.map(hourKey => hourlySeverity[hourKey].medium),
                    backgroundColor: 'rgba(255, 193, 7, 0.8)',
                    borderColor: '#ffc107',
                    borderWidth: 1
                },
                {
                    label: 'Low',
                    data: sortedHourKeys.map(hourKey => hourlySeverity[hourKey].low),
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
                    ticks: { color: '#a0aec0', maxTicksLimit: 12 },
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    title: { display: true, text: 'Timeline', color: '#e2e8f0' },
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

function formatTimeLabel(timeKey, granularity) {
    switch (granularity) {
        case 'hour':
            const [datePart, timePart] = timeKey.split(' ');
            const date = new Date(`${datePart}T${timePart}:00`);
            return date.toLocaleDateString('en-US');
        case 'day':
            return new Date(timeKey).toLocaleDateString('en-US');
        case 'week':
            return timeKey.replace(' (Week)', '\n(Week)');
        default:
            return timeKey;
    }
}