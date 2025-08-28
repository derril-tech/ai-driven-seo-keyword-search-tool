import React from 'react';
import { Layout, Menu, Avatar, Dropdown, Button } from 'antd';
import {
    DashboardOutlined,
    ProjectOutlined,
    SearchOutlined,
    FileTextOutlined,
    UserOutlined,
    LogoutOutlined,
    SettingOutlined,
    DollarOutlined
} from '@ant-design/icons';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

const { Header, Sider, Content } = Layout;

interface MainLayoutProps {
    children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    const router = useRouter();
    const pathname = usePathname();

    const menuItems = [
        {
            key: '/dashboard',
            icon: <DashboardOutlined />,
            label: 'Dashboard',
        },
        {
            key: '/projects',
            icon: <ProjectOutlined />,
            label: 'Projects',
        },
        {
            key: '/keywords',
            icon: <SearchOutlined />,
            label: 'Keywords',
        },
        {
            key: '/billing',
            icon: <DollarOutlined />,
            label: 'Billing',
        },
        {
            key: '/performance',
            icon: <DashboardOutlined />,
            label: 'Performance',
        },
    ];

    const userMenuItems = [
        {
            key: 'profile',
            icon: <UserOutlined />,
            label: 'Profile',
        },
        {
            key: 'settings',
            icon: <SettingOutlined />,
            label: 'Settings',
        },
        {
            type: 'divider' as const,
        },
        {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: 'Logout',
            onClick: () => {
                localStorage.removeItem('token');
                router.push('/login');
            },
        },
    ];

    const handleMenuClick = ({ key }: { key: string }) => {
        router.push(key);
    };

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider
                breakpoint="lg"
                collapsedWidth="0"
                style={{
                    background: '#fff',
                    borderRight: '1px solid #f0f0f0',
                }}
            >
                <div style={{ padding: '16px', textAlign: 'center' }}>
                    <h2 style={{ margin: 0, color: '#1890ff' }}>AI SEO Tool</h2>
                </div>
                <Menu
                    mode="inline"
                    selectedKeys={[pathname]}
                    items={menuItems}
                    onClick={handleMenuClick}
                    style={{ borderRight: 'none' }}
                />
            </Sider>
            <Layout>
                <Header
                    style={{
                        background: '#fff',
                        padding: '0 24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        borderBottom: '1px solid #f0f0f0',
                    }}
                >
                    <Dropdown
                        menu={{ items: userMenuItems }}
                        placement="bottomRight"
                        arrow
                    >
                        <Button
                            type="text"
                            icon={<Avatar icon={<UserOutlined />} size="small" />}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            Demo User
                        </Button>
                    </Dropdown>
                </Header>
                <Content
                    style={{
                        margin: 0,
                        minHeight: 280,
                        background: '#f5f5f5',
                    }}
                >
                    {children}
                </Content>
            </Layout>
        </Layout>
    );
};

export default MainLayout;
