import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL;
const AUTH_HEADER = process.env.ELASTICSEARCH_APIKEY;

// Helper function to make Elasticsearch requests
async function makeESRequest(query) {
  const response = await fetch(ELASTICSEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': AUTH_HEADER
    },
    body: JSON.stringify(query)
  });
  
  if (!response.ok) {
    throw new Error(`Elasticsearch request failed: ${response.statusText}`);
  }
  
  return await response.json();
}

// Get all unique projects
app.get('/api/projects', async (req, res) => {
  try {
    const data = await makeESRequest({
      size: 0,
      aggs: {
        projects: {
          terms: { field: 'project', size: 100 }
        }
      }
    });
    
    const projects = data.aggregations.projects.buckets.map(b => b.key);
    res.json(projects);
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all unique environments
app.get('/api/environments', async (req, res) => {
  try {
    const data = await makeESRequest({
      size: 0,
      aggs: {
        environments: {
          terms: { field: 'environment', size: 100 }
        }
      }
    });
    
    const environments = data.aggregations.environments.buckets.map(b => b.key);
    res.json(environments);
  } catch (err) {
    console.error('Error fetching environments:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all unique servers
app.get('/api/servers', async (req, res) => {
  try {
    const data = await makeESRequest({
      size: 0,
      aggs: {
        servers: {
          terms: { field: 'server', size: 100 }
        }
      }
    });
    
    const servers = data.aggregations.servers.buckets.map(b => b.key);
    res.json(servers);
  } catch (err) {
    console.error('Error fetching servers:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all unique tools
app.get('/api/tools', async (req, res) => {
  try {
    const data = await makeESRequest({
      size: 0,
      aggs: {
        tools: {
          terms: { field: 'tool', size: 100 }
        }
      }
    });
    
    const tools = data.aggregations.tools.buckets.map(b => b.key);
    res.json(tools);
  } catch (err) {
    console.error('Error fetching tools:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all analysis data (flattened)
app.get('/api/analysis', async (req, res) => {
  try {
    const data = await makeESRequest({
      size: 1000 // adjust as needed
    });
    
    const analysis = data.hits.hits.map(hit => hit._source);
    res.json(analysis);
  } catch (err) {
    console.error('Error fetching analysis data:', err);
    res.status(500).json({ error: err.message });
  }
});

// Helper functions to extract sections from executive_summary
function extractSection(text, section) {
  if (!text) return null;
  console.log(`Extracting section: ${section} from text`, text);
  const regex = new RegExp(`\\*\\*${section}:\\*\\*?\\s*([\s\S]*?)(?=\\*\\*|$)`, 'i');
  const match = text.match(regex);
  /* console.log(`Extracting section: ${section}`, match); */
  return match ? match[1].trim().replace(/\n/g, ' ') : null;
}

function extractRootCause(text) {
  return extractSection(text, 'ROOT_CAUSE');
}
function extractFixStrategy(text) {
  return extractSection(text, 'FIX_STRATEGY');
}
function extractRollbackPlan(text) {
  return extractSection(text, 'ROLLBACK_PLAN');
}
function extractBusinessImpact(text) {
  return extractSection(text, 'BUSINESS_IMPACT');
}
function extractResolutionTime(text) {
  return extractSection(text, 'RESOLUTION_TIME');
}

// Get logs with optional filtering
app.get('/api/logs', async (req, res) => {
  const { project, tool, environment, server, severity } = req.query;
  console.log("Received log request with filters:", { project, tool, environment, server, severity });
  let must = [];
  if (project) must.push({ match: { project } });
  if (tool) must.push({ match: { tool } });
  if (environment) must.push({ match: { environment } });
  if (server) must.push({ match: { server } });
  if (severity){ 
    must.push({ 
      wildcard: {
        severity_level: {
          value: `*${severity.toLowerCase()}*`,
          case_insensitive: true
        }
      }
     });
  }

  try {
    const response = await fetch(ELASTICSEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': AUTH_HEADER
      },
      body: JSON.stringify({
        size: 1000,
        query: must.length > 0 ? { bool: { must } } : { match_all: {} },
        sort: [{ analysis_timestamp: { order: "desc" } }]
      })
    });
    const data = await response.json();
    const logs = data.hits.hits.map(hit => {
      let log = {
        timestamp: hit._source.analysis_timestamp,
        environment: hit._source.environment,
        server: hit._source.server,
        severity_level: (() => {
          const sev = (hit._source.severity_level || '').toLowerCase();
          if (sev.includes('critical')) return 'critical';
          if (sev.includes('high')) return 'high';
          if (sev.includes('medium')) return 'medium';
          if (sev.includes('low')) return 'low';
          return hit._source.severity_level || '';
        })(),
        executive_summary: hit._source.executive_summary,
        llm_response: hit._source.llm_response,
        full_synthesis: hit._source.full_synthesis,
        log_type: hit._source.log_type, // ensure log_type is passed
        tool: hit._source.tool,
        project: hit._source.project,
        status: hit._source.status,
        error_count: hit._source.error_count,
        warning_count: hit._source.warning_count,
        success_indicators: hit._source.success_indicators,
        deployment_duration: hit._source.deployment_duration,
        business_impact_score: hit._source.business_impact_score,
        confidence_score: hit._source.confidence_score,
        technical_complexity: hit._source.technical_complexity,
        bugs: hit._source.bugs,
        build_duration: hit._source.build_duration,
        build_duration_seconds: hit._source.build_duration_seconds,
        build_error_count: hit._source.build_error_count,
        build_success: hit._source.build_success,
        build_warning_count: hit._source.build_warning_count,
        code_coverage: hit._source.code_coverage,
        code_smells: hit._source.code_smells,
        deployment_error_count: hit._source.deployment_error_count,
        deployment_fatal: hit._source.deployment_fatal,
        deployment_success: hit._source.deployment_success,
        duplicated_lines: hit._source.duplicated_lines,
        git_errors: hit._source.git_errors,
        git_fatal: hit._source.git_fatal,
        is_successful_build: hit._source.is_successful_build,
        quality_gate_passed: hit._source.quality_gate_passed,
        rollback_initiated: hit._source.rollback_initiated,
        technical_debt_hours: hit._source.technical_debt_hours,
        test_cases_found: hit._source.test_cases_found,
        test_coverage: hit._source.test_coverage,
        test_error_count: hit._source.test_error_count,
        test_failures: hit._source.test_failures,
        test_fatal: hit._source.test_fatal,
        test_pass_rate: hit._source.test_pass_rate,
        test_skipped: hit._source.test_skipped,
        tests_run: hit._source.tests_run,
        vulnerabilities: hit._source.vulnerabilities
      };
      return enrichLogWithMetrics(log);
    });
    console.log('Logs fetched:', logs)
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get dashboard data - projects grouped by tools
app.get('/api/dashboard', async (req, res) => {
  try {
    const data = await makeESRequest({
      size: 1000,
      query: { match_all: {} }
    });
    
    const logs = data.hits.hits.map(hit => hit._source);
    
    // Group projects by tool
    const grouped = groupProjectsByTool(logs);
    
    // Get statistics
    const stats = {
      totalTools: Object.keys(grouped).length,
      totalProjects: new Set(logs.map(log => log.project).filter(Boolean)).size,
      totalRecords: logs.length,
      lastUpdated: logs.length > 0 ? Math.max(...logs.map(log => new Date(log.analysis_timestamp).getTime())) : null
    };
    
    res.json({
      grouped,
      stats
    });
  } catch (err) {
    console.error('Error fetching dashboard data:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get detailed project information
app.get('/api/project/:projectName', async (req, res) => {
  const { projectName } = req.params;
  
  try {
    const data = await makeESRequest({
      size: 100,
      query: {
        bool: {
          must: [{ match: { project: projectName } }]
        }
      },
      sort: [{ analysis_timestamp: { order: "desc" } }]
    });
    
    const projectData = data.hits.hits.map(hit => hit._source);
    
    if (projectData.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Get unique tools for this project
    const tools = [...new Set(projectData.map(item => item.tool).filter(Boolean))];
    
    // Get latest status for each tool
    const toolStatuses = tools.map(tool => {
      const toolData = projectData.filter(item => item.tool === tool);
      const latest = toolData[0]; // Already sorted by timestamp desc
      
      return {
        tool,
        status: latest.status,
        lastRun: latest.analysis_timestamp,
        success: latest.deployment_success,
        errorCount: latest.error_count || 0,
        warningCount: latest.warning_count || 0
      };
    });
    
    res.json({
      project: projectName,
      tools: toolStatuses,
      totalRuns: projectData.length,
      environments: [...new Set(projectData.map(item => item.environment).filter(Boolean))],
      servers: [...new Set(projectData.map(item => item.server).filter(Boolean))]
    });
  } catch (err) {
    console.error('Error fetching project details:', err);
    res.status(500).json({ error: err.message });
  }
});

// Utility function to group projects by tool
function groupProjectsByTool(logEntries) {
  const dashboard = {};
  
  for (const entry of logEntries) {
    const tool = entry.tool;
    const project = entry.project;
    
    if (!tool || !project) {
      continue;
    }
    
    if (!dashboard[tool]) {
      dashboard[tool] = new Set();
    }
    
    dashboard[tool].add(project);
  }
  
  // Convert sets to sorted arrays for frontend
  return Object.fromEntries(
    Object.entries(dashboard).map(([tool, projects]) => [
      tool, 
      Array.from(projects).sort()
    ])
  );
}

// --- Additive: Metric extraction helpers ---
function extractMetricFromSummary(summary, regex, parseFn = x => x) {
  if (!summary) return null;
  const match = summary.match(regex);
  return match ? parseFn(match[1]) : null;
}
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
function enrichLogWithMetrics(log) {
  const summary = log.executive_summary || log.llm_response || log.full_synthesis || '';
  // Use log_type if present, else fallback to tool/summary
  log.log_type = getLogType(log);
  // Build
  log.build_success = log.build_success !== undefined ? log.build_success : /build (success|successful)/i.test(summary);
  log.build_duration = log.build_duration || extractMetricFromSummary(summary, /build time:?\s*([\dhms :]+)/i);
  log.build_duration_seconds = log.build_duration_seconds || extractMetricFromSummary(summary, /build time:?\s*([\dhms :]+)/i, parseDurationString);
  if (!log.build_duration_seconds) {
    log.build_duration_seconds = extractMetricFromSummary(summary, /total time:?\s*([\dhms :]+)/i, parseDurationString);
  }
  log.build_error_count = log.build_error_count !== undefined ? log.build_error_count : (summary.match(/ERROR:/g) || []).length;
  log.build_warning_count = log.build_warning_count !== undefined ? log.build_warning_count : (summary.match(/WARNING:/g) || []).length;
  // Test
  log.test_coverage = log.test_coverage !== undefined ? log.test_coverage : extractMetricFromSummary(summary, /(?:test coverage|coverage):?\s*(\d+\.?\d*)%/i, parseFloat);
  log.test_cases_found = log.test_cases_found !== undefined ? log.test_cases_found : extractMetricFromSummary(summary, /found (\d+) test cases/i, parseInt);
  log.test_error_count = log.test_error_count !== undefined ? log.test_error_count : (summary.match(/ERROR:/g) || []).length;
  log.test_failures = log.test_failures !== undefined ? log.test_failures : extractMetricFromSummary(summary, /failures:?\s*(\d+)/i, parseInt);
  log.tests_run = log.tests_run !== undefined ? log.tests_run : extractMetricFromSummary(summary, /tests run:?\s*(\d+)/i, parseInt);
  // SonarQube
  log.code_coverage = log.code_coverage !== undefined ? log.code_coverage : extractMetricFromSummary(summary, /code coverage:?\s*(\d+\.?\d*)%/i, parseFloat);
  log.bugs = log.bugs !== undefined ? log.bugs : extractMetricFromSummary(summary, /bugs:?\s*(\d+)/i, parseInt);
  log.vulnerabilities = log.vulnerabilities !== undefined ? log.vulnerabilities : extractMetricFromSummary(summary, /vulnerabilities:?\s*(\d+)/i, parseInt);
  log.code_smells = log.code_smells !== undefined ? log.code_smells : extractMetricFromSummary(summary, /code smells:?\s*(\d+)/i, parseInt);
  log.quality_gate_passed = log.quality_gate_passed !== undefined ? log.quality_gate_passed : !/quality gate failed/i.test(summary);
  log.technical_debt_hours = log.technical_debt_hours !== undefined ? log.technical_debt_hours : extractMetricFromSummary(summary, /technical debt:?\s*([\d.]+) hours/i, parseFloat);
  log.duplicated_lines = log.duplicated_lines !== undefined ? log.duplicated_lines : extractMetricFromSummary(summary, /duplicated lines:?\s*([\d.]+)%/i, parseFloat);
  // Deployment
  log.deployment_success = log.deployment_success !== undefined ? log.deployment_success : /deployment completed successfully/i.test(summary);
  log.deployment_duration = log.deployment_duration || extractMetricFromSummary(summary, /deployment duration:?\s*([\dhms :]+)/i);
  log.deployment_error_count = log.deployment_error_count !== undefined ? log.deployment_error_count : (summary.match(/ERROR:/g) || []).length;
  log.deployment_fatal = log.deployment_fatal !== undefined ? log.deployment_fatal : /FATAL:/i.test(summary);
  log.rollback_initiated = log.rollback_initiated !== undefined ? log.rollback_initiated : /Rollback initiated/i.test(summary);
  // Git
  log.git_fatal = log.git_fatal !== undefined ? log.git_fatal : /FATAL:/i.test(summary);
  log.git_errors = log.git_errors !== undefined ? log.git_errors : (summary.match(/ERROR: (.+)/g) || []).map(e => e.replace('ERROR: ', ''));
  return log;
}
// --- Additive: Robust log type detector ---
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log(`🚀 Proxy server running on port ${PORT}`);
  console.log(`📊 Dashboard API available at http://localhost:${PORT}/api/dashboard`);
  console.log(`🔍 Health check at http://localhost:${PORT}/health`);
});