import { analysisData } from "../state/state.js";
import { calculateLLMCoverage, getLogType, parseDurationString } from "../utils/metrics.js";
import { getGradientColor, formatDuration } from '../utils/format.js';

export function renderMetricCards(metrics, filteredLogs) {
    // Success Rate Card
    const totalBuilds = metrics.build.total + metrics.deployment.total;
    const successfulBuilds = metrics.build.success + metrics.deployment.success;
    const successRate = totalBuilds > 0 ? ((successfulBuilds / totalBuilds) * 100).toFixed(1) : 0;
    let [successMainColor, successAccentColor] = getGradientColor(100 - successRate, 0, 100); // Green to red gradient based on success rate

    const llmcoveragerate =  100; // Assuming llmCoverage is calculated elsewhere
    const businessImpactCard = renderBusinessImpactCard(currentLogs);
    const confidenceCard = renderConfidenceScoreCard(currentLogs);
    const complexityCard = renderTechnicalComplexityCard(currentLogs);
    const securityCard = renderSecurityMetricsCard(currentLogs);
    const debtCard = renderTechnicalDebtCard(currentLogs);
    document.getElementById('successRateCard').innerHTML = `
        <div class="metric-card-content" style="
            background: linear-gradient(135deg, ${successMainColor} 0%, ${successAccentColor} 100%);
            padding: 1.5rem;
            border-radius: 12px;
            color: white;
            text-align: center;
            box-shadow: 0 4px 20px ${successMainColor}30;
        ">
            <div style="
                font-size: 2.5rem; 
                font-weight: bold; 
                margin-bottom: 0.5rem;
            ">
                ${successRate}%
            </div>
            <div style="
                font-size: 0.9rem; 
                opacity: 0.9;
            ">
                Success Rate
            </div>
            <div style="
                font-size: 0.8rem; 
                opacity: 0.7; 
                margin-top: 0.5rem;
            ">
                ${successfulBuilds}/${totalBuilds} successful
            </div>
        </div>
    `;

    console.log("filtered logs", filteredLogs);
    const buildLogs = filteredLogs.filter(log => getLogType(log) === 'build');
    
    // Average Duration Card
    console.log(metrics.build);
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
    
    console.log("durationData", durationData);
    const avgDuration = durationData.length > 0 ? 
        (durationData.reduce((a, b) => a + b.duration, 0) / durationData.length) 
        : 0;
    
    console.log("build duration:", avgDuration);

    document.getElementById('avgDurationCard').innerHTML = `
        <div class="metric-card-content" style="
            background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
            padding: 1.5rem;
            border-radius: 12px;
            color: white;
            text-align: center;
            box-shadow: 0 4px 20px rgba(99,102,241,0.3);
        ">
            <div style="
                font-size: 2.5rem; 
                font-weight: bold; 
                margin-bottom: 0.5rem;
            ">
                ${formatDuration(avgDuration)}
            </div>
            <div style="
                font-size: 0.9rem; 
                opacity: 0.9;
            ">
                Avg Build Time
            </div>
            <div style="
                font-size: 0.8rem; 
                opacity: 0.7; 
                margin-top: 0.5rem;
            ">
                ${durationData.length} builds
            </div>
        </div>
    `;
    
    // Error Rate Card
    const totalErrors = metrics.build.errors.reduce((a, b) => a + b, 0) + 
                       metrics.deployment.errors.reduce((a, b) => a + b, 0);
    const errorRate = totalBuilds > 0 ? (totalErrors / totalBuilds).toFixed(1) : 0;
    const [errorMainColor, errorAccentColor] = getGradientColor(errorRate, 0, 10); // Green to red gradient based on error rate
    
    
    document.getElementById('errorRateCard').innerHTML = `
        <div class="metric-card-content" style="
            background: linear-gradient(135deg, ${errorMainColor} 0%, ${errorAccentColor} 100%);
            padding: 1.5rem;
            border-radius: 12px;
            color: white;
            text-align: center;
            box-shadow: 0 4px 20px ${errorMainColor}30);
        ">
            <div style="
                font-size: 2.5rem; 
                font-weight: bold; 
                margin-bottom: 0.5rem;
            ">
                ${Math.round(errorRate)}
            </div>
            <div style="
                font-size: 0.9rem; 
                opacity: 0.9;
            ">
                Average Errors per Build
            </div>
            <div style="
                font-size: 0.8rem; 
                opacity: 0.7; 
                margin-top: 0.5rem;
            ">
                ${totalErrors} total errors
            </div>
        </div>
    `;
    
    // Coverage Card
    const avgCoverage = metrics.test.coverage.length > 0 ? 
        (metrics.test.coverage.reduce((a, b) => a + b, 0) / metrics.test.coverage.length).toFixed(1) : 
        (metrics.sonarqube.coverage.length > 0 ? 
         (metrics.sonarqube.coverage.reduce((a, b) => a + b, 0) / metrics.sonarqube.coverage.length).toFixed(1) : 0);
    const [coverageMainColor, coverageAccentColor] = getGradientColor(100 - avgCoverage, 0, 100); // Green to red gradient based on coverage
    
    document.getElementById('coverageCard').innerHTML = `
        <div class="metric-card-content" style="
            background: linear-gradient(135deg, ${coverageMainColor} 0%, ${coverageAccentColor} 100%);
            padding: 1.5rem;
            border-radius: 12px;
            color: white;
            text-align: center;
            box-shadow: 0 4px 20px ${coverageMainColor}30;
        ">
            <div style="
                font-size: 2.5rem; 
                font-weight: bold; 
                margin-bottom: 0.5rem;
            ">
                ${avgCoverage}%
            </div>
            <div style="
                font-size: 0.9rem; 
                opacity: 0.9;
            ">
                Code Coverage
            </div>
            <div style="
                font-size: 0.8rem; 
                opacity: 0.7; 
                margin-top: 0.5rem;
            ">
                Average across tests
            </div>
        </div>
    `;
    
    const llmCoverage = calculateLLMCoverage(analysisData); // or whatever your logs array is called

    const [llmCoverageMainColor, llmCoverageAccentColor] = getGradientColor(100 - llmCoverage, 0, 100); // Green to red gradient based on LLM coverage

    const llmTooltip = "LLM Coverage: Percentage of logs with AI-generated analysis";
    // Add this card to your metrics cards grid (outside the project loop, in the main dashboard)
    const llmCard = `
        <div class="metric-card" style="
            background: linear-gradient(135deg, ${llmCoverageMainColor} 0%, ${llmCoverageAccentColor} 100%); 
            color: #90caf9; 
            border-radius: 12px; 
            padding: 1.5rem; 
            text-align: center;
            box-shadow: 0 4px 20px ${llmCoverageMainColor}30;
            position: relative;
        ">
            <span class="metric-tooltip">
                <img src="ai_logo.png" alt="AI" style="
                    position: absolute; 
                    top: 12px; 
                    right: 12px; 
                    width: 28px; 
                    height: 28px;
                    opacity: 0.85;
                    background: transparent;
                    cursor: pointer;
                " />
                <span class="tooltip-text">
                    ${llmTooltip}
                </span>
            </span>
            <div style="
                font-size: 2.2rem; 
                font-weight: 700; 
                color: #ffffff;
            ">
                ${llmCoverage}%
            </div>
            <div style="
                font-size: 1rem; 
                margin-top: 0.5rem;
            ">
                LLM Coverage
            </div>
            <div style="
                font-size: 0.9rem; 
                color: #a0aec0;
            ">
                Logs with LLM response
            </div>
        </div>
    `;

    const metricsGrid = document.querySelector('.metrics-cards-grid');
    metricsGrid.innerHTML = `
        <!-- AI-generated metrics first -->
        ${llmCard}
        <div class="metric-card">${businessImpactCard}</div>
        <div class="metric-card">${confidenceCard}</div>
        <div class="metric-card">${complexityCard}</div>
        <div class="metric-card">${debtCard}</div>
        <!-- Standard metrics next -->
        <div class="metric-card" id="successRateCard"></div>
        <div class="metric-card" id="avgDurationCard"></div>
        <div class="metric-card" id="errorRateCard"></div>
        <div class="metric-card" id="coverageCard"></div>
        <div class="metric-card">${securityCard}</div>
    `;

    // Now render the standard metric cards into their containers as before
    document.getElementById('successRateCard').innerHTML = `
        <div class="metric-card-content" style="
            background: linear-gradient(135deg, ${successMainColor} 0%, ${successAccentColor} 100%);
            padding: 1.5rem;
            border-radius: 12px;
            color: white;
            text-align: center;
            box-shadow: 0 4px 20px ${successMainColor}30;
        ">
            <div style="
                font-size: 2.5rem; 
                font-weight: bold; 
                margin-bottom: 0.5rem;
            ">
                ${successRate}%
            </div>
            <div style="
                font-size: 0.9rem; 
                opacity: 0.9;
            ">
                Success Rate
            </div>
            <div style="
                font-size: 0.8rem; 
                opacity: 0.7; 
                margin-top: 0.5rem;
            ">
                ${successfulBuilds}/${totalBuilds} successful
            </div>
        </div>
    `;

    document.getElementById('avgDurationCard').innerHTML = `
        <div class="metric-card-content" style="
            background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
            padding: 1.5rem;
            border-radius: 12px;
            color: white;
            text-align: center;
            box-shadow: 0 4px 20px rgba(99,102,241,0.3);
        ">
            <div style="
                font-size: 2.5rem; 
                font-weight: bold; 
                margin-bottom: 0.5rem;
            ">
                ${formatDuration(avgDuration)}
            </div>
            <div style="
                font-size: 0.9rem; 
                opacity: 0.9;
            ">
                Avg Build Time
            </div>
            <div style="
                font-size: 0.8rem; 
                opacity: 0.7; 
                margin-top: 0.5rem;
            ">
                ${durationData.length} builds
            </div>
        </div>
    `;
    
    document.getElementById('errorRateCard').innerHTML = `
        <div class="metric-card-content" style="
            background: linear-gradient(135deg, ${errorMainColor} 0%, ${errorAccentColor} 100%);
            padding: 1.5rem;
            border-radius: 12px;
            color: white;
            text-align: center;
            box-shadow: 0 4px 20px ${errorMainColor}30);
        ">
            <div style="
                font-size: 2.5rem; 
                font-weight: bold; 
                margin-bottom: 0.5rem;
            ">
                ${Math.round(errorRate)}
            </div>
            <div style="
                font-size: 0.9rem; 
                opacity: 0.9;
            ">
                Average Errors per Build
            </div>
            <div style="
                font-size: 0.8rem; 
                opacity: 0.7; 
                margin-top: 0.5rem;
            ">
                ${totalErrors} total errors
            </div>
        </div>
    `;
    
    document.getElementById('coverageCard').innerHTML = `
        <div class="metric-card-content" style="
            background: linear-gradient(135deg, ${coverageMainColor} 0%, ${coverageAccentColor} 100%);
            padding: 1.5rem;
            border-radius: 12px;
            color: white;
            text-align: center;
            box-shadow: 0 4px 20px ${coverageMainColor}30;
        ">
            <div style="
                font-size: 2.5rem; 
                font-weight: bold; 
                margin-bottom: 0.5rem;
            ">
                ${avgCoverage}%
            </div>
            <div style="
                font-size: 0.9rem; 
                opacity: 0.9;
            ">
                Code Coverage
            </div>
            <div style="
                font-size: 0.8rem; 
                opacity: 0.7; 
                margin-top: 0.5rem;
            ">
                Average across tests
            </div>
        </div>
    `;
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
                position: relative;
            ">
                <img src="ai_logo.png" alt="AI" style="
                    position: absolute; 
                    top: 12px; 
                    right: 12px; 
                    width: 28px; 
                    height: 28px; 
                    opacity: 0.85;
                " />
                <div style="
                    font-size: 2.5rem; 
                    font-weight: bold; 
                    margin-bottom: 0.5rem;
                ">
                    N/A
                </div>
                <div style="
                    font-size: 0.9rem; 
                    opacity: 0.9;
                ">
                    Business Impact
                </div>
                <div style="
                    font-size: 0.8rem; 
                    opacity: 0.7; 
                    margin-top: 0.5rem;
                ">
                    No data available
                </div>
            </div>
        `;
    }
    
    const scores = impactLogs.map(log => log.business_impact_score);
    console.log("total confidence: ", scores.reduce((a, b) => a + b, 0));
    console.log("lengh:", scores.length);
    const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(3) * 100;
    const maxScore = Math.max(...scores).toFixed(3) * 100;
    const minScore = Math.min(...scores).toFixed(3) * 100;
    
    const [cardMainColor, cardAccentColor] = getGradientColor(100 - avgScore, 0, 100);

    const businessImpactTooltip = "Business Impact: Estimated impact score from AI analysis";
    return `
        <div class="metric-card-content" style="
            background: linear-gradient(135deg, ${cardMainColor} 0%, ${cardAccentColor} 100%);
            padding: 1.5rem;
            border-radius: 12px;
            color: white;
            text-align: center;
            box-shadow: 0 4px 20px ${cardMainColor}30;
            position: relative;
        ">
            <span class="metric-tooltip">
                <img src="ai_logo.png" alt="AI" style="
                    position: absolute; 
                    top: 12px; 
                    right: 12px; 
                    width: 28px; 
                    height: 28px; 
                    opacity: 0.85;
                    background: transparent;
                    cursor: pointer;
                " />
                <span class="tooltip-text">
                    ${businessImpactTooltip}
                </span>
            </span>
            <div style="
                font-size: 2.5rem; 
                font-weight: bold; 
                margin-bottom: 0.5rem;
            ">
                ${avgScore}%
            </div>
            <div style="
                font-size: 0.9rem; 
                opacity: 0.9;
            ">
                Average Business Impact
            </div>
            <div style="
                font-size: 0.8rem; 
                opacity: 0.7; 
                margin-top: 0.5rem;
            ">
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
                position: relative;
            ">
                <img src="ai_logo.png" alt="AI" style="
                    position: absolute; 
                    top: 12px; 
                    right: 12px; 
                    width: 28px; 
                    height: 28px; 
                    opacity: 0.85;
                " />
                <div style="
                    font-size: 2.5rem; 
                    font-weight: bold; 
                    margin-bottom: 0.5rem;
                ">
                    N/A
                </div>
                <div style="
                    font-size: 0.9rem; 
                    opacity: 0.9;
                ">
                    Confidence Score
                </div>
                <div style="
                    font-size: 0.8rem; 
                    opacity: 0.7; 
                    margin-top: 0.5rem;
                ">
                    No data available
                </div>
            </div>
        `;
    }
    
    const scores = confidenceLogs.map(log => log.confidence_score);
    const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) * 100;
    const maxScore = Math.max(...scores).toFixed(1) * 100;
    const minScore = Math.min(...scores).toFixed(1) * 100;
    
    const [cardMainColor, cardAccentColor] = getGradientColor(100 - avgScore, 0, 100);
    const confidenceTooltip = "Confidence Score: AI's confidence in its analysis";
    return `
        <div class="metric-card-content" style="
            background: linear-gradient(135deg, ${cardMainColor} 0%, ${cardAccentColor} 100%);
            padding: 1.5rem;
            border-radius: 12px;
            color: white;
            text-align: center;
            box-shadow: 0 4px 20px ${cardMainColor}30;
            position: relative;
        ">
            <span class="metric-tooltip">
                <img src="ai_logo.png" alt="AI" style="
                    position: absolute; 
                    top: 12px; 
                    right: 12px; 
                    width: 28px; 
                    height: 28px;
                    opacity: 0.85;
                    background: transparent;
                    cursor: pointer;
                " />
                <span class="tooltip-text">
                    ${confidenceTooltip}
                </span>
            </span>
            <div style="
                font-size: 2.5rem; 
                font-weight: bold; 
                margin-bottom: 0.5rem;
            ">
                ${avgScore}%
            </div>
            <div style="
                font-size: 0.9rem; 
                opacity: 0.9;
            ">
                Average Confidence Score
            </div>
            <div style="
                font-size: 0.8rem; 
                opacity: 0.7; 
                margin-top: 0.5rem;
            ">
                Range: ${minScore} - ${maxScore} (${confidenceLogs.length} logs)
            </div>
        </div>
    `;
}

function renderTechnicalComplexityCard(logs) {
    const complexityLogs = logs.filter(log =>
        log.technical_complexity !== null &&
        log.technical_complexity !== undefined &&
        typeof log.technical_complexity === 'string'
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
                position: relative;
            ">
                <img src="ai_logo.png" alt="AI" style="
                    position: absolute; 
                    top: 12px; 
                    right: 12px; 
                    width: 28px; 
                    height: 28px; 
                    opacity: 0.85;
                " />
                <div style="
                    font-size: 2.5rem; 
                    font-weight: bold; 
                    margin-bottom: 0.5rem;
                ">
                    N/A
                </div>
                <div style="
                    font-size: 0.9rem; 
                    opacity: 0.9;
                ">
                    Technical Complexity
                </div>
                <div style="
                    font-size: 0.8rem; 
                    opacity: 0.7; 
                    margin-top: 0.5rem;
                ">
                    No data available
                </div>
            </div>
        `;
    }

    // Count occurrences
    let high = 0, medium = 0, low = 0;
    complexityLogs.forEach(log => {
        const val = log.technical_complexity.toLowerCase();
        if (val.includes('high')) high++;
        else if (val.includes('medium')) medium++;
        else if (val.includes('low')) low++;
    });

    // Determine the most common label (or use priority: high > medium > low)
    let avgLabel = 'Low', cardColor = '#28a745';
    if (high >= medium && high >= low) {
        avgLabel = 'High';
        cardColor = '#dc3545';
    } else if (medium >= high && medium >= low) {
        avgLabel = 'Medium';
        cardColor = '#ffc107';
    }
    const technicalComplexityToolTip = "Technical Complexity: AI-estimated complexity level (Low, Medium, High) based on log analysis";

    return `
        <div class="metric-card-content" style="
            background: linear-gradient(135deg, ${cardColor} 0%, ${cardColor} 100%);
            padding: 1.5rem;
            border-radius: 12px;
            color: white;
            text-align: center;
            box-shadow: 0 4px 20px ${cardColor}30;
            position: relative;
        ">
            <span class="metric-tooltip">
                <img src="ai_logo.png" alt="AI" style="
                    position: absolute; 
                    top: 12px; 
                    right: 12px; 
                    width: 28px; 
                    height: 28px;
                    opacity: 0.85;
                    background: transparent;
                    cursor: pointer;
                " />
                <span class="tooltip-text">
                    ${technicalComplexityToolTip}
                </span>
            </span>
            <div style="
                font-size: 2.5rem; 
                font-weight: bold; 
                margin-bottom: 0.5rem;
            ">
                ${avgLabel}
            </div>
            <div style="
                font-size: 0.9rem; 
                opacity: 0.9;
            ">
                Technical Complexity
            </div>
            <div style="
                font-size: 0.8rem; 
                opacity: 0.7; 
                margin-top: 0.5rem;
            ">
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
                <div style="
                    font-size: 2.5rem; 
                    font-weight: bold; 
                    margin-bottom: 0.5rem;
                ">
                    N/A
                </div>
                <div style="
                    font-size: 0.9rem; 
                    opacity: 0.9;
                ">
                    Security Score
                </div>
                <div style="
                    font-size: 0.8rem; 
                    opacity: 0.7; 
                    margin-top: 0.5rem;
                ">
                    No data available
                </div>
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
            background: linear-gradient(135deg, ${cardColor} 0%, ${cardColor} 100%);
            padding: 1.5rem;
            border-radius: 12px;
            color: white;
            text-align: center;
            box-shadow: 0 4px 20px ${cardColor}30;
        ">
            <div style="
                font-size: 2.5rem; 
                font-weight: bold; 
                margin-bottom: 0.5rem;
            ">
                ${avgVulns}
            </div>
            <div style="
                font-size: 0.9rem; 
                opacity: 0.9;
            ">
                Average Vulnerabilities
            </div>
            <div style="
                font-size: 0.8rem; 
                opacity: 0.7; 
                margin-top: 0.5rem;
            ">
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
                position: relative;
            ">
                <img src="ai_logo.png" alt="AI" style="
                    position: absolute; 
                    top: 12px; 
                    right: 12px; 
                    width: 28px; 
                    height: 28px; 
                    opacity: 0.85;
                " />
                <div style="
                    font-size: 2.5rem; 
                    font-weight: bold; 
                    margin-bottom: 0.5rem;
                ">
                    N/A
                </div>
                <div style="
                    font-size: 0.9rem; 
                    opacity: 0.9;
                ">
                    Technical Debt
                </div>
                <div style="
                    font-size: 0.8rem; 
                    opacity: 0.7; 
                    margin-top: 0.5rem;
                ">
                    No data available
                </div>
            </div>
        `;
    }

    const scores = debtLogs.map(log => log.technical_debt_hours);
    
    const totalDebt = debtLogs.reduce((sum, log) => sum + (log.technical_debt_hours || 0), 0);
    const avgDebt = (totalDebt / debtLogs.length).toFixed(1);

    const maxScore = Math.max(...scores).toFixed(1);
    const minScore = Math.min(...scores).toFixed(1);

    const [cardMainColor, cardAccentColor] = getGradientColor(avgDebt, 0, 100);

    const productivityGainToolTip = "Estimated reduction in technical debt (hours) based on AI analysis of logs";

    return `
        <div class="metric-card-content" style="
            background: linear-gradient(135deg, ${cardMainColor} 0%, ${cardAccentColor} 100%);
            padding: 1.5rem;
            border-radius: 12px;
            color: white;
            text-align: center;
            box-shadow: 0 4px 20px ${cardMainColor}30;
            position: relative;
        ">
            <span class="metric-tooltip">
                <img src="ai_logo.png" alt="AI" style="
                    position: absolute; 
                    top: 12px; 
                    right: 12px; 
                    width: 28px; 
                    height: 28px;
                    opacity: 0.85;
                    background: transparent;
                    cursor: pointer;
                " />
                <span class="tooltip-text">
                    ${productivityGainToolTip}
                </span>
            </span>
            <div style="
                font-size: 2.5rem; 
                font-weight: bold; 
                margin-bottom: 0.5rem;
            ">
                ${avgDebt}h
            </div>
            <div style="
                font-size: 0.9rem; 
                opacity: 0.9;
            ">
                Productivity Gain
            </div>
            <div style="
                font-size: 0.8rem; 
                opacity: 0.7; 
                margin-top: 0.5rem;
            ">
                Total: ${totalDebt.toFixed(1)} hours
            </div>
        </div>
    `;
}