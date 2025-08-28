'use client'

import { useState, useEffect } from 'react'
import {
    Card,
    Table,
    Tag,
    Space,
    Button,
    Input,
    Select,
    Slider,
    Typography,
    Progress,
    Tooltip,
    Badge,
    Drawer
} from 'antd'
import {
    SearchOutlined,
    FilterOutlined,
    EyeOutlined,
    BarChartOutlined,
    TrendingUpOutlined,
    InfoCircleOutlined
} from '@ant-design/icons'

const { Title, Text } = Typography
const { Search } = Input
const { Option } = Select

interface Keyword {
    id: string
    keyword: string
    searchVolume: number
    difficultyScore: number
    trafficPotential: number
    intentType: string
    serpFeatures: string[]
    position: number
    domain: string
    title: string
    snippet: string
}

const mockKeywords: Keyword[] = [
    {
        id: '1',
        keyword: 'digital marketing strategy',
        searchVolume: 12000,
        difficultyScore: 0.75,
        trafficPotential: 0.85,
        intentType: 'informational',
        serpFeatures: ['featured_snippet', 'people_also_ask'],
        position: 1,
        domain: 'example.com',
        title: 'Complete Digital Marketing Strategy Guide',
        snippet: 'Learn everything about digital marketing strategy with our comprehensive guide...'
    },
    {
        id: '2',
        keyword: 'best seo tools',
        searchVolume: 8900,
        difficultyScore: 0.65,
        trafficPotential: 0.78,
        intentType: 'commercial',
        serpFeatures: ['shopping_results'],
        position: 2,
        domain: 'blog.example.com',
        title: 'Top 10 SEO Tools for 2024',
        snippet: 'Discover the best SEO tools that will help you improve your website rankings...'
    },
    {
        id: '3',
        keyword: 'how to start a blog',
        searchVolume: 15000,
        difficultyScore: 0.45,
        trafficPotential: 0.92,
        intentType: 'informational',
        serpFeatures: ['featured_snippet'],
        position: 1,
        domain: 'tutorial.example.com',
        title: 'How to Start a Blog: Complete Beginner Guide',
        snippet: 'Step-by-step guide to starting your own blog from scratch...'
    },
    {
        id: '4',
        keyword: 'seo agency pricing',
        searchVolume: 3200,
        difficultyScore: 0.55,
        trafficPotential: 0.68,
        intentType: 'transactional',
        serpFeatures: ['local_pack'],
        position: 3,
        domain: 'agency.example.com',
        title: 'SEO Agency Pricing: What to Expect in 2024',
        snippet: 'Get transparent pricing information for professional SEO services...'
    },
    {
        id: '5',
        keyword: 'local seo services',
        searchVolume: 5400,
        difficultyScore: 0.70,
        trafficPotential: 0.73,
        intentType: 'local',
        serpFeatures: ['local_pack', 'map'],
        position: 1,
        domain: 'local.example.com',
        title: 'Local SEO Services Near You',
        snippet: 'Find the best local SEO services in your area...'
    }
]

export default function Keywords() {
    const [keywords, setKeywords] = useState<Keyword[]>(mockKeywords)
    const [loading, setLoading] = useState(false)
    const [filters, setFilters] = useState({
        search: '',
        intent: '',
        difficultyRange: [0, 1],
        trafficRange: [0, 1],
        features: []
    })
    const [selectedKeyword, setSelectedKeyword] = useState<Keyword | null>(null)
    const [drawerVisible, setDrawerVisible] = useState(false)

    const getIntentColor = (intent: string) => {
        const colors = {
            informational: 'blue',
            commercial: 'green',
            transactional: 'orange',
            navigational: 'purple',
            local: 'red'
        }
        return colors[intent as keyof typeof colors] || 'default'
    }

    const getDifficultyColor = (score: number) => {
        if (score < 0.3) return 'green'
        if (score < 0.6) return 'orange'
        return 'red'
    }

    const getTrafficColor = (score: number) => {
        if (score > 0.8) return 'green'
        if (score > 0.5) return 'orange'
        return 'red'
    }

    const renderSerpFeatures = (features: string[]) => {
        if (!features.length) return <Text type="secondary">None</Text>

        return (
            <Space wrap>
                {features.map(feature => (
                    <Tag key={feature} size="small" color="blue">
                        {feature.replace('_', ' ')}
                    </Tag>
                ))}
            </Space>
        )
    }

    const handleViewSerp = (keyword: Keyword) => {
        setSelectedKeyword(keyword)
        setDrawerVisible(true)
    }

    const columns = [
        {
            title: 'Keyword',
            dataIndex: 'keyword',
            key: 'keyword',
            render: (text: string, record: Keyword) => (
                <div>
                    <Text strong>{text}</Text>
                    <br />
                    <Text type="secondary" className="text-sm">
                        Volume: {record.searchVolume.toLocaleString()}
                    </Text>
                </div>
            )
        },
        {
            title: 'Intent',
            dataIndex: 'intentType',
            key: 'intentType',
            render: (intent: string) => (
                <Tag color={getIntentColor(intent)}>
                    {intent.charAt(0).toUpperCase() + intent.slice(1)}
                </Tag>
            )
        },
        {
            title: 'Difficulty',
            dataIndex: 'difficultyScore',
            key: 'difficultyScore',
            render: (score: number) => (
                <div>
                    <Progress
                        percent={Math.round(score * 100)}
                        size="small"
                        strokeColor={getDifficultyColor(score)}
                        showInfo={false}
                    />
                    <Text className="text-xs">{score.toFixed(2)}</Text>
                </div>
            )
        },
        {
            title: 'Traffic Potential',
            dataIndex: 'trafficPotential',
            key: 'trafficPotential',
            render: (score: number) => (
                <div>
                    <Progress
                        percent={Math.round(score * 100)}
                        size="small"
                        strokeColor={getTrafficColor(score)}
                        showInfo={false}
                    />
                    <Text className="text-xs">{score.toFixed(2)}</Text>
                </div>
            )
        },
        {
            title: 'SERP Features',
            dataIndex: 'serpFeatures',
            key: 'serpFeatures',
            render: (features: string[]) => renderSerpFeatures(features)
        },
        {
            title: 'Position',
            dataIndex: 'position',
            key: 'position',
            render: (position: number) => (
                <Badge
                    count={position}
                    style={{
                        backgroundColor: position <= 3 ? '#52c41a' : position <= 10 ? '#faad14' : '#ff4d4f'
                    }}
                />
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record: Keyword) => (
                <Space>
                    <Tooltip title="View SERP">
                        <Button
                            type="text"
                            icon={<EyeOutlined />}
                            size="small"
                            onClick={() => handleViewSerp(record)}
                        />
                    </Tooltip>
                    <Tooltip title="View Analytics">
                        <Button
                            type="text"
                            icon={<BarChartOutlined />}
                            size="small"
                        />
                    </Tooltip>
                </Space>
            )
        }
    ]

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <Title level={2}>Keywords</Title>
                <Space>
                    <Button icon={<FilterOutlined />}>
                        Filters
                    </Button>
                    <Button type="primary" icon={<TrendingUpOutlined />}>
                        Export
                    </Button>
                </Space>
            </div>

            {/* Filters */}
            <Card className="mb-6">
                <Space wrap className="w-full">
                    <Search
                        placeholder="Search keywords..."
                        style={{ width: 300 }}
                        value={filters.search}
                        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    />
                    <Select
                        placeholder="Intent Type"
                        style={{ width: 150 }}
                        allowClear
                        value={filters.intent}
                        onChange={(value) => setFilters({ ...filters, intent: value })}
                    >
                        <Option value="informational">Informational</Option>
                        <Option value="commercial">Commercial</Option>
                        <Option value="transactional">Transactional</Option>
                        <Option value="navigational">Navigational</Option>
                        <Option value="local">Local</Option>
                    </Select>
                    <div style={{ width: 200 }}>
                        <Text className="text-xs">Difficulty: {filters.difficultyRange[0]}-{filters.difficultyRange[1]}</Text>
                        <Slider
                            range
                            min={0}
                            max={1}
                            step={0.1}
                            value={filters.difficultyRange}
                            onChange={(value) => setFilters({ ...filters, difficultyRange: value })}
                        />
                    </div>
                    <div style={{ width: 200 }}>
                        <Text className="text-xs">Traffic: {filters.trafficRange[0]}-{filters.trafficRange[1]}</Text>
                        <Slider
                            range
                            min={0}
                            max={1}
                            step={0.1}
                            value={filters.trafficRange}
                            onChange={(value) => setFilters({ ...filters, trafficRange: value })}
                        />
                    </div>
                </Space>
            </Card>

            {/* Keywords Table */}
            <Card>
                <Table
                    dataSource={keywords}
                    columns={columns}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                        pageSize: 20,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total, range) =>
                            `${range[0]}-${range[1]} of ${total} keywords`
                    }}
                />
            </Card>

            {/* SERP Details Drawer */}
            <Drawer
                title={`SERP Analysis: ${selectedKeyword?.keyword}`}
                placement="right"
                width={600}
                open={drawerVisible}
                onClose={() => setDrawerVisible(false)}
            >
                {selectedKeyword && (
                    <div>
                        <Card title="Top Result" className="mb-4">
                            <div>
                                <Text strong>{selectedKeyword.title}</Text>
                                <br />
                                <Text type="secondary" className="text-sm">{selectedKeyword.domain}</Text>
                                <br />
                                <Text>{selectedKeyword.snippet}</Text>
                            </div>
                        </Card>

                        <Card title="SERP Features" className="mb-4">
                            {renderSerpFeatures(selectedKeyword.serpFeatures)}
                        </Card>

                        <Card title="Metrics">
                            <Space direction="vertical" className="w-full">
                                <div className="flex justify-between">
                                    <Text>Search Volume:</Text>
                                    <Text strong>{selectedKeyword.searchVolume.toLocaleString()}</Text>
                                </div>
                                <div className="flex justify-between">
                                    <Text>Difficulty Score:</Text>
                                    <Text strong>{selectedKeyword.difficultyScore.toFixed(2)}</Text>
                                </div>
                                <div className="flex justify-between">
                                    <Text>Traffic Potential:</Text>
                                    <Text strong>{selectedKeyword.trafficPotential.toFixed(2)}</Text>
                                </div>
                                <div className="flex justify-between">
                                    <Text>Current Position:</Text>
                                    <Text strong>#{selectedKeyword.position}</Text>
                                </div>
                            </Space>
                        </Card>
                    </div>
                )}
            </Drawer>
        </div>
    )
}
