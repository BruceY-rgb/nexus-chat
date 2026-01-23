'use client';

import { useState, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
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
  MoreHorizontal,
  Image as ImageIcon,
  X,
  Upload,
  Loader2
} from 'lucide-react';
import MentionAutocomplete from './MentionAutocomplete';
import { TeamMember } from '@/types';

interface DMMessageInputProps {
  placeholder?: string;
  disabled?: boolean;
  channelId?: string;
  dmConversationId?: string;
  members?: TeamMember[]; // 成员列表，默认为空数组
  currentUserId?: string;
  onMessageSent?: () => void;
}

interface UploadedFile {
  id: string;
  file: File;
  preview: string;
  uploadProgress?: number;
  error?: string;
  uploadData?: any;
}

export default function DMMessageInput({
  placeholder = 'Message',
  disabled = false,
  channelId,
  dmConversationId,
  members = [],
  currentUserId,
  onMessageSent
}: DMMessageInputProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Mention autocomplete state
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [autocompletePosition, setAutocompletePosition] = useState({ x: 0, y: 0 });
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);

  // 过滤掉当前用户的成员（使用可选链安全处理）
  const availableMembers = (members || []).filter(member => member.id !== currentUserId);

  /**
   * 处理文件上传
   */
  const handleFileUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    // 过滤出图片文件
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      alert('请选择图片文件');
      return;
    }

    // 检查文件大小 (10MB 限制)
    const maxSize = 10 * 1024 * 1024;
    const oversizedFiles = imageFiles.filter(file => file.size > maxSize);
    if (oversizedFiles.length > 0) {
      alert(`文件大小不能超过 10MB。超出限制的文件：${oversizedFiles.map(f => f.name).join(', ')}`);
      return;
    }

    // 为每个文件创建预览
    const newFiles: UploadedFile[] = imageFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      preview: URL.createObjectURL(file)
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);

    // 实际执行上传
    try {
      setIsUploading(true);

      const formData = new FormData();
      imageFiles.forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '上传失败');
      }

      const result = await response.json();

      // 将上传结果存储到文件对象中
      setUploadedFiles(prev => prev.map(f => {
        const uploadedFile = result.files.find((uf: any) => uf.originalName === f.file.name);
        if (uploadedFile) {
          return {
            ...f,
            uploadData: uploadedFile
          };
        }
        return f;
      }));

    } catch (error) {
      console.error('❌ 文件上传失败:', error);
      alert(`上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
      // 移除失败的文件
      setUploadedFiles(prev => prev.filter(f => !newFiles.some(nf => nf.id === f.id)));
    } finally {
      setIsUploading(false);
    }
  }, []);

  /**
   * 移除已上传的文件
   */
  const removeFile = useCallback((fileId: string) => {
    setUploadedFiles(prev => {
      const file = prev.find(f => f.id === fileId);
      if (file) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter(f => f.id !== fileId);
    });
  }, []);

  /**
   * 配置拖拽上传
   */
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFileUpload,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    maxFiles: 10,
    disabled: disabled || isSending
  });

  /**
   * 计算光标位置 - 动态跟随版
   */
  const getCaretCoordinates = (textarea: HTMLTextAreaElement, position: number) => {
    const div = document.createElement('div');
    const style = getComputedStyle(textarea);

    // 复制textarea的样式
    for (const prop of style) {
      div.style[prop as any] = style[prop as any];
    }

    // 设置测量div的样式
    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordBreak = 'break-word';
    div.style.overflow = 'hidden';
    div.style.width = textarea.clientWidth + 'px';
    div.style.fontSize = style.fontSize;
    div.style.fontFamily = style.fontFamily;
    div.style.lineHeight = style.lineHeight;

    // 获取光标前的文本
    const textBeforeCaret = textarea.value.substring(0, position);

    // 设置div内容
    div.textContent = textBeforeCaret;

    // 创建span标记光标位置
    const span = document.createElement('span');
    span.textContent = ' ';
    div.appendChild(span);

    // 将测量div放到和textarea相同的位置
    div.style.left = textarea.offsetLeft + 'px';
    div.style.top = textarea.offsetTop + 'px';

    document.body.appendChild(div);

    // 计算相对于输入框的坐标
    const rect = span.getBoundingClientRect();
    const textareaRect = textarea.getBoundingClientRect();

    // 返回相对于输入框的坐标
    const x = rect.left - textareaRect.left;
    const y = rect.top - textareaRect.top;

    document.body.removeChild(div);

    return { x, y };
  };

  /**
   * 处理 @ 提及自动完成
   */
  const handleMentionAutocomplete = (textarea: HTMLTextAreaElement) => {
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = message.substring(0, cursorPos);

    // 使用正则表达式匹配 @ 符号以及之后最多30个字符（支持空格）
    // 模式：/@([^@\n]{0,30})$ - 匹配 @ 后面最多30个非@非换行符的字符
    const mentionMatch = textBeforeCursor.match(/@([^@\n]{0,30})$/);

    if (!mentionMatch) {
      setShowAutocomplete(false);
      return;
    }

    const query = mentionMatch[1];
    const startIndex = mentionMatch.index!;

    // 计算位置 - 简化相对定位版
    const caretPos = getCaretCoordinates(textarea, cursorPos);

    // 弹窗尺寸
    const popupWidth = 280;

    // 简化的 X 坐标计算（相对于输入框）
    let popupX = caretPos.x;
    const textareaWidth = textarea.clientWidth;

    // X 坐标边界检测
    if (popupX + popupWidth > textareaWidth - 10) {
      popupX = textareaWidth - popupWidth - 10; // 右侧边界
    }
    if (popupX < 10) {
      popupX = 10; // 左侧边界
    }

    // 强制向上弹出模式
    const finalPosition = {
      x: Math.max(10, popupX), // 最小距离左侧10px
      y: 0 // 占位符，CSS 中将使用 bottom 属性
    };

    setShowAutocomplete(true);
    setAutocompleteQuery(query);
    setAutocompletePosition(finalPosition);
    setMentionStartIndex(startIndex);
  };

  /**
   * 处理选择提及用户
   */
  const handleMentionSelect = (selectedMember: TeamMember) => {
    const beforeMention = message.substring(0, mentionStartIndex);
    const afterMention = message.substring(textareaRef.current?.selectionStart || 0);

    // 只插入友好的显示名称，后跟空格
    const mentionText = `@${selectedMember.displayName} `;

    const newMessage = `${beforeMention}${mentionText}${afterMention}`;
    setMessage(newMessage);
    setShowAutocomplete(false);

    // 重新聚焦并设置光标位置
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = beforeMention.length + mentionText.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleSend = async () => {
    // 检查是否有文本内容或已上传的图片
    // 允许：只有文字 或 只有图片 或 文字+图片
    const hasContent = message.trim().length > 0;
    const hasUploadedImages = uploadedFiles.some(f => f.uploadData && f.uploadData.fileUrl);

    if ((!hasContent && !hasUploadedImages) || disabled || isSending || isUploading) {
      return;
    }

    // 在发送前，将 @displayName 转换为 @{userId:displayName} 格式
    const messageContent = convertDisplayNamesToTokens(message.trim());
    setIsSending(true);

    try {
      // 获取已上传的文件数据
      const attachments = uploadedFiles
        .filter(f => f.uploadData)
        .map(f => ({
          ...f.uploadData,
          fileType: 'image'  // 明确标识为图片类型
        }));

      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          content: messageContent,
          channelId: channelId || null,
          dmConversationId: dmConversationId || null,
          attachments: attachments.length > 0 ? attachments : undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      setMessage('');
      setUploadedFiles(prev => {
        prev.forEach(f => URL.revokeObjectURL(f.preview));
        return [];
      });
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

  /**
   * 将 @displayName 转换为 @{userId:displayName} 格式
   */
  const convertDisplayNamesToTokens = (content: string): string => {
    // 匹配 @开头的文本，支持空格（最多30个字符）
    // 模式：/@([^@\n]{1,30})(?:(\s)|$) - 匹配 @ 后面1-30个非@非换行符的字符，后跟空格或行尾
    const mentionPattern = /@([^@\n]{1,30})(?:(\s)|$)/g;
    let convertedContent = content;
    let match;

    while ((match = mentionPattern.exec(content)) !== null) {
      const displayName = match[1];
      const fullMatch = match[0];
      const trailingChar = match[2]; // 空格（如果存在）

      // 在可用成员中查找匹配的用户（使用最长匹配优先原则）
      const member = availableMembers.find(
        m => m.displayName.toLowerCase() === displayName.toLowerCase()
      );

      if (member) {
        // 替换为 token 格式，如果原始有空格则保留，否则不添加
        const token = trailingChar
          ? `@{${member.id}:${member.displayName}} `
          : `@{${member.id}:${member.displayName}}`;
        convertedContent = convertedContent.replace(fullMatch, token);
      }
    }

    return convertedContent;
  };

  /**
   * 渲染格式化后的消息（用于输入框预览层）
   */
  const renderFormattedMessage = () => {
    if (!message) {
      return null;
    }

    // 匹配 @displayName 并高亮显示（支持空格，最多30个字符）
    // 模式：/@([^@\n]{1,30}) - 匹配 @ 后面1-30个非@非换行符的字符
    const mentionPattern = /@([^@\n]{1,30})/g;
    const parts = message.split(mentionPattern);

    return parts.map((part, index) => {
      // 奇数索引是 @提及
      if (index % 2 === 1) {
        const displayName = part;

        // 检查是否匹配可用成员
        const member = availableMembers.find(
          m => m.displayName.toLowerCase() === displayName.toLowerCase()
        );

        if (member) {
          // 高亮显示的提及
          return (
            <span
              key={index}
              className="inline-block px-1.5 py-0.5 mx-0.5 rounded-full font-medium bg-[#1164A3]/20 text-[#3B82F6] border border-[#3B82F6]/30"
            >
              @{displayName}
            </span>
          );
        } else {
          // 未匹配的普通文本
          return (
            <span key={index}>
              @{displayName}
            </span>
          );
        }
      }

      // 偶数索引是普通文本
      return part;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showAutocomplete) {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey && !disabled && !isSending) {
      e.preventDefault();
      handleSend();
    }
  };

  // 处理输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);

    // 检查是否需要显示自动完成
    handleMentionAutocomplete(e.target);
  };

  // 处理 @ 按钮点击
  const handleAtButtonClick = () => {
    if (textareaRef.current) {
      const cursorPos = textareaRef.current.selectionStart;
      const textBeforeCursor = message.substring(0, cursorPos);
      const newMessage = `${textBeforeCursor}@`;
      setMessage(newMessage);

      // 延迟聚焦以确保光标位置正确
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPos = cursorPos + 1;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
          handleMentionAutocomplete(textareaRef.current);
        }
      }, 50); // 增加延迟确保DOM更新完成
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
            {/* 图片上传 */}
            <button
              className="p-2 hover:bg-[#3A3A3D] rounded transition-colors"
              title="Upload images"
              disabled={disabled || isSending || isUploading}
              onClick={() => document.getElementById('file-upload-input')?.click()}
            >
              {isUploading ? (
                <Loader2 size={18} className="text-white/60 animate-spin" />
              ) : (
                <ImageIcon size={18} className="text-white/60" />
              )}
            </button>

            {/* 隐藏的文件输入框 */}
            <input
              id="file-upload-input"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                handleFileUpload(files);
                // 清空输入框，允许重复选择同一文件
                e.currentTarget.value = '';
              }}
            />

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
              onClick={handleAtButtonClick}
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
          <div className="flex-1 relative" style={{ overflow: 'visible' }}>
            {/* Placeholder 显示层 */}
            {!message && (
              <div className="absolute inset-0 px-4 py-4 text-white/40 pointer-events-none">
                <div className="text-sm" style={{ lineHeight: '1.5' }}>
                  {placeholder}
                </div>
              </div>
            )}

            {/* 格式化预览层 */}
            <div className="absolute inset-0 px-4 py-4 text-white pointer-events-none whitespace-pre-wrap break-words">
              <div className="text-sm" style={{ lineHeight: '1.5' }}>
                {renderFormattedMessage()}
              </div>
            </div>

            {/* 实际输入框（透明覆盖） */}
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder=""
              disabled={disabled || isSending}
              rows={1}
              className="w-full px-4 py-4 bg-transparent text-transparent caret-white border-0 resize-none focus:outline-none"
              style={{
                minHeight: '52px',
                maxHeight: '200px',
                lineHeight: '1.5',
                caretColor: 'white'
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
              }}
            />

            {/* Mention Autocomplete */}
            {showAutocomplete ? (
              <>
                <MentionAutocomplete
                  query={autocompleteQuery}
                  members={availableMembers}
                  position={autocompletePosition}
                  targetRef={textareaRef}
                  onSelect={handleMentionSelect}
                  onClose={() => {
                    setShowAutocomplete(false);
                  }}
                />
              </>
            ) : null}
          </div>

          {/* 图片预览区域 */}
          {uploadedFiles.length > 0 && (
            <div className="flex-1 px-4 pb-2">
              <div className="flex flex-wrap gap-2">
                {uploadedFiles.map((uploadedFile) => (
                  <div
                    key={uploadedFile.id}
                    className="relative group"
                  >
                    <div className="w-20 h-20 rounded-lg overflow-hidden border border-[#3A3A3D]">
                      <img
                        src={uploadedFile.preview}
                        alt={uploadedFile.file.name}
                        className="w-full h-full object-cover"
                      />
                      {uploadedFile.error && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="text-xs text-red-400">上传失败</span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removeFile(uploadedFile.id)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      disabled={isSending || isUploading}
                    >
                      <X size={14} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 右侧发送按钮 */}
          <button
            onClick={handleSend}
            disabled={(!message.trim() && !uploadedFiles.some(f => f.uploadData && f.uploadData.fileUrl)) || disabled || isSending || isUploading}
            className={`p-2 rounded transition-colors ${
              (message.trim() || uploadedFiles.some(f => f.uploadData && f.uploadData.fileUrl)) && !disabled && !isSending
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
