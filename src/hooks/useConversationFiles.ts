'use client';

import { useState, useEffect, useCallback } from 'react';

export interface ConversationAttachment {
  id: string;
  messageId: string;
  fileName: string;
  filePath: string;
  fileSize: string;
  mimeType: string;
  fileType?: string | null;
  s3Key: string;
  s3Bucket: string;
  thumbnailUrl?: string | null;
  createdAt: string;
  previewUrl?: string | null;
  sender?: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
  } | null;
  messageContent?: string;
  messageCreatedAt?: string | null;
}

interface UseConversationFilesReturn {
  attachments: ConversationAttachment[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  deleteAttachment: (attachmentId: string) => Promise<boolean>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filter: 'all' | 'image' | 'document' | 'video';
  setFilter: (filter: 'all' | 'image' | 'document' | 'video') => void;
  filteredAttachments: ConversationAttachment[];
}

export function useConversationFiles(
  conversationId: string | null,
  conversationType: 'channel' | 'dm' | null
): UseConversationFilesReturn {
  const [attachments, setAttachments] = useState<ConversationAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'image' | 'document' | 'video'>('all');

  const fetchAttachments = useCallback(async (reset = true) => {
    if (!conversationId || !conversationType) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        conversationId,
        conversationType
      });

      const response = await fetch(`/api/attachments?${params}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch attachments: ${response.statusText}`);
      }

      const data = await response.json();
      setAttachments(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, conversationType]);

  const deleteAttachment = useCallback(async (attachmentId: string): Promise<boolean> => {
    try {
      const params = new URLSearchParams({ id: attachmentId });
      const response = await fetch(`/api/attachments?${params}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete attachment');
      }

      // 删除成功后更新本地状态
      setAttachments(prev => prev.filter(att => att.id !== attachmentId));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Delete failed'));
      return false;
    }
  }, []);

  const refetch = useCallback(async () => {
    await fetchAttachments();
  }, [fetchAttachments]);

  // 根据filter过滤附件
  const filteredAttachments = attachments.filter(attachment => {
    // 搜索过滤
    if (searchQuery && !attachment.fileName.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // 类型过滤
    if (filter === 'all') return true;
    if (filter === 'image') return attachment.mimeType.startsWith('image/');
    if (filter === 'video') return attachment.mimeType.startsWith('video/');
    if (filter === 'document') {
      const docTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml',
        'text/plain'
      ];
      return docTypes.some(type => attachment.mimeType.includes(type) || attachment.mimeType === type);
    }
    return true;
  });

  // 当conversationId或conversationType改变时重新获取
  useEffect(() => {
    if (conversationId && conversationType) {
      fetchAttachments();
    } else {
      setAttachments([]);
    }
  }, [conversationId, conversationType, fetchAttachments]);

  return {
    attachments,
    isLoading,
    error,
    refetch,
    deleteAttachment,
    searchQuery,
    setSearchQuery,
    filter,
    setFilter,
    filteredAttachments
  };
}
