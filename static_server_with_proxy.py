
# static_server_with_proxy.py - Serve static files and proxy API requests

from flask import Flask, request, send_from_directory, Response
import requests
import os

app = Flask(__name__, static_folder='./')

# Dashboard backend endpoint
DASHBOARD_API = 'http://localhost:5001'
# Chatbot endpoint
CHATBOT_API = 'http://localhost:5000'

@app.route('/api/chat', methods=['POST'])
def proxy_chat():
    """Proxy chatbot API requests"""
    try:
        # Forward the request to the chatbot API
        response = requests.post(
            f"{CHATBOT_API}/api/chat",
            json=request.json,
            headers={
                'Content-Type': 'application/json'
            }
        )
        return Response(
            response.content,
            status=response.status_code,
            content_type=response.headers.get('Content-Type')
        )
    except Exception as e:
        return {"error": str(e)}, 500

@app.route('/api/<path:path>', methods=['GET', 'POST'])
def proxy_api(path):
    """Proxy dashboard API requests"""
    try:
        if request.method == 'GET':
            response = requests.get(
                f"{DASHBOARD_API}/api/{path}",
                params=request.args,
                headers={
                    'Content-Type': 'application/json'
                }
            )
        else:
            response = requests.post(
                f"{DASHBOARD_API}/api/{path}",
                json=request.json,
                headers={
                    'Content-Type': 'application/json'
                }
            )

        return Response(
            response.content,
            status=response.status_code,
            content_type=response.headers.get('Content-Type')
        )
    except Exception as e:
        return {"error": str(e)}, 500

@app.route('/', defaults={'path': 'index.html'})
@app.route('/<path:path>')
def serve_static(path):
    """Serve static files"""
    return send_from_directory('./', path)

if __name__ == '__main__':
    print("🚀 Starting Static Server with API Proxy...")
    print("📡 Proxying dashboard API to: http://localhost:5001")
    print("📡 Proxying chatbot API to: http://localhost:5000")
    print("📂 Serving static files from current directory")
    print("🌐 Frontend available at: http://localhost:8080")
    app.run(debug=True, port=8080, host='0.0.0.0')
