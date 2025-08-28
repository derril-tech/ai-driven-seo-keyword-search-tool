'use client';

import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Progress, Button, Table, Tag, Modal, message, Statistic } from 'antd';
import { DollarOutlined, BarChartOutlined, TrophyOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface UsageMetrics {
    seedsToday: number;
    serpCallsToday: number;
    exportsToday: number;
    totalKeywords: number;
    totalClusters: number;
    totalBriefs: number;
}

interface QuotaLimits {
    seedsPerDay: number;
    serpCallsPerDay: number;
    exportsPerDay: number;
    maxKeywords: number;
    maxClusters: number;
    maxBriefs: number;
}

interface BillingPlan {
    name: string;
    price: number;
    limits: QuotaLimits;
    features: string[];
}

const BillingPage: React.FC = () => {
    const [usage, setUsage] = useState<UsageMetrics | null>(null);
    const [quotas, setQuotas] = useState<QuotaLimits | null>(null);
    const [currentPlan, setCurrentPlan] = useState<BillingPlan | null>(null);
    const [plans, setPlans] = useState<BillingPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<string>('');

    useEffect(() => {
        fetchBillingData();
    }, []);

    const fetchBillingData = async () => {
        try {
            setLoading(true);
            const [usageRes, quotasRes, currentPlanRes, plansRes] = await Promise.all([
                fetch('/api/v1/billing/usage', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    },
                }),
                fetch('/api/v1/billing/quotas', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    },
                }),
                fetch('/api/v1/billing/current-plan', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    },
                }),
                fetch('/api/v1/billing/plans', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    },
                }),
            ]);

            const [usageData, quotasData, currentPlanData, plansData] = await Promise.all([
                usageRes.json(),
                quotasRes.json(),
                currentPlanRes.json(),
                plansRes.json(),
            ]);

            setUsage(usageData);
            setQuotas(quotasData);
            setCurrentPlan(currentPlanData);
            setPlans(plansData);
        } catch (error) {
            console.error('Error fetching billing data:', error);
            message.error('Failed to load billing information');
        } finally {
            setLoading(false);
        }
    };

    const handleUpgrade = async () => {
        try {
            const response = await fetch('/api/v1/billing/upgrade', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({ planName: selectedPlan }),
            });

            if (response.ok) {
                message.success('Plan upgraded successfully!');
                setUpgradeModalVisible(false);
                fetchBillingData();
            } else {
                message.error('Failed to upgrade plan');
            }
        } catch (error) {
            console.error('Error upgrading plan:', error);
            message.error('Failed to upgrade plan');
        }
    };

    const getUsagePercentage = (current: number, limit: number) => {
        return Math.min((current / limit) * 100, 100);
    };

    const getProgressColor = (percentage: number) => {
        if (percentage >= 90) return '#ff4d4f';
        if (percentage >= 75) return '#faad14';
        return '#52c41a';
    };

    if (loading) {
        return <div>Loading billing information...</div>;
    }

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold mb-2">Billing & Usage</h1>
                <p className="text-gray-600">Manage your subscription and monitor usage</p>
            </div>

            {/* Current Plan */}
            <Card className="mb-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-semibold mb-2">Current Plan</h2>
                        <div className="flex items-center gap-2">
                            <TrophyOutlined className="text-blue-500" />
                            <span className="text-xl font-bold">{currentPlan?.name}</span>
                            <span className="text-gray-500">${currentPlan?.price}/month</span>
                        </div>
                    </div>
                    <Button
                        type="primary"
                        onClick={() => setUpgradeModalVisible(true)}
                        icon={<DollarOutlined />}
                    >
                        Upgrade Plan
                    </Button>
                </div>
            </Card>

            {/* Usage Overview */}
            <Row gutter={[16, 16]} className="mb-6">
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="Seeds Today"
                            value={usage?.seedsToday || 0}
                            suffix={`/ ${quotas?.seedsPerDay || 0}`}
                            valueStyle={{ color: getProgressColor(getUsagePercentage(usage?.seedsToday || 0, quotas?.seedsPerDay || 1)) }}
                        />
                        <Progress
                            percent={getUsagePercentage(usage?.seedsToday || 0, quotas?.seedsPerDay || 1)}
                            strokeColor={getProgressColor(getUsagePercentage(usage?.seedsToday || 0, quotas?.seedsPerDay || 1))}
                            showInfo={false}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="SERP Calls Today"
                            value={usage?.serpCallsToday || 0}
                            suffix={`/ ${quotas?.serpCallsPerDay || 0}`}
                            valueStyle={{ color: getProgressColor(getUsagePercentage(usage?.serpCallsToday || 0, quotas?.serpCallsPerDay || 1)) }}
                        />
                        <Progress
                            percent={getUsagePercentage(usage?.serpCallsToday || 0, quotas?.serpCallsPerDay || 1)}
                            strokeColor={getProgressColor(getUsagePercentage(usage?.serpCallsToday || 0, quotas?.serpCallsPerDay || 1))}
                            showInfo={false}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="Exports Today"
                            value={usage?.exportsToday || 0}
                            suffix={`/ ${quotas?.exportsPerDay || 0}`}
                            valueStyle={{ color: getProgressColor(getUsagePercentage(usage?.exportsToday || 0, quotas?.exportsPerDay || 1)) }}
                        />
                        <Progress
                            percent={getUsagePercentage(usage?.exportsToday || 0, quotas?.exportsPerDay || 1)}
                            strokeColor={getProgressColor(getUsagePercentage(usage?.exportsToday || 0, quotas?.exportsPerDay || 1))}
                            showInfo={false}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="Total Keywords"
                            value={usage?.totalKeywords || 0}
                            suffix={`/ ${quotas?.maxKeywords || 0}`}
                            valueStyle={{ color: getProgressColor(getUsagePercentage(usage?.totalKeywords || 0, quotas?.maxKeywords || 1)) }}
                        />
                        <Progress
                            percent={getUsagePercentage(usage?.totalKeywords || 0, quotas?.maxKeywords || 1)}
                            strokeColor={getProgressColor(getUsagePercentage(usage?.totalKeywords || 0, quotas?.maxKeywords || 1))}
                            showInfo={false}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Available Plans */}
            <Card title="Available Plans" className="mb-6">
                <Row gutter={[16, 16]}>
                    {plans.map((plan) => (
                        <Col xs={24} sm={12} lg={6} key={plan.name}>
                            <Card
                                className={`text-center ${currentPlan?.name === plan.name ? 'border-blue-500' : ''}`}
                                hoverable
                            >
                                <h3 className="text-lg font-semibold mb-2">{plan.name}</h3>
                                <div className="text-2xl font-bold mb-4">
                                    ${plan.price}
                                    <span className="text-sm text-gray-500">/month</span>
                                </div>
                                <div className="mb-4">
                                    <div className="text-sm text-gray-600 mb-2">Limits:</div>
                                    <div className="text-xs space-y-1">
                                        <div>{plan.limits.seedsPerDay} seeds/day</div>
                                        <div>{plan.limits.serpCallsPerDay} SERP calls/day</div>
                                        <div>{plan.limits.exportsPerDay} exports/day</div>
                                        <div>{plan.limits.maxKeywords.toLocaleString()} keywords</div>
                                    </div>
                                </div>
                                <div className="mb-4">
                                    <div className="text-sm text-gray-600 mb-2">Features:</div>
                                    <div className="text-xs space-y-1">
                                        {plan.features.map((feature, index) => (
                                            <div key={index} className="flex items-center gap-1">
                                                <CheckCircleOutlined className="text-green-500" />
                                                {feature}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {currentPlan?.name === plan.name ? (
                                    <Tag color="blue">Current Plan</Tag>
                                ) : (
                                    <Button
                                        type="primary"
                                        size="small"
                                        onClick={() => {
                                            setSelectedPlan(plan.name.toLowerCase());
                                            setUpgradeModalVisible(true);
                                        }}
                                    >
                                        Upgrade
                                    </Button>
                                )}
                            </Card>
                        </Col>
                    ))}
                </Row>
            </Card>

            {/* Usage Chart */}
            <Card title="Usage Trends" className="mb-6">
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={[
                        { date: 'Mon', seeds: 5, serp: 25, exports: 2 },
                        { date: 'Tue', seeds: 8, serp: 40, exports: 3 },
                        { date: 'Wed', seeds: 12, serp: 60, exports: 5 },
                        { date: 'Thu', seeds: 15, serp: 75, exports: 7 },
                        { date: 'Fri', seeds: 18, serp: 90, exports: 8 },
                        { date: 'Sat', seeds: 10, serp: 50, exports: 4 },
                        { date: 'Sun', seeds: 7, serp: 35, exports: 3 },
                    ]}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="seeds" stroke="#8884d8" name="Seeds" />
                        <Line type="monotone" dataKey="serp" stroke="#82ca9d" name="SERP Calls" />
                        <Line type="monotone" dataKey="exports" stroke="#ffc658" name="Exports" />
                    </LineChart>
                </ResponsiveContainer>
            </Card>

            {/* Upgrade Modal */}
            <Modal
                title="Upgrade Plan"
                open={upgradeModalVisible}
                onOk={handleUpgrade}
                onCancel={() => setUpgradeModalVisible(false)}
                okText="Upgrade"
                cancelText="Cancel"
            >
                <p>Are you sure you want to upgrade to the {selectedPlan} plan?</p>
                <p className="text-sm text-gray-600 mt-2">
                    This will change your billing immediately and you'll be charged the new rate on your next billing cycle.
                </p>
            </Modal>
        </div>
    );
};

export default BillingPage;
