'use client';

// =====================================================
// Providers wrapper component
// Place all client-side Providers here
// =====================================================

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { SocketProvider } from '@/hooks/useSocket';
import NotificationProvider from '@/components/NotificationProvider';
import KBarWrapper from '@/components/KBarWrapper';
import { useState } from 'react';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SocketProvider>
          <KBarWrapper>
            {children}
            <NotificationProvider />
          </KBarWrapper>
        </SocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
