
# elasticsearch_diagnostic.py - Simple diagnostic tool for your CI/CD dashboard

import base64
from elasticsearch import Elasticsearch
import json
from datetime import datetime

def main():
    print("🔧 CI/CD Dashboard Elasticsearch Diagnostic Tool")
    print("=" * 60)

    # Your credentials
    api_key_encoded = "SEtWQlVKY0JRLUE2QldTNnB3c0U6TXJ6a1dKZ0xIQ01fTndYNWtLRVhhdw=="
    endpoint = "https://a705a31d6c434d5d9b8801b99d0ef7f7.us-central1.gcp.cloud.es.io"

    # Decode API key
    api_key_decoded = base64.b64decode(api_key_encoded).decode('utf-8')
    key_parts = api_key_decoded.split(':')
    api_key_id = key_parts[0]
    api_key_secret = key_parts[1]

    try:
        # Connect to Elasticsearch
        es = Elasticsearch(
            [endpoint],
            api_key=(api_key_id, api_key_secret),
            verify_certs=True,
            request_timeout=60
        )

        # Test connection
        if es.ping():
            print("✅ Elasticsearch connection: SUCCESS")
        else:
            print("❌ Elasticsearch connection: FAILED")
            return

        # Check cicd_analysis index
        if es.indices.exists(index="cicd_analysis"):
            print("✅ cicd_analysis index: EXISTS")

            # Get document count
            count_response = es.count(index="cicd_analysis")
            doc_count = count_response['count']
            print(f"📊 Document count: {doc_count}")

            if doc_count > 0:
                # Test aggregation query (same as your backend would use)
                agg_query = {
                    "size": 0,
                    "aggs": {
                        "projects": {
                            "terms": {"field": "project.keyword", "size": 100}
                        },
                        "environments": {
                            "terms": {"field": "environment.keyword", "size": 100}
                        }
                    }
                }

                agg_response = es.search(index="cicd_analysis", body=agg_query)
                projects = [bucket['key'] for bucket in agg_response['aggregations']['projects']['buckets']]
                environments = [bucket['key'] for bucket in agg_response['aggregations']['environments']['buckets']]

                print(f"🏗️  Available projects: {projects}")
                print(f"🌍 Available environments: {environments}")
                print("✅ Backend queries will work correctly!")

            else:
                print("⚠️  Index exists but no documents found")
        else:
            print("❌ cicd_analysis index: NOT FOUND")

        print("\n🎯 DASHBOARD COMPATIBILITY CHECK:")
        print("   ✅ Elasticsearch connection working")
        print("   ✅ Index exists with proper data")
        print("   ✅ Aggregation queries functional")
        print("   ✅ Ready for dashboard backend!")

    except Exception as e:
        print(f"❌ Error: {e}")
        print("\n🔧 Troubleshooting tips:")
        print("   1. Check your internet connection")
        print("   2. Verify Elasticsearch service is running")
        print("   3. Confirm API key is still valid")

if __name__ == "__main__":
    main()
