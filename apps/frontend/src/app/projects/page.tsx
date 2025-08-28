'use client'

import { useState, useEffect } from 'react'
import {
    Card,
    Button,
    Table,
    Tag,
    Space,
    Modal,
    Form,
    Input,
    TextArea,
    Typography,
    Dropdown,
    Menu,
    message,
    Popconfirm
} from 'antd'
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    MoreOutlined,
    SearchOutlined,
    BarChartOutlined,
    FileTextOutlined
} from '@ant-design/icons'
import { useRouter } from 'next/navigation'

const { Title, Text } = Typography
const { Search } = Input

interface Project {
    id: string
    name: string
    description: string
    keywordsCount: number
    briefsCount: number
    status: 'active' | 'archived' | 'draft'
    createdAt: string
    updatedAt: string
}

const mockProjects: Project[] = [
    {
        id: '1',
        name: 'Digital Marketing Strategy',
        description: 'Comprehensive digital marketing keyword research and content strategy',
        keywordsCount: 847,
        briefsCount: 23,
        status: 'active',
        createdAt: '2024-01-10T10:00:00Z',
        updatedAt: '2024-01-15T14:30:00Z'
    },
    {
        id: '2',
        name: 'E-commerce SEO',
        description: 'E-commerce website optimization and keyword targeting',
        keywordsCount: 623,
        briefsCount: 18,
        status: 'active',
        createdAt: '2024-01-08T09:00:00Z',
        updatedAt: '2024-01-14T16:45:00Z'
    },
    {
        id: '3',
        name: 'Local Business Marketing',
        description: 'Local SEO and marketing for small businesses',
        keywordsCount: 234,
        briefsCount: 8,
        status: 'active',
        createdAt: '2024-01-05T11:00:00Z',
        updatedAt: '2024-01-12T10:20:00Z'
    },
    {
        id: '4',
        name: 'B2B Lead Generation',
        description: 'B2B keyword research and lead generation strategy',
        keywordsCount: 456,
        briefsCount: 15,
        status: 'draft',
        createdAt: '2024-01-03T15:00:00Z',
        updatedAt: '2024-01-10T13:15:00Z'
    }
]

export default function Projects() {
    const [projects, setProjects] = useState<Project[]>(mockProjects)
    const [loading, setLoading] = useState(false)
    const [modalVisible, setModalVisible] = useState(false)
    const [editingProject, setEditingProject] = useState<Project | null>(null)
    const [form] = Form.useForm()
    const router = useRouter()

    const getStatusColor = (status: string) => {
        const colors = {
            active: 'green',
            archived: 'default',
            draft: 'orange'
        }
        return colors[status as keyof typeof colors] || 'default'
    }

    const handleCreateProject = () => {
        setEditingProject(null)
        form.resetFields()
        setModalVisible(true)
    }

    const handleEditProject = (project: Project) => {
        setEditingProject(project)
        form.setFieldsValue(project)
        setModalVisible(true)
    }

    const handleDeleteProject = (projectId: string) => {
        setProjects(projects.filter(p => p.id !== projectId))
        message.success('Project deleted successfully')
    }

    const handleModalOk = async () => {
        try {
            const values = await form.validateFields()

            if (editingProject) {
                // Update existing project
                setProjects(projects.map(p =>
                    p.id === editingProject.id
                        ? { ...p, ...values, updatedAt: new Date().toISOString() }
                        : p
                ))
                message.success('Project updated successfully')
            } else {
                // Create new project
                const newProject: Project = {
                    id: Date.now().toString(),
                    ...values,
                    keywordsCount: 0,
                    briefsCount: 0,
                    status: 'active',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
                setProjects([newProject, ...projects])
                message.success('Project created successfully')
            }

            setModalVisible(false)
        } catch (error) {
            console.error('Form validation failed:', error)
        }
    }

    const handleViewProject = (projectId: string) => {
        router.push(`/projects/${projectId}`)
    }

    const columns = [
        {
            title: 'Project Name',
            dataIndex: 'name',
            key: 'name',
            render: (text: string, record: Project) => (
                <div>
                    <Text strong>{text}</Text>
                    <br />
                    <Text type="secondary" className="text-sm">{record.description}</Text>
                </div>
            )
        },
        {
            title: 'Keywords',
            dataIndex: 'keywordsCount',
            key: 'keywordsCount',
            render: (count: number) => (
                <Space>
                    <SearchOutlined />
                    <Text>{count}</Text>
                </Space>
            )
        },
        {
            title: 'Briefs',
            dataIndex: 'briefsCount',
            key: 'briefsCount',
            render: (count: number) => (
                <Space>
                    <FileTextOutlined />
                    <Text>{count}</Text>
                </Space>
            )
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <Tag color={getStatusColor(status)}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                </Tag>
            )
        },
        {
            title: 'Last Updated',
            dataIndex: 'updatedAt',
            key: 'updatedAt',
            render: (date: string) => new Date(date).toLocaleDateString()
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record: Project) => (
                <Space>
                    <Button
                        type="primary"
                        size="small"
                        onClick={() => handleViewProject(record.id)}
                    >
                        View
                    </Button>
                    <Dropdown
                        overlay={
                            <Menu>
                                <Menu.Item
                                    key="edit"
                                    icon={<EditOutlined />}
                                    onClick={() => handleEditProject(record)}
                                >
                                    Edit
                                </Menu.Item>
                                <Menu.Item
                                    key="delete"
                                    icon={<DeleteOutlined />}
                                    danger
                                >
                                    <Popconfirm
                                        title="Are you sure you want to delete this project?"
                                        onConfirm={() => handleDeleteProject(record.id)}
                                        okText="Yes"
                                        cancelText="No"
                                    >
                                        Delete
                                    </Popconfirm>
                                </Menu.Item>
                            </Menu>
                        }
                    >
                        <Button size="small" icon={<MoreOutlined />} />
                    </Dropdown>
                </Space>
            )
        }
    ]

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <Title level={2}>Projects</Title>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleCreateProject}
                >
                    New Project
                </Button>
            </div>

            <Card>
                <div className="mb-4">
                    <Search
                        placeholder="Search projects..."
                        allowClear
                        style={{ maxWidth: 300 }}
                    />
                </div>

                <Table
                    dataSource={projects}
                    columns={columns}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total, range) =>
                            `${range[0]}-${range[1]} of ${total} projects`
                    }}
                />
            </Card>

            <Modal
                title={editingProject ? 'Edit Project' : 'Create New Project'}
                open={modalVisible}
                onOk={handleModalOk}
                onCancel={() => setModalVisible(false)}
                width={600}
            >
                <Form
                    form={form}
                    layout="vertical"
                    initialValues={{ status: 'active' }}
                >
                    <Form.Item
                        name="name"
                        label="Project Name"
                        rules={[{ required: true, message: 'Please enter project name' }]}
                    >
                        <Input placeholder="Enter project name" />
                    </Form.Item>

                    <Form.Item
                        name="description"
                        label="Description"
                        rules={[{ required: true, message: 'Please enter project description' }]}
                    >
                        <TextArea
                            rows={4}
                            placeholder="Enter project description"
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    )
}
