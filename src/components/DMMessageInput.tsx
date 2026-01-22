'use client';

import { useState, useRef } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link,
  List,
  Quote,
  Code,
  Square,
  Plus,
  Type,
  Smile,
  AtSign,
  Video,
  Mic,
  Send,
  MoreHorizontal
} from 'lucide-react';

interface DMMessageInputProps {
  placeholder?: string;
  disabled?: boolean;
  channelId?: string;
  dmConversationId?: string;
  onMessageSent?: () => void;
}

export default function DMMessageInput({
  placeholder = 'Message',
  disabled = false,
  channelId,
  dmConversationId,
  onMessageSent
}: DMMessageInputProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    if (!message.trim() || disabled || isSending) {
      return;
    }

    const messageContent = message.trim();
    setIsSending(true);

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',  // ✅ 添加此行以包含认证Cookie
        body: JSON.stringify({
          content: messageContent,
          channelId: channelId || null,
          dmConversationId: dmConversationId || null
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      setMessage('');
      onMessageSent?.();

      // 重新聚焦到输入框
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !disabled && !isSending) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-shrink-0 bg-[#313235] border-t border-[#3A3A3D] sticky bottom-0">
      <div className="rounded-lg overflow-hidden">
        {/* 顶部格式化工具栏 */}
        <div className="flex items-center gap-1 px-3 py-2.5 border-b border-[#3A3A3D] bg-[#313235]">
          {/* 格式化按钮组 */}
          <button
            className="p-1.5 hover:bg-[#3A3A3D] rounded transition-colors"
            title="Bold (Ctrl+B)"
            disabled={disabled || isSending}
          >
            <Bold size={18} className="text-white/60" />
          </button>
          <button
            className="p-1.5 hover:bg-[#3A3A3D] rounded transition-colors"
            title="Italic (Ctrl+I)"
            disabled={disabled || isSending}
          >
            <Italic size={18} className="text-white/60" />
          </button>
          <button
            className="p-1.5 hover:bg-[#3A3A3D] rounded transition-colors"
            title="Underline (Ctrl+U)"
            disabled={disabled || isSending}
          >
            <Underline size={18} className="text-white/60" />
          </button>
          <button
            className="p-1.5 hover:bg-[#3A3A3D] rounded transition-colors"
            title="Strikethrough"
            disabled={disabled || isSending}
          >
            <Strikethrough size={18} className="text-white/60" />
          </button>

          {/* 分隔线 */}
          <div className="w-px h-5 bg-[#3A3A3D] mx-0.5" />

          <button
            className="p-1.5 hover:bg-[#3A3A3D] rounded transition-colors"
            title="Link"
            disabled={disabled || isSending}
          >
            <Link size={18} className="text-white/60" />
          </button>
          <button
            className="p-1.5 hover:bg-[#3A3A3D] rounded transition-colors"
            title="Ordered List"
            disabled={disabled || isSending}
          >
            <List size={18} className="text-white/60" />
          </button>
          <button
            className="p-1.5 hover:bg-[#3A3A3D] rounded transition-colors"
            title="Quote"
            disabled={disabled || isSending}
          >
            <Quote size={18} className="text-white/60" />
          </button>

          {/* 分隔线 */}
          <div className="w-px h-5 bg-[#3A3A3D] mx-0.5" />

          <button
            className="p-1.5 hover:bg-[#3A3A3D] rounded transition-colors"
            title="Code"
            disabled={disabled || isSending}
          >
            <Code size={18} className="text-white/60" />
          </button>
          <button
            className="p-1.5 hover:bg-[#3A3A3D] rounded transition-colors"
            title="Code Block"
            disabled={disabled || isSending}
          >
            <Square size={18} className="text-white/60" />
          </button>
        </div>

        {/* 输入区域 */}
        <div className="flex items-end gap-2 p-4">
          {/* 左侧功能区 */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* 添加附件 */}
            <button
              className="p-2 hover:bg-[#3A3A3D] rounded transition-colors"
              title="Add files"
              disabled={disabled || isSending}
            >
              <Plus size={18} className="text-white/60" />
            </button>

            {/* 格式化选项 */}
            <button
              className="p-2 hover:bg-[#3A3A3D] rounded transition-colors"
              title="Formatting"
              disabled={disabled || isSending}
            >
              <Type size={18} className="text-white/60" />
            </button>

            {/* 表情 */}
            <button
              className="p-2 hover:bg-[#3A3A3D] rounded transition-colors"
              title="Add emoji"
              disabled={disabled || isSending}
            >
              <Smile size={18} className="text-white/60" />
            </button>

            {/* 提及 */}
            <button
              className="p-2 hover:bg-[#3A3A3D] rounded transition-colors"
              title="Mention someone"
              disabled={disabled || isSending}
            >
              <AtSign size={18} className="text-white/60" />
            </button>

            {/* 视频录制 */}
            <button
              className="p-2 hover:bg-[#3A3A3D] rounded transition-colors"
              title="Record video"
              disabled={disabled || isSending}
            >
              <Video size={18} className="text-white/60" />
            </button>

            {/* 麦克风 */}
            <button
              className="p-2 hover:bg-[#3A3A3D] rounded transition-colors"
              title="Voice message"
              disabled={disabled || isSending}
            >
              <Mic size={18} className="text-white/60" />
            </button>

            {/* 更多操作 */}
            <button
              className="p-2 hover:bg-[#3A3A3D] rounded transition-colors"
              title="More options"
              disabled={disabled || isSending}
            >
              <MoreHorizontal size={18} className="text-white/60" />
            </button>
          </div>

          {/* 主输入框 */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || isSending}
              rows={1}
              className="w-full px-4 py-4 bg-transparent text-white placeholder-white/40 border-0 resize-none focus:outline-none"
              style={{
                minHeight: '52px',
                maxHeight: '200px',
                lineHeight: '1.5'
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
              }}
            />
          </div>

          {/* 右侧发送按钮 */}
          <button
            onClick={handleSend}
            disabled={!message.trim() || disabled || isSending}
            className={`p-2 rounded transition-colors ${
              message.trim() && !disabled && !isSending
                ? 'text-primary hover:bg-primary/10'
                : 'text-white/40 cursor-not-allowed'
            }`}
            title={isSending ? 'Sending...' : 'Send message'}
          >
            {isSending ? (
              <div className="w-[18px] h-[18px] border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
