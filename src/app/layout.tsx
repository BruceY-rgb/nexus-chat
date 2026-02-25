// =====================================================
// Root Layout
// =====================================================

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Providers from '@/components/providers';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Slack-like Chat Tool',
  description: 'A real-time chat application',
};

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <Providers>
          {children}
          <Toaster position="top-right" richColors />
        </Providers>
      </body>
    </html>
  );
}