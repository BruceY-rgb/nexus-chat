'use client';

import { useState } from 'react';

interface UseCreateThreadReplyReturn {
  createReply: (messageId: string, content: string, attachments?: any[]) => Promise<void>;
  isCreating: boolean;
  error: Error | null;
}

export function useCreateThreadReply(): UseCreateThreadReplyReturn {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createReply = async (
    messageId: string,
    content: string,
    attachments?: any[]
  ) => {
    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch(`/api/messages/${messageId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          attachments: attachments || [],
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create reply: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  return {
    createReply,
    isCreating,
    error,
  };
}
