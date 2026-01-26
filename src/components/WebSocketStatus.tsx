'use client';

import { useSocket } from '@/hooks/useSocket';

interface WebSocketStatusProps {
  className?: string;
  showDetails?: boolean;
}

export default function WebSocketStatus({
  className = '',
  showDetails = false
}: WebSocketStatusProps) {
  // 前端无需显示连接状态，组件始终返回 null
  return null;
}
