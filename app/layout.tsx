import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { AuthGuard } from '@/components/AuthGuard';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
    title: 'LeadOps AI',
    description: 'A modern, all-in-one lead operations and AI employee platform for local businesses.',
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#0b0c0e' },
        { media: '(prefers-color-scheme: dark)', color: '#0b0c0e' },
    ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className="dark" suppressHydrationWarning>
            <body className={inter.variable} suppressHydrationWarning>
                <AuthProvider>
                    <AuthGuard>{children}</AuthGuard>
                </AuthProvider>
            </body>
        </html>
    );
}
