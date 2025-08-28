import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import MainLayout from '@/components/Layout'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'AI SEO Keyword Research Tool',
    description: 'AI-driven SEO keyword research and content brief generation',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <MainLayout>{children}</MainLayout>
            </body>
        </html>
    )
}
