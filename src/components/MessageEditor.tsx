'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Message } from '@/types/message';
import { Check, X } from 'lucide-react';

interface MessageEditorProps {
  message: Message;
  onSave: (messageId: string, content: string) => Promise<void>;
  onCancel: () => void;
  className?: string;
}

export default function MessageEditor({
  message,
  onSave,
  onCancel,
  className = ''
}: MessageEditorProps) {
  const [content, setContent] = useState(message.content || '');
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto focus and select all text
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, []);

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Enter to save (not Shift+Enter for newline)
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      // Esc to cancel
      e.preventDefault();
      handleCancel();
    }
  };

  const handleSave = async () => {
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      // Content is empty, not allowed to save
      return;
    }

    if (trimmedContent === message.content?.trim()) {
      // Content has not changed, cancel editing
      handleCancel();
      return;
    }

    setIsSaving(true);
    try {
      await onSave(message.id, trimmedContent);
    } catch (error) {
      console.error('Failed to save message:', error);
      // Can add error notification here
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setContent(message.content || '');
    onCancel();
  };

  return (
    <div className={`mt-2 ${className}`}>
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          rows={3}
          placeholder="Edit message..."
        />
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-2 mt-2">
        <button
          onClick={handleCancel}
          disabled={isSaving}
          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-300 bg-gray-600 hover:bg-gray-500 rounded transition-colors disabled:opacity-50"
        >
          <X size={14} />
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving || !content.trim()}
          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
        >
          <Check size={14} />
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Hint information */}
      <div className="mt-1 text-xs text-gray-400">
        <span>Enter to save • Shift+Enter for newline • Esc to cancel</span>
      </div>
    </div>
  );
}
