'use client'

import { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Table, Tag, Progress, Typography, Space } from 'antd'
import {
    SearchOutlined,
    BarChartOutlined,
    FileTextOutlined,
    TrendingUpOutlined,
    ProjectOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    ExclamationCircleOutlined
} from '@ant-design/icons'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const { Title, Text } = Typography

interface DashboardStats {
    totalProjects: number
    totalKeywords: number
    totalBriefs: number
    activeJobs: number
    completionRate: number
    trendingTopics: Array<{
        topic: string
        growth: number
        keywords: number
    }>
    recentActivity: Array<{
        id: string
        type: string
        description: string
        timestamp: string
        status: string
    }>
}

const mockData: DashboardStats = {
    totalProjects: 12,
    totalKeywords: 2847,
    totalBriefs: 156,
    activeJobs: 3,
    completionRate: 87,
    trendingTopics: [
        { topic: 'AI Content Creation', growth: 45, keywords: 234 },
        { topic: 'Voice Search SEO', growth: 32, keywords: 189 },
        { topic: 'Local SEO', growth: 28, keywords: 156 },
        { topic: 'E-commerce SEO', growth: 25, keywords: 142 },
    ],
    recentActivity: [
        {
            id: '1',
            type: 'expansion',
            description: 'Digital Marketing expansion completed',
            timestamp: '2024-01-15T10:30:00Z',
            status: 'completed'
        },
        {
            id: '2',
            type: 'serp',
            description: 'SERP analysis for 50 keywords',
            timestamp: '2024-01-15T09:15:00Z',
            status: 'processing'
        },
        {
            id: '3',
            type: 'brief',
            description: 'Content brief generated for AI Marketing cluster',
            timestamp: '2024-01-15T08:45:00Z',
            status: 'completed'
        },
        {
            id: '4',
            type: 'cluster',
            description: 'Keyword clustering for E-commerce project',
            timestamp: '2024-01-15T08:00:00Z',
            status: 'failed'
        }
    ]
}

export default function Dashboard() {
    const [stats, setStats] = useState<DashboardStats>(mockData)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Simulate API call
        setTimeout(() => {
            setStats(mockData)
            setLoading(false)
        }, 1000)
    }, [])

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircleOutlined style={{ color: '#52c41a' }} />
            case 'processing':
                return <ClockCircleOutlined style={{ color: '#1890ff' }} />
            case 'failed':
                return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            default:
                return <ClockCircleOutlined style={{ color: '#d9d9d9' }} />
        }
    }

    const getStatusTag = (status: string) => {
        const colors = {
            completed: 'success',
            processing: 'processing',
            failed: 'error'
        }
        return <Tag color={colors[status as keyof typeof colors]}>{status}</Tag>
    }

    const activityColumns = [
        {
            title: 'Activity',
            dataIndex: 'description',
            key: 'description',
            render: (text: string, record: any) => (
                <Space>
                    {getStatusIcon(record.status)}
                    <Text>{text}</Text>
                </Space>
            )
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => getStatusTag(status)
        },
        {
            title: 'Time',
            dataIndex: 'timestamp',
            key: 'timestamp',
            render: (timestamp: string) => new Date(timestamp).toLocaleTimeString()
        }
    ]

    const trendingData = [
        { name: 'Jan', 'AI Content': 45, 'Voice Search': 32, 'Local SEO': 28, 'E-commerce': 25 },
        { name: 'Feb', 'AI Content': 52, 'Voice Search': 38, 'Local SEO': 31, 'E-commerce': 29 },
        { name: 'Mar', 'AI Content': 48, 'Voice Search': 35, 'Local SEO': 33, 'E-commerce': 27 },
        { name: 'Apr', 'AI Content': 61, 'Voice Search': 42, 'Local SEO': 36, 'E-commerce': 34 },
    ]

    return (
        <div className="p-6">
            <Title level={2} className="mb-6">Dashboard</Title>

            {/* KPI Cards */}
            <Row gutter={[16, 16]} className="mb-6">
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="Total Projects"
                            value={stats.totalProjects}
                            prefix={<ProjectOutlined />}
                            loading={loading}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="Total Keywords"
                            value={stats.totalKeywords}
                            prefix={<SearchOutlined />}
                            loading={loading}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="Content Briefs"
                            value={stats.totalBriefs}
                            prefix={<FileTextOutlined />}
                            loading={loading}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="Active Jobs"
                            value={stats.activeJobs}
                            prefix={<ClockCircleOutlined />}
                            loading={loading}
                        />
                    </Card>
                </Col>
            </Row>

            <Row gutter={[16, 16]} className="mb-6">
                <Col xs={24} lg={16}>
                    <Card title="Trending Topics" className="h-full">
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={trendingData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Line type="monotone" dataKey="AI Content" stroke="#8884d8" />
                                <Line type="monotone" dataKey="Voice Search" stroke="#82ca9d" />
                                <Line type="monotone" dataKey="Local SEO" stroke="#ffc658" />
                                <Line type="monotone" dataKey="E-commerce" stroke="#ff7300" />
                            </LineChart>
                        </ResponsiveContainer>
                    </Card>
                </Col>
                <Col xs={24} lg={8}>
                    <Card title="Completion Rate" className="h-full">
                        <div className="text-center">
                            <Progress
                                type="circle"
                                percent={stats.completionRate}
                                format={percent => `${percent}%`}
                                size={120}
                            />
                            <Text className="block mt-4 text-gray-600">
                                Jobs completed successfully
                            </Text>
                        </div>
                    </Card>
                </Col>
            </Row>

            <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                    <Card title="Trending Topics" className="h-full">
                        {stats.trendingTopics.map((topic, index) => (
                            <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                                <div>
                                    <Text strong>{topic.topic}</Text>
                                    <br />
                                    <Text type="secondary">{topic.keywords} keywords</Text>
                                </div>
                                <Tag color="green">
                                    <TrendingUpOutlined /> +{topic.growth}%
                                </Tag>
                            </div>
                        ))}
                    </Card>
                </Col>
                <Col xs={24} lg={12}>
                    <Card title="Recent Activity" className="h-full">
                        <Table
                            dataSource={stats.recentActivity}
                            columns={activityColumns}
                            pagination={false}
                            size="small"
                            rowKey="id"
                        />
                    </Card>
                </Col>
            </Row>
        </div>
    )
}
