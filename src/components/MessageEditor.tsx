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

  // 自动聚焦并选中所有文本
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, []);

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Enter 保存（不使用 Shift+Enter 换行）
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      // Esc 取消
      e.preventDefault();
      handleCancel();
    }
  };

  const handleSave = async () => {
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      // 内容为空，不允许保存
      return;
    }

    if (trimmedContent === message.content?.trim()) {
      // 内容没有变化，取消编辑
      handleCancel();
      return;
    }

    setIsSaving(true);
    try {
      await onSave(message.id, trimmedContent);
    } catch (error) {
      console.error('保存消息失败:', error);
      // 这里可以添加错误提示
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

      {/* 操作按钮 */}
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

      {/* 提示信息 */}
      <div className="mt-1 text-xs text-gray-400">
        <span>Enter to save • Shift+Enter for newline • Esc to cancel</span>
      </div>
    </div>
  );
}
