'use client';

import React, { useState, useEffect } from 'react';
import { Attachment } from '@/types/message';
import FilePreviewModalContent from './FilePreviewModalContent';

interface FilePreviewModalProps {
  attachment: Attachment | null;
  onClose: () => void;
}

// 外部组件 - 处理客户端检测
export default function FilePreviewModal({ attachment, onClose }: FilePreviewModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !attachment) {
    return null;
  }

  return <FilePreviewModalContent attachment={attachment} onClose={onClose} />;
}
