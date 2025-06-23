
# backend.py - Complete fixed dashboard backend for cicd_analysis index

from flask import Flask, request, jsonify
from flask_cors import CORS
from elasticsearch import Elasticsearch
import base64
import json
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

class CICDDashboardBackend:
    def __init__(self):
        # Decode API key
        api_key_encoded = "SEtWQlVKY0JRLUE2QldTNnB3c0U6TXJ6a1dKZ0xIQ01fTndYNWtLRVhhdw=="
        endpoint = "https://a705a31d6c434d5d9b8801b99d0ef7f7.us-central1.gcp.cloud.es.io"

        api_key_decoded = base64.b64decode(api_key_encoded).decode('utf-8')
        key_parts = api_key_decoded.split(':')

        # Initialize Elasticsearch with your API key
        self.es = Elasticsearch(
            [endpoint],
            api_key=(key_parts[0], key_parts[1]),
            verify_certs=True,
            request_timeout=60
        )

        # IMPORTANT: This is the correct index name
        self.index_name = "cicd_analysis"

        print(f"🚀 CI/CD Dashboard Backend initialized")
        print(f"📡 Connected to Elasticsearch: {endpoint}")
        print(f"📊 Using index: {self.index_name}")

        # Test connection
        if self.es.ping():
            print("✅ Elasticsearch connection successful")
            # Check if index exists
            if self.es.indices.exists(index=self.index_name):
                count = self.es.count(index=self.index_name)['count']
                print(f"✅ Found index '{self.index_name}' with {count} documents")
            else:
                print(f"⚠️ Index '{self.index_name}' does not exist!")
        else:
            print("❌ Failed to connect to Elasticsearch")

    def get_projects(self):
        """Get all projects with their summary metrics"""
        try:
            # Query for projects with aggregations for metrics
            query = {
                "size": 0,
                "aggs": {
                    "projects": {
                        "terms": {
                            "field": "project.keyword",
                            "size": 100
                        },
                        "aggs": {
                            "tools": {
                                "terms": {
                                    "field": "tool.keyword",
                                    "size": 10
                                }
                            },
                            "status": {
                                "terms": {
                                    "field": "status.keyword",
                                    "size": 10
                                }
                            },
                            "latest_timestamp": {
                                "max": {
                                    "field": "analysis_timestamp"
                                }
                            },
                            "success_rate": {
                                "avg": {
                                    "field": "deployment_success"
                                }
                            }
                        }
                    }
                }
            }

            response = self.es.search(index=self.index_name, body=query)

            # Process results
            projects_data = []
            for project_bucket in response['aggregations']['projects']['buckets']:
                project_name = project_bucket['key']
                doc_count = project_bucket['doc_count']

                # Get the primary tool
                tools = []
                for tool_bucket in project_bucket['tools']['buckets']:
                    tools.append({
                        "name": tool_bucket['key'],
                        "count": tool_bucket['doc_count']
                    })

                # Calculate success rate
                success_rate = project_bucket['success_rate']['value'] * 100 if 'success_rate' in project_bucket else 0

                # Get latest timestamp
                latest_timestamp = project_bucket['latest_timestamp']['value_as_string'] if 'latest_timestamp' in project_bucket and project_bucket['latest_timestamp']['value'] is not None else None

                # Get status distribution
                status_counts = {}
                for status_bucket in project_bucket['status']['buckets']:
                    status_counts[status_bucket['key']] = status_bucket['doc_count']

                # Determine overall status
                overall_status = "success"
                if status_counts.get("error", 0) > 0:
                    overall_status = "error"
                elif status_counts.get("warning", 0) > 0:
                    overall_status = "warning"

                projects_data.append({
                    "name": project_name,
                    "count": doc_count,
                    "tools": tools,
                    "success_rate": success_rate,
                    "latest_timestamp": latest_timestamp,
                    "status": overall_status,
                    "status_counts": status_counts
                })

            return {
                "status": "success",
                "count": len(projects_data),
                "data": projects_data
            }

        except Exception as e:
            print(f"Error getting projects: {e}")
            return {
                "status": "error",
                "message": str(e),
                "data": []
            }

    def get_project_details(self, project_name):
        """Get detailed metrics for a specific project"""
        try:
            # Query for project details
            query = {
                "size": 0,
                "query": {
                    "term": {
                        "project.keyword": project_name
                    }
                },
                "aggs": {
                    "environments": {
                        "terms": {
                            "field": "environment.keyword",
                            "size": 10
                        }
                    },
                    "servers": {
                        "terms": {
                            "field": "server.keyword",
                            "size": 20
                        }
                    },
                    "severity_levels": {
                        "terms": {
                            "field": "severity_level.keyword",
                            "size": 10
                        }
                    },
                    "avg_build_duration": {
                        "avg": {
                            "field": "build_duration_seconds"
                        }
                    },
                    "avg_business_impact": {
                        "avg": {
                            "field": "business_impact_score"
                        }
                    }
                }
            }

            response = self.es.search(index=self.index_name, body=query)

            # Process results
            environments = []
            for env_bucket in response['aggregations']['environments']['buckets']:
                environments.append({
                    "name": env_bucket['key'],
                    "count": env_bucket['doc_count']
                })

            servers = []
            for server_bucket in response['aggregations']['servers']['buckets']:
                servers.append({
                    "name": server_bucket['key'],
                    "count": server_bucket['doc_count']
                })

            severity_levels = []
            for severity_bucket in response['aggregations']['severity_levels']['buckets']:
                severity_levels.append({
                    "level": severity_bucket['key'],
                    "count": severity_bucket['doc_count']
                })

            avg_build_duration = response['aggregations']['avg_build_duration']['value'] if 'avg_build_duration' in response['aggregations'] and response['aggregations']['avg_build_duration']['value'] is not None else 0
            avg_business_impact = response['aggregations']['avg_business_impact']['value'] if 'avg_business_impact' in response['aggregations'] and response['aggregations']['avg_business_impact']['value'] is not None else 0

            return {
                "status": "success",
                "project": project_name,
                "environments": environments,
                "servers": servers,
                "severity_levels": severity_levels,
                "metrics": {
                    "avg_build_duration": avg_build_duration,
                    "avg_business_impact": avg_business_impact
                }
            }

        except Exception as e:
            print(f"Error getting project details: {e}")
            return {
                "status": "error",
                "message": str(e),
                "project": project_name
            }

    def get_analysis_logs(self, project=None, environment=None, server=None, log_type=None, severity=None, limit=50):
        """Get analysis logs with optional filtering"""
        try:
            # Build query
            query_conditions = []

            if project:
                query_conditions.append({
                    "term": {
                        "project.keyword": project
                    }
                })

            if environment:
                query_conditions.append({
                    "term": {
                        "environment.keyword": environment
                    }
                })

            if server:
                query_conditions.append({
                    "term": {
                        "server.keyword": server
                    }
                })

            if log_type:
                query_conditions.append({
                    "term": {
                        "log_type.keyword": log_type
                    }
                })

            if severity:
                query_conditions.append({
                    "term": {
                        "severity_level.keyword": severity
                    }
                })

            query = {
                "query": {
                    "bool": {
                        "must": query_conditions if query_conditions else {"match_all": {}}
                    }
                },
                "sort": [
                    {"analysis_timestamp": {"order": "desc"}}
                ],
                "size": limit
            }

            response = self.es.search(index=self.index_name, body=query)

            # Process results
            logs = []
            for hit in response['hits']['hits']:
                source = hit['_source']

                # Try to parse full_synthesis as JSON if it exists and is not empty
                full_synthesis_data = None
                if 'full_synthesis' in source and source['full_synthesis']:
                    try:
                        full_synthesis_data = json.loads(source['full_synthesis'])
                    except:
                        # If not valid JSON, keep as string
                        full_synthesis_data = source['full_synthesis']

                logs.append({
                    "id": hit['_id'],
                    "project": source.get('project', ''),
                    "environment": source.get('environment', ''),
                    "server": source.get('server', ''),
                    "tool": source.get('tool', ''),
                    "log_type": source.get('log_type', ''),
                    "severity_level": source.get('severity_level', ''),
                    "status": source.get('status', ''),
                    "analysis_timestamp": source.get('analysis_timestamp', ''),
                    "correlation_id": source.get('correlation_id', ''),
                    "affected_components": source.get('affected_components', []),
                    "failure_category": source.get('failure_category', ''),
                    "deployment_success": source.get('deployment_success', False),
                    "error_count": source.get('error_count', 0),
                    "warning_count": source.get('warning_count', 0),
                    "business_impact_score": source.get('business_impact_score', 0),
                    "confidence_score": source.get('confidence_score', 0),
                    "executive_summary": source.get('executive_summary', ''),
                    "resolution_time_estimate": source.get('resolution_time_estimate', ''),
                    "technical_complexity": source.get('technical_complexity', ''),
                    "full_synthesis": full_synthesis_data,
                    "monitoring_recommendations": source.get('monitoring_recommendations', '')
                })

            return {
                "status": "success",
                "count": len(logs),
                "data": logs
            }

        except Exception as e:
            print(f"Error getting analysis logs: {e}")
            return {
                "status": "error",
                "message": str(e),
                "data": []
            }

    def get_environments_for_project(self, project):
        """Get available environments for a specific project"""
        try:
            query = {
                "size": 0,
                "query": {
                    "term": {
                        "project.keyword": project
                    }
                },
                "aggs": {
                    "environments": {
                        "terms": {
                            "field": "environment.keyword",
                            "size": 10
                        }
                    }
                }
            }

            response = self.es.search(index=self.index_name, body=query)

            environments = []
            for env_bucket in response['aggregations']['environments']['buckets']:
                environments.append({
                    "name": env_bucket['key'],
                    "count": env_bucket['doc_count']
                })

            return {
                "status": "success",
                "project": project,
                "environments": environments
            }

        except Exception as e:
            print(f"Error getting environments for project: {e}")
            return {
                "status": "error",
                "message": str(e),
                "project": project
            }

    def get_servers_for_environment(self, project, environment):
        """Get available servers for a specific project and environment"""
        try:
            query = {
                "size": 0,
                "query": {
                    "bool": {
                        "must": [
                            {"term": {"project.keyword": project}},
                            {"term": {"environment.keyword": environment}}
                        ]
                    }
                },
                "aggs": {
                    "servers": {
                        "terms": {
                            "field": "server.keyword",
                            "size": 20
                        }
                    }
                }
            }

            response = self.es.search(index=self.index_name, body=query)

            servers = []
            for server_bucket in response['aggregations']['servers']['buckets']:
                servers.append({
                    "name": server_bucket['key'],
                    "count": server_bucket['doc_count']
                })

            return {
                "status": "success",
                "project": project,
                "environment": environment,
                "servers": servers
            }

        except Exception as e:
            print(f"Error getting servers for environment: {e}")
            return {
                "status": "error",
                "message": str(e),
                "project": project,
                "environment": environment
            }

# Initialize backend
backend = CICDDashboardBackend()

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        # Test Elasticsearch connection
        es_health = backend.es.ping()

        return jsonify({
            'status': 'healthy' if es_health else 'unhealthy',
            'elasticsearch': es_health,
            'timestamp': datetime.utcnow().isoformat()
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/projects', methods=['GET'])
def get_projects():
    """Get all projects with their metrics"""
    result = backend.get_projects()
    return jsonify(result), 200 if result['status'] == 'success' else 500

@app.route('/api/projects/<project_name>', methods=['GET'])
def get_project_details(project_name):
    """Get detailed metrics for a specific project"""
    result = backend.get_project_details(project_name)
    return jsonify(result), 200 if result['status'] == 'success' else 500

@app.route('/api/logs', methods=['GET'])
def get_logs():
    """Get analysis logs with optional filtering"""
    project = request.args.get('project')
    environment = request.args.get('environment')
    server = request.args.get('server')
    log_type = request.args.get('log_type')
    severity = request.args.get('severity')
    limit = int(request.args.get('limit', 50))

    result = backend.get_analysis_logs(
        project=project,
        environment=environment,
        server=server,
        log_type=log_type,
        severity=severity,
        limit=limit
    )

    return jsonify(result), 200 if result['status'] == 'success' else 500

@app.route('/api/projects/<project_name>/environments', methods=['GET'])
def get_environments(project_name):
    """Get available environments for a specific project"""
    result = backend.get_environments_for_project(project_name)
    return jsonify(result), 200 if result['status'] == 'success' else 500

@app.route('/api/projects/<project_name>/environments/<environment>/servers', methods=['GET'])
def get_servers(project_name, environment):
    """Get available servers for a specific project and environment"""
    result = backend.get_servers_for_environment(project_name, environment)
    return jsonify(result), 200 if result['status'] == 'success' else 500

if __name__ == '__main__':
    print("🚀 Starting CI/CD Dashboard Backend...")
    app.run(debug=True, port=5001, host='0.0.0.0')
