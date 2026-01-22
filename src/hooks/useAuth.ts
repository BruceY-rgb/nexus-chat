// =====================================================
// 认证 Hook
// =====================================================

import { useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext';

// 为了向后兼容，也提供一个独立的 hook
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}