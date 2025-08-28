'use client';
import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Progress, Button, Table, Tag, Alert, Statistic, Spin } from 'antd';
import {
    DashboardOutlined,
    LineChartOutlined,
    SettingOutlined,
    WarningOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    ReloadOutlined
} from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface PerformanceMetrics {
    queryCount: number;
    avgQueryTime: number;
    slowQueries: number;
    cacheHitRate: number;
    memoryUsage: number;
    cpuUsage: number;
    activeConnections: number;
    createdAt: Date;
}

interface OptimizationRecommendation {
    type: string;
    priority: string;
    description: string;
    impact: string;
    implementation: string;
    estimatedImprovement: number;
}

interface HealthStatus {
    status: 'healthy' | 'warning' | 'critical';
    score: number;
    issues: string[];
    recommendations: string[];
}

const PerformancePage: React.FC = () => {
    const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
    const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
    const [optimizationReport, setOptimizationReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchPerformanceData();
    }, []);

    const fetchPerformanceData = async () => {
        try {
            setRefreshing(true);

            // Fetch metrics
            const metricsResponse = await fetch('/api/v1/performance/metrics', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
            });
            const metricsData = await metricsResponse.json();
            setMetrics(metricsData);

            // Fetch health status
            const healthResponse = await fetch('/api/v1/performance/health', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
            });
            const healthData = await healthResponse.json();
            setHealthStatus(healthData);

            // Fetch optimization report
            const reportResponse = await fetch('/api/v1/performance/optimization-report', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
            });
            const reportData = await reportResponse.json();
            setOptimizationReport(reportData);

        } catch (error) {
            console.error('Error fetching performance data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'healthy': return 'green';
            case 'warning': return 'orange';
            case 'critical': return 'red';
            default: return 'default';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'healthy': return <CheckCircleOutlined />;
            case 'warning': return <WarningOutlined />;
            case 'critical': return <CloseCircleOutlined />;
            default: return null;
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'critical': return 'red';
            case 'high': return 'orange';
            case 'medium': return 'blue';
            case 'low': return 'green';
            default: return 'default';
        }
    };

    const getProgressColor = (value: number, threshold: number) => {
        if (value >= threshold) return '#ff4d4f';
        if (value >= threshold * 0.8) return '#faad14';
        return '#52c41a';
    };

    // Mock data for charts
    const performanceHistory = [
        { time: '00:00', cpu: 45, memory: 60, cacheHitRate: 85 },
        { time: '04:00', cpu: 35, memory: 55, cacheHitRate: 88 },
        { time: '08:00', cpu: 65, memory: 70, cacheHitRate: 82 },
        { time: '12:00', cpu: 80, memory: 75, cacheHitRate: 78 },
        { time: '16:00', cpu: 70, memory: 68, cacheHitRate: 80 },
        { time: '20:00', cpu: 55, memory: 62, cacheHitRate: 85 },
        { time: '24:00', cpu: 40, memory: 58, cacheHitRate: 87 },
    ];

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Spin size="large" />
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="mb-6 flex justify-between items-center">
                <h1 className="text-2xl font-bold">Performance Dashboard</h1>
                <Button
                    icon={<ReloadOutlined />}
                    onClick={fetchPerformanceData}
                    loading={refreshing}
                >
                    Refresh
                </Button>
            </div>

            {/* Health Status Alert */}
            {healthStatus && (
                <Alert
                    message={`System Status: ${healthStatus.status.toUpperCase()}`}
                    description={`Health Score: ${healthStatus.score.toFixed(1)}/100`}
                    type={healthStatus.status === 'healthy' ? 'success' : healthStatus.status === 'warning' ? 'warning' : 'error'}
                    icon={getStatusIcon(healthStatus.status)}
                    className="mb-6"
                    showIcon
                />
            )}

            {/* Key Metrics */}
            <Row gutter={[16, 16]} className="mb-6">
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="Cache Hit Rate"
                            value={metrics?.cacheHitRate || 0}
                            suffix="%"
                            valueStyle={{ color: getProgressColor(metrics?.cacheHitRate || 0, 60) }}
                        />
                        <Progress
                            percent={metrics?.cacheHitRate || 0}
                            strokeColor={getProgressColor(metrics?.cacheHitRate || 0, 60)}
                            showInfo={false}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="Memory Usage"
                            value={metrics?.memoryUsage || 0}
                            suffix="%"
                            valueStyle={{ color: getProgressColor(metrics?.memoryUsage || 0, 80) }}
                        />
                        <Progress
                            percent={metrics?.memoryUsage || 0}
                            strokeColor={getProgressColor(metrics?.memoryUsage || 0, 80)}
                            showInfo={false}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="CPU Usage"
                            value={metrics?.cpuUsage || 0}
                            suffix="%"
                            valueStyle={{ color: getProgressColor(metrics?.cpuUsage || 0, 70) }}
                        />
                        <Progress
                            percent={metrics?.cpuUsage || 0}
                            strokeColor={getProgressColor(metrics?.cpuUsage || 0, 70)}
                            showInfo={false}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="Avg Query Time"
                            value={metrics?.avgQueryTime || 0}
                            suffix="ms"
                            valueStyle={{ color: getProgressColor(metrics?.avgQueryTime || 0, 1000) }}
                        />
                        <Progress
                            percent={Math.min((metrics?.avgQueryTime || 0) / 10, 100)}
                            strokeColor={getProgressColor(metrics?.avgQueryTime || 0, 1000)}
                            showInfo={false}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Performance Charts */}
            <Row gutter={[16, 16]} className="mb-6">
                <Col xs={24} lg={12}>
                    <Card title="System Resource Usage" icon={<LineChartOutlined />}>
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={performanceHistory}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="time" />
                                <YAxis />
                                <Tooltip />
                                <Area
                                    type="monotone"
                                    dataKey="cpu"
                                    stackId="1"
                                    stroke="#8884d8"
                                    fill="#8884d8"
                                    name="CPU %"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="memory"
                                    stackId="1"
                                    stroke="#82ca9d"
                                    fill="#82ca9d"
                                    name="Memory %"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </Card>
                </Col>
                <Col xs={24} lg={12}>
                    <Card title="Cache Performance" icon={<DashboardOutlined />}>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={performanceHistory}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="time" />
                                <YAxis />
                                <Tooltip />
                                <Line
                                    type="monotone"
                                    dataKey="cacheHitRate"
                                    stroke="#1890ff"
                                    strokeWidth={2}
                                    name="Cache Hit Rate %"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </Card>
                </Col>
            </Row>

            {/* Optimization Recommendations */}
            {optimizationReport && (
                <Card title="Optimization Recommendations" icon={<SettingOutlined />} className="mb-6">
                    <Row gutter={[16, 16]}>
                        <Col xs={24} md={8}>
                            <Statistic
                                title="Total Recommendations"
                                value={optimizationReport.summary?.totalRecommendations || 0}
                                suffix=""
                            />
                        </Col>
                        <Col xs={24} md={8}>
                            <Statistic
                                title="Critical Issues"
                                value={optimizationReport.summary?.criticalIssues || 0}
                                suffix=""
                                valueStyle={{ color: '#ff4d4f' }}
                            />
                        </Col>
                        <Col xs={24} md={8}>
                            <Statistic
                                title="Estimated Improvement"
                                value={optimizationReport.summary?.estimatedTotalImprovement || 0}
                                suffix="%"
                                valueStyle={{ color: '#52c41a' }}
                            />
                        </Col>
                    </Row>

                    {optimizationReport.recommendations && optimizationReport.recommendations.length > 0 && (
                        <Table
                            dataSource={optimizationReport.recommendations}
                            columns={[
                                {
                                    title: 'Type',
                                    dataIndex: 'type',
                                    key: 'type',
                                    render: (type: string) => (
                                        <Tag color="blue">{type.toUpperCase()}</Tag>
                                    ),
                                },
                                {
                                    title: 'Priority',
                                    dataIndex: 'priority',
                                    key: 'priority',
                                    render: (priority: string) => (
                                        <Tag color={getPriorityColor(priority)}>
                                            {priority.toUpperCase()}
                                        </Tag>
                                    ),
                                },
                                {
                                    title: 'Description',
                                    dataIndex: 'description',
                                    key: 'description',
                                },
                                {
                                    title: 'Impact',
                                    dataIndex: 'impact',
                                    key: 'impact',
                                    ellipsis: true,
                                },
                                {
                                    title: 'Improvement',
                                    dataIndex: 'estimatedImprovement',
                                    key: 'estimatedImprovement',
                                    render: (improvement: number) => (
                                        <span style={{ color: '#52c41a' }}>
                                            +{improvement.toFixed(1)}%
                                        </span>
                                    ),
                                },
                            ]}
                            pagination={false}
                            size="small"
                            className="mt-4"
                        />
                    )}
                </Card>
            )}

            {/* System Issues */}
            {healthStatus && healthStatus.issues.length > 0 && (
                <Card title="System Issues" className="mb-6">
                    <ul className="list-disc list-inside">
                        {healthStatus.issues.map((issue, index) => (
                            <li key={index} className="text-red-600 mb-2">{issue}</li>
                        ))}
                    </ul>
                </Card>
            )}

            {/* Quick Actions */}
            <Card title="Quick Actions">
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={8}>
                        <Button
                            type="primary"
                            block
                            onClick={() => fetchPerformanceData()}
                            icon={<ReloadOutlined />}
                        >
                            Refresh Metrics
                        </Button>
                    </Col>
                    <Col xs={24} sm={8}>
                        <Button
                            block
                            onClick={() => {
                                // This would trigger cache invalidation
                                console.log('Cache invalidation triggered');
                            }}
                        >
                            Clear Cache
                        </Button>
                    </Col>
                    <Col xs={24} sm={8}>
                        <Button
                            block
                            onClick={() => {
                                // This would trigger optimization application
                                console.log('Optimization application triggered');
                            }}
                        >
                            Apply Optimizations
                        </Button>
                    </Col>
                </Row>
            </Card>
        </div>
    );
};

export default PerformancePage;
