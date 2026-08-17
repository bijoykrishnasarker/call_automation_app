import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthGuard } from '@/components/AuthGuard';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

const themeInitScript = `(function(){try{var t=localStorage.getItem('leadops-theme');if(t!=='light'){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}else{document.documentElement.classList.remove('dark');document.documentElement.style.colorScheme='light';}}catch(e){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}})();`;

export const metadata: Metadata = {
    title: 'LeadOps AI',
    description: 'A modern, all-in-one lead operations and AI employee platform for local businesses.',
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#f4f4f5' },
        { media: '(prefers-color-scheme: dark)', color: '#0b0c0e' },
    ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
            </head>
            <body className={inter.variable} suppressHydrationWarning>
                <ThemeProvider>
                    <AuthProvider>
                        <AuthGuard>{children}</AuthGuard>
                    </AuthProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
