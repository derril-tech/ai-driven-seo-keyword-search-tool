import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

// Test configuration
export const options = {
    stages: [
        { duration: '2m', target: 10 },   // Ramp up to 10 users
        { duration: '5m', target: 10 },   // Stay at 10 users
        { duration: '2m', target: 50 },   // Ramp up to 50 users
        { duration: '5m', target: 50 },   // Stay at 50 users
        { duration: '2m', target: 100 },  // Ramp up to 100 users
        { duration: '5m', target: 100 },  // Stay at 100 users
        { duration: '5m', target: 0 },    // Ramp down to 0 users
    ],
    thresholds: {
        http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2s
        http_req_failed: ['rate<0.05'],    // Error rate must be below 5%
        errors: ['rate<0.05'],
    },
};

// Test data
const testData = {
    seeds: [
        'seo tools',
        'keyword research',
        'content marketing',
        'digital marketing',
        'search optimization'
    ],
    urls: [
        'https://example.com',
        'https://competitor1.com',
        'https://competitor2.com'
    ]
};

// Base URL
const BASE_URL = __ENV.BASE_URL || 'https://api.seo-tool.com';

// Authentication token (should be set via environment variable)
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-token';

export function setup() {
    // Setup phase - authenticate and get token if needed
    console.log('Starting performance test setup...');

    const loginResponse = http.post(`${BASE_URL}/v1/auth/login`, JSON.stringify({
        email: 'test@example.com',
        password: 'testpassword123'
    }), {
        headers: {
            'Content-Type': 'application/json',
        },
    });

    if (loginResponse.status === 200) {
        const token = loginResponse.json('token');
        console.log('Authentication successful');
        return { token };
    }

    console.log('Using provided AUTH_TOKEN');
    return { token: AUTH_TOKEN };
}

export default function (data) {
    const token = data.token || AUTH_TOKEN;
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
    };

    // Test 1: Health Check
    const healthResponse = http.get(`${BASE_URL}/health`, { headers });
    check(healthResponse, {
        'health check status is 200': (r) => r.status === 200,
    });

    // Test 2: Create Project
    const projectPayload = JSON.stringify({
        name: `Load Test Project ${__VU}-${__ITER}`,
        description: 'Performance testing project',
        settings: {
            target_language: 'en',
            target_country: 'US'
        }
    });

    const createProjectResponse = http.post(`${BASE_URL}/v1/projects`, projectPayload, { headers });
    const projectCreated = check(createProjectResponse, {
        'project creation status is 201': (r) => r.status === 201,
        'project has id': (r) => r.json('id') !== undefined,
    });

    if (!projectCreated) {
        errorRate.add(1);
        return;
    }

    const projectId = createProjectResponse.json('id');
    responseTime.add(createProjectResponse.timings.duration);

    // Test 3: Keyword Expansion
    const seedKeyword = testData.seeds[Math.floor(Math.random() * testData.seeds.length)];
    const expansionPayload = JSON.stringify({
        seeds: [seedKeyword],
        options: {
            max_keywords: 100,
            include_questions: true,
            include_related: true
        }
    });

    const expansionResponse = http.post(`${BASE_URL}/v1/projects/${projectId}/expand`, expansionPayload, { headers });
    check(expansionResponse, {
        'keyword expansion status is 202': (r) => r.status === 202,
        'expansion has job_id': (r) => r.json('job_id') !== undefined,
    });

    const jobId = expansionResponse.json('job_id');
    responseTime.add(expansionResponse.timings.duration);

    // Test 4: Poll Job Status
    let jobCompleted = false;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds timeout

    while (!jobCompleted && attempts < maxAttempts) {
        sleep(1);
        const statusResponse = http.get(`${BASE_URL}/v1/jobs/${jobId}`, { headers });

        check(statusResponse, {
            'job status check is 200': (r) => r.status === 200,
        });

        const status = statusResponse.json('status');
        if (status === 'completed' || status === 'failed') {
            jobCompleted = true;

            check(statusResponse, {
                'job completed successfully': (r) => r.json('status') === 'completed',
            });
        }
        attempts++;
    }

    // Test 5: Get Keywords
    const keywordsResponse = http.get(`${BASE_URL}/v1/projects/${projectId}/keywords`, { headers });
    check(keywordsResponse, {
        'get keywords status is 200': (r) => r.status === 200,
        'keywords array exists': (r) => Array.isArray(r.json('keywords')),
    });

    responseTime.add(keywordsResponse.timings.duration);

    // Test 6: SERP Analysis (if keywords exist)
    const keywords = keywordsResponse.json('keywords');
    if (keywords && keywords.length > 0) {
        const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];

        const serpPayload = JSON.stringify({
            keyword_ids: [randomKeyword.id],
            options: {
                location: 'United States',
                language: 'en',
                device: 'desktop'
            }
        });

        const serpResponse = http.post(`${BASE_URL}/v1/projects/${projectId}/serp-analysis`, serpPayload, { headers });
        check(serpResponse, {
            'SERP analysis status is 202': (r) => r.status === 202,
        });

        responseTime.add(serpResponse.timings.duration);
    }

    // Test 7: Get Analytics
    const analyticsResponse = http.get(`${BASE_URL}/v1/analytics/metrics?tenantId=test-tenant`, { headers });
    check(analyticsResponse, {
        'analytics status is 200': (r) => r.status === 200,
    });

    responseTime.add(analyticsResponse.timings.duration);

    // Test 8: Export Data
    const exportPayload = JSON.stringify({
        project_id: projectId,
        format: 'csv',
        options: {
            include_serp_features: true,
            include_difficulty: true
        }
    });

    const exportResponse = http.post(`${BASE_URL}/v1/exports`, exportPayload, { headers });
    check(exportResponse, {
        'export status is 202': (r) => r.status === 202,
    });

    responseTime.add(exportResponse.timings.duration);

    // Test 9: Performance Metrics
    const performanceResponse = http.get(`${BASE_URL}/v1/performance/metrics`, { headers });
    check(performanceResponse, {
        'performance metrics status is 200': (r) => r.status === 200,
    });

    // Test 10: Cleanup - Delete Project
    const deleteResponse = http.del(`${BASE_URL}/v1/projects/${projectId}`, null, { headers });
    check(deleteResponse, {
        'project deletion status is 204': (r) => r.status === 204,
    });

    // Random sleep between 1-3 seconds
    sleep(Math.random() * 2 + 1);
}

export function teardown(data) {
    console.log('Performance test completed');
}

// Stress test scenario
export function stressTest() {
    const token = AUTH_TOKEN;
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
    };

    // Rapid fire requests to test system limits
    for (let i = 0; i < 10; i++) {
        const response = http.get(`${BASE_URL}/health`, { headers });
        check(response, {
            'stress test response': (r) => r.status < 500,
        });
    }
}

// Spike test scenario
export function spikeTest() {
    const token = AUTH_TOKEN;
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
    };

    // Simulate sudden traffic spike
    const responses = [];
    for (let i = 0; i < 50; i++) {
        responses.push(http.get(`${BASE_URL}/v1/analytics/metrics?tenantId=test-tenant`, { headers }));
    }

    responses.forEach(response => {
        check(response, {
            'spike test response': (r) => r.status < 500,
        });
    });
}
