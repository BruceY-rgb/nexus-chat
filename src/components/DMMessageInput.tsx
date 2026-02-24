'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Message } from '@/types/message';
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
  Mic,
  Send,
  MoreHorizontal,
  Image as ImageIcon,
  X,
  Upload,
  Folder,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react';
import MentionAutocomplete from './MentionAutocomplete';
import QuoteBlock from './QuoteBlock';
import { TeamMember } from '@/types';
import { useMarkdownFormatting } from '@/hooks/useMarkdownFormatting';
import MarkdownRenderer from './MarkdownRenderer';

interface DMMessageInputProps {
  placeholder?: string;
  disabled?: boolean;
  channelId?: string;
  dmConversationId?: string;
  members?: TeamMember[]; // 成员列表，默认为空数组
  currentUserId?: string;
  onMessageSent?: (message?: Message) => void;
  compact?: boolean; // 简化模式：只显示Emoji、Mention、More Options按钮
  parentMessageId?: string; // 线程回复的父消息ID
  quotedMessage?: Message | null; // 当前引用的消息
  onClearQuote?: () => void; // 清除引用回调
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
  onMessageSent,
  compact = false,
  parentMessageId,
  quotedMessage,
  onClearQuote
}: DMMessageInputProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Markdown preview state
  const [showPreview, setShowPreview] = useState(false);

  // Markdown formatting hook
  const { insertFormatting, handleShortcut } = useMarkdownFormatting();

  // 光标位置管理
  const [pendingCursorPosition, setPendingCursorPosition] = useState<number | null>(null);
  const pendingCursorPositionRef = useRef<number | null>(null);

  // Mention autocomplete state
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [autocompletePosition, setAutocompletePosition] = useState({ x: 0, y: 0 });
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);

  // Emoji picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerPosition, setEmojiPickerPosition] = useState<{ x: number; y: number; isAbove?: boolean }>({ x: 0, y: 0 });

  // File preview modal state
  const [showFilePreview, setShowFilePreview] = useState(false);
  const [previewFileIndex, setPreviewFileIndex] = useState(0);

  // More Options dropdown state
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [moreOptionsPosition, setMoreOptionsPosition] = useState({ x: 0, y: 0 });

  // 点击外部关闭 Emoji picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showEmojiPicker) {
        const target = event.target as Node;
        const emojiPicker = document.querySelector('[data-emoji-picker="true"]');
        const emojiButton = document.querySelector('[data-emoji-button="true"]');

        // 如果点击的不是 emoji picker 本身，也不是 emoji 按钮，则关闭
        if (emojiPicker && !emojiPicker.contains(target) && emojiButton !== target) {
          setShowEmojiPicker(false);
        }
      }

      if (showMoreOptions) {
        const target = event.target as Node;
        const moreOptionsMenu = document.querySelector('[data-more-options="true"]');
        const moreOptionsButton = document.querySelector('[data-more-options-button="true"]');

        // 确保菜单存在并且确实点击了外部才关闭
        if (moreOptionsMenu) {
          const isClickingMenu = moreOptionsMenu.contains(target);
          const isClickingButton = moreOptionsButton && moreOptionsButton.contains(target);

          if (!isClickingMenu && !isClickingButton) {
            setShowMoreOptions(false);
          }
        }
      }
    };

    if (showEmojiPicker || showMoreOptions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showEmojiPicker, showMoreOptions]);

  // 同步预览层和textarea的滚动位置
  useEffect(() => {
    const textarea = textareaRef.current;
    const preview = previewRef.current;

    if (textarea && preview) {
      // 标记是否正在同步滚动，防止无限递归
      let isSyncing = false;

      // 初始化时同步滚动位置
      preview.scrollTop = textarea.scrollTop;

      // 监听预览层滚动事件，实现双向同步
      const handlePreviewScroll = (e: Event) => {
        // 防止无限递归
        if (isSyncing) return;

        const target = e.target as HTMLDivElement;
        if (textarea && target.scrollHeight > textarea.clientHeight) {
          isSyncing = true;
          const scrollPercentage = target.scrollTop / (target.scrollHeight - target.clientHeight);
          const textareaScrollTop = scrollPercentage * (textarea.scrollHeight - textarea.clientHeight);
          textarea.scrollTop = textareaScrollTop;

          // 使用 setTimeout 确保在下一轮事件循环中重置标记
          setTimeout(() => {
            isSyncing = false;
          }, 0);
        }
      };

      preview.addEventListener('scroll', handlePreviewScroll);

      return () => {
        preview.removeEventListener('scroll', handlePreviewScroll);
      };
    }
  }, [message]); // 依赖message，确保内容变化时重新设置

  // 过滤掉当前用户的成员（使用可选链安全处理）
  const availableMembers = (members || []).filter(member => member.id !== currentUserId);

  /**
   * 处理Markdown格式化
   */
  const handleFormat = useCallback((syntax: string, placeholder?: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const value = message;

    const { value: newValue, cursorPosition } = insertFormatting(
      { selectionStart, selectionEnd, value },
      syntax,
      placeholder
    );

    // 先更新消息内容
    setMessage(newValue);
    // 然后设置待应用的光标位置（使用ref管理）
    pendingCursorPositionRef.current = cursorPosition;
  }, [message, insertFormatting]);

  /**
   * 处理文件上传（图片）
   */
  const handleFileUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    // 过滤出图片文件
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      alert('Please select image files');
      return;
    }

    // 检查文件大小 (10MB 限制)
    const maxSize = 10 * 1024 * 1024;
    const oversizedFiles = imageFiles.filter(file => file.size > maxSize);
    if (oversizedFiles.length > 0) {
      alert(`File size cannot exceed 10MB. Files exceeding the limit: ${oversizedFiles.map(f => f.name).join(', ')}`);
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
        throw new Error(error.error || 'Upload failed');
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
      console.error('File upload failed:', error);
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // 移除失败的文件
      setUploadedFiles(prev => prev.filter(f => !newFiles.some(nf => nf.id === f.id)));
    } finally {
      setIsUploading(false);
    }
  }, []);

  /**
   * 处理文件传输（任意类型文件）
   */
  const handleFileTransfer = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    // 检查文件大小 (50MB 限制)
    const maxSize = 50 * 1024 * 1024;
    const oversizedFiles = files.filter(file => file.size > maxSize);
    if (oversizedFiles.length > 0) {
      alert(`File size cannot exceed 50MB. Files exceeding the limit: ${oversizedFiles.map(f => f.name).join(', ')}`);
      return;
    }

    // 为每个文件创建预览（仅用于显示文件信息）
    const newFiles: UploadedFile[] = files.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      preview: '' // 非图片文件没有预览
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);

    // 实际执行上传
    try {
      setIsUploading(true);

      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
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
      console.error('File transfer failed:', error);
      alert(`Transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip']
    },
    maxFiles: 10,
    disabled: disabled || isSending
  });

  /**
   * 计算光标位置 - 优化版（完整复制所有影响渲染的样式）
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

    // 复制所有影响文本渲染的关键属性
    div.style.fontSize = style.fontSize;
    div.style.fontFamily = style.fontFamily;
    div.style.lineHeight = style.lineHeight;
    div.style.letterSpacing = style.letterSpacing || '0';
    div.style.fontWeight = style.fontWeight;
    div.style.fontStyle = style.fontStyle;
    div.style.textAlign = style.textAlign;
    div.style.textTransform = style.textTransform;
    div.style.textIndent = style.textIndent;
    div.style.paddingLeft = style.paddingLeft;
    div.style.paddingRight = style.paddingRight;
    div.style.borderLeftWidth = style.borderLeftWidth;
    div.style.borderRightWidth = style.borderRightWidth;

    // 添加关键渲染属性，消除浏览器差异
    div.style.textRendering = 'optimizeLegibility';
    div.style.fontVariantLigatures = 'none';
    (div.style as any).WebkitFontSmoothing = 'antialiased';
    (div.style as any).MozOsxFontSmoothing = 'grayscale';

    // 获取光标前的文本
    const textBeforeCaret = textarea.value.substring(0, position);

    // 设置div内容
    div.textContent = textBeforeCaret;

    // 创建span标记光标位置
    const span = document.createElement('span');
    span.textContent = ' ';
    span.style.display = 'inline-block';
    span.style.width = '0';
    span.style.height = style.lineHeight;
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
   * 处理 @ 提及自动完成 - 智能空格检测版
   */
  const handleMentionAutocomplete = (textarea: HTMLTextAreaElement) => {
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = message.substring(0, cursorPos);

    // 使用正则表达式匹配 @ 符号以及之后最多30个字符（支持空格）
    const mentionMatch = textBeforeCursor.match(/@([^@\n]{0,30})$/);

    if (!mentionMatch) {
      setShowAutocomplete(false);
      return;
    }

    const query = mentionMatch[1]; // @ 后面的内容
    const startIndex = mentionMatch.index!; // @ 符号的位置

    // Smart termination: check if the query starts with a known member name
    // followed by a space and additional text (meaning the mention is done)
    if (query.includes(' ')) {
      // Try progressively longer substrings to find a matching member name
      // Check if any prefix of the query (up to a space boundary) matches a member
      const words = query.split(' ');
      for (let i = 1; i <= words.length - 1; i++) {
        const prefix = words.slice(0, i).join(' ');
        const exactMatch = availableMembers.find(
          m => m.displayName.toLowerCase() === prefix.toLowerCase()
        );
        if (exactMatch) {
          // The mention matches a known member, and there's text after it
          // → the mention is complete, close autocomplete
          setShowAutocomplete(false);
          return;
        }
      }
      // No prefix matched a member exactly → space is part of name, keep searching
    }

    // 如果查询为空，显示所有成员
    const displayQuery = query.trim() === '' ? '' : query;

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
    setAutocompleteQuery(displayQuery);
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
        .map(f => {
          const file = f.file;
          // 根据 mimeType 确定文件类型
          let fileType = 'file';
          if (file.type.startsWith('image/')) {
            fileType = 'image';
          } else if (file.type === 'application/pdf') {
            fileType = 'pdf';
          } else if (file.type.startsWith('text/')) {
            fileType = 'text';
          }
          return {
            ...f.uploadData,
            fileType
          };
        });

      // 根据是否有parentMessageId决定API端点
      const endpoint = parentMessageId
        ? `/api/messages/${parentMessageId}/reply`
        : '/api/messages';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          content: messageContent,
          channelId: channelId || null,
          dmConversationId: dmConversationId || null,
          attachments: attachments.length > 0 ? attachments : undefined,
          // Quote data - send snapshot of quoted message
          quote: quotedMessage ? {
            messageId: quotedMessage.id,
            content: quotedMessage.content,
            userId: quotedMessage.userId,
            userName: quotedMessage.user?.displayName || 'Unknown',
            avatarUrl: quotedMessage.user?.avatarUrl,
            createdAt: quotedMessage.createdAt
          } : undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      const responseData = await response.json();

      setMessage('');
      setUploadedFiles(prev => {
        prev.forEach(f => URL.revokeObjectURL(f.preview));
        return [];
      });
      // Clear quote after sending
      onClearQuote?.();
      onMessageSent?.(responseData);

      // 重新聚焦到输入框 - 等待 textarea 启用后聚焦
      const attemptFocus = (attempts = 0) => {
        setTimeout(() => {
          if (textareaRef.current && !textareaRef.current.disabled) {
            textareaRef.current.focus();
          } else if (attempts < 10) {
            // 最多重试10次，每次延迟50ms
            attemptFocus(attempts + 1);
          }
        }, 50); // 每次重试间隔 50ms
      };

      attemptFocus();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  /**
   * 将 @displayName 转换为 @{userId:displayName} 格式
   * Uses longest-match-first to correctly delimit mentions from subsequent text.
   */
  const convertDisplayNamesToTokens = (content: string): string => {
    if (!availableMembers.length) return content;

    // Sort members by displayName length (longest first) to match longest names first
    const sortedMembers = [...availableMembers].sort(
      (a, b) => b.displayName.length - a.displayName.length
    );

    let result = content;
    for (const member of sortedMembers) {
      // Escape special regex chars in the display name
      const escaped = member.displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match @displayName followed by a word boundary (space, punctuation, or end of string)
      const pattern = new RegExp(`@${escaped}(?=\\s|$|[^a-zA-Z0-9_])`, 'gi');
      result = result.replace(pattern, `@{${member.id}:${member.displayName}}`);
    }

    return result;
  };

  /**
   * 渲染格式化后的消息（用于输入框预览层）
   * 支持 @提及高亮和 Emoji 优化
   */
  const renderFormattedMessage = () => {
    if (!message) {
      return null;
    }

    // Build a regex that matches known member display names after @
    // Sort by length (longest first) so "Bruce Yang" matches before "Bruce"
    const sortedMembers = [...availableMembers].sort(
      (a, b) => b.displayName.length - a.displayName.length
    );

    if (sortedMembers.length === 0) {
      return renderEmojiInText(message);
    }

    // Build alternation pattern from display names
    const escapedNames = sortedMembers.map(
      m => m.displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    // Match @displayName followed by word boundary
    const mentionPattern = new RegExp(
      `(@(?:${escapedNames.join('|')}))(?=\\s|$|[^a-zA-Z0-9_])`,
      'gi'
    );

    // Split by mention pattern, keeping the delimiter
    const parts = message.split(mentionPattern);

    return parts.map((part, index) => {
      // Check if this part is a mention (starts with @)
      if (part && part.startsWith('@')) {
        const nameAfterAt = part.slice(1);
        const member = sortedMembers.find(
          m => m.displayName.toLowerCase() === nameAfterAt.toLowerCase()
        );

        if (member) {
          return (
            <span
              key={index}
              className="inline-block px-1.5 py-0.5 mx-0.5 rounded-full font-medium bg-[#1164A3]/20 text-[#3B82F6] border border-[#3B82F6]/30"
              style={{
                textRendering: 'optimizeLegibility',
                fontVariantLigatures: 'none'
              }}
            >
              @{member.displayName}
            </span>
          );
        }
      }

      // 普通文本：处理 Emoji
      return renderEmojiInText(part);
    });
  };

  /**
   * 在文本中渲染 Emoji
   * 为 Emoji 字符添加样式，使其更大且对齐更好
   */
  const renderEmojiInText = (text: string) => {
    // 匹配各种 Unicode 范围的 Emoji 字符
    const emojiRegex = /(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji})/gu;
    const parts = [...text];

    return parts.map((char, index) => {
      const isEmoji = emojiRegex.test(char);
      if (isEmoji) {
        // 重置正则状态
        emojiRegex.lastIndex = 0;
        // Emoji 字符：统一14px字体大小
        return (
          <span
            key={index}
            style={{
              fontSize: '14px',
              verticalAlign: 'middle',
              lineHeight: '1.5',
              fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
              textRendering: 'optimizeLegibility',
              fontVariantLigatures: 'none'
            }}
          >
            {char}
          </span>
        );
      }
      // 普通文本字符：统一14px字体大小
      return (
        <span
          key={index}
          style={{
            fontSize: '14px',
            lineHeight: '1.5',
            textRendering: 'optimizeLegibility',
            fontVariantLigatures: 'none'
          }}
        >
          {char}
        </span>
      );
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showAutocomplete) {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        return;
      }
    }

    // 处理Markdown格式化快捷键
    const textarea = textareaRef.current;
    if (textarea) {
      const selectionStart = textarea.selectionStart;
      const selectionEnd = textarea.selectionEnd;
      const value = message;

      // 根据快捷键确定语法类型
      const syntax =
        e.ctrlKey && e.shiftKey && e.key?.toLowerCase() === 'c' ? 'codeblock' :
        e.ctrlKey && e.shiftKey && e.key?.toLowerCase() === 'q' ? 'quote' :
        e.ctrlKey && e.shiftKey && e.key?.toLowerCase() === 'h' ? 'heading1' :
        e.ctrlKey && e.shiftKey && e.key?.toLowerCase() === 'l' ? 'ul' :
        e.ctrlKey && e.key?.toLowerCase() === 'b' ? 'bold' :
        e.ctrlKey && e.key?.toLowerCase() === 'i' ? 'italic' :
        e.ctrlKey && e.key?.toLowerCase() === 'k' ? 'link' :
        e.ctrlKey && e.key?.toLowerCase() === 'e' ? 'code' :
        null; // 无格式化

      // 只在检测到有效语法时调用insertFormatting
      if (syntax) {
        const formattingResult = insertFormatting(
          { selectionStart, selectionEnd, value },
          syntax
        );

        if (formattingResult && formattingResult.value !== value) {
          e.preventDefault();
          // 更新消息内容和光标位置
          setMessage(formattingResult.value);
          // 使用pendingCursorPositionRef而不是setPendingCursorPosition
          pendingCursorPositionRef.current = formattingResult.cursorPosition;
          return;
        }
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
    const cursorPos = e.target.selectionStart;

    setMessage(value);

    // 保存光标位置到ref，等待DOM更新后恢复
    pendingCursorPositionRef.current = cursorPos;

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

      // 保存光标位置到ref
      pendingCursorPositionRef.current = cursorPos + 1;

      // 延迟聚焦以确保光标位置正确
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          // 光标位置将在onInput事件中恢复
          handleMentionAutocomplete(textareaRef.current);
        }
      }, 0); // 减少延迟时间，使用0ms
    }
  };

  // 处理 emoji 按钮点击
  const handleEmojiButtonClick = () => {
    if (textareaRef.current) {
      // 计算emoji选择器的位置
      const textarea = textareaRef.current;
      const rect = textarea.getBoundingClientRect();
      const cursorPos = textarea.selectionStart;
      const caretCoords = getCaretCoordinates(textarea, cursorPos);

      // Emoji选择器尺寸 - 调整为适应6列布局
      const emojiPickerWidth = 320;
      const emojiPickerHeight = 280;

      // 计算相对于视口的绝对位置
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // 基础位置（相对于输入框）
      let x = rect.left + Math.max(10, Math.min(caretCoords.x, rect.width - emojiPickerWidth));
      let y;

      // 智能位置检测：检查上方和下方空间
      const spaceAbove = rect.top;
      const spaceBelow = viewportHeight - rect.bottom;

      // 如果上方空间不足280px且下方空间充足，则向下弹出
      if (spaceAbove < emojiPickerHeight && spaceBelow > spaceAbove) {
        y = rect.bottom + 8; // 向下弹出，距离输入框底部8px
      } else {
        y = rect.top - emojiPickerHeight - 8; // 向上弹出，距离输入框顶部8px
      }

      // 边界检测：确保X坐标不超出视口
      if (x + emojiPickerWidth > viewportWidth - 10) {
        x = viewportWidth - emojiPickerWidth - 10;
      }
      if (x < 10) {
        x = 10;
      }

      // 边界检测：确保Y坐标不超出视口
      if (y + emojiPickerHeight > viewportHeight - 10) {
        y = viewportHeight - emojiPickerHeight - 10;
      }
      if (y < 10) {
        y = 10;
      }

      setEmojiPickerPosition({
        x,
        y,
        isAbove: y < rect.top // 记录是否向上弹出，用于样式调整
      });

      setShowEmojiPicker(!showEmojiPicker);
    }
  };

  // 处理选择emoji
  const handleEmojiSelect = (emoji: string) => {
    if (textareaRef.current) {
      const cursorPos = textareaRef.current.selectionStart;
      const textBeforeCursor = message.substring(0, cursorPos);
      const textAfterCursor = message.substring(cursorPos);
      const newMessage = `${textBeforeCursor}${emoji}${textAfterCursor}`;
      setMessage(newMessage);

      // 使用Array.from正确计算Emoji字符数（处理多字节Emoji）
      const emojiCharCount = Array.from(emoji).length;

      // 保存光标位置到ref
      pendingCursorPositionRef.current = cursorPos + emojiCharCount;

      // 重新聚焦并设置光标位置
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          // 光标位置将在onInput事件中恢复
        }
      }, 0);
    }

    setShowEmojiPicker(false);
  };

  // 处理 More Options 按钮点击
  const handleMoreOptionsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const button = e.currentTarget as HTMLButtonElement;
    const buttonRect = button.getBoundingClientRect();

    // 计算下拉菜单位置 - 在按钮下方显示
    let x = buttonRect.left;
    let y = buttonRect.bottom + 8;

    // 确保位置在可见区域内
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuWidth = 320; // 256px + padding
    const menuHeight = 400; // 估算高度

    if (x + menuWidth > viewportWidth - 20) {
      x = viewportWidth - menuWidth - 20;
    }
    if (y + menuHeight > viewportHeight - 20) {
      y = buttonRect.top - menuHeight - 8; // 在按钮上方显示
    }

    setMoreOptionsPosition({ x, y });
    setShowMoreOptions(true);
  };

  // 常用emoji列表
  const commonEmojis = [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
    '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
    '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
    '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
    '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
    '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉',
    '👆', '👇', '☝️', '👋', '🤚', '🖐️', '🖖', '👊', '✊', '🤛',
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
    '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '⚽', '🏀',
    '🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒'
  ];

  // 处理图片点击预览
  const handleImagePreview = (index: number) => {
    setPreviewFileIndex(index);
    setShowFilePreview(true);
  };

  // 关闭预览
  const closePreview = () => {
    setShowFilePreview(false);
  };

  // 上一张图片
  const goToPrevious = () => {
    setPreviewFileIndex(prev => (prev > 0 ? prev - 1 : imageFiles.length - 1));
  };

  // 下一张图片
  const goToNext = () => {
    setPreviewFileIndex(prev => (prev < imageFiles.length - 1 ? prev + 1 : 0));
  };

  // 键盘事件处理
  useEffect(() => {
    if (showFilePreview) {
      const handleKeyDown = (e: KeyboardEvent) => {
        switch (e.key) {
          case 'Escape':
            closePreview();
            break;
          case 'ArrowLeft':
            goToPrevious();
            break;
          case 'ArrowRight':
            goToNext();
            break;
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [showFilePreview]);

  // 获取所有图片文件
  const imageFiles = uploadedFiles.filter(f => f.file.type.startsWith('image/'));

  return (
    <div
      className="flex-shrink-0 bg-[#313235] border-t border-[#3A3A3D] sticky bottom-0 h-full"
      style={{
        transform: 'none',
        willChange: 'auto'
      }}
    >
      <div
        className="rounded-lg overflow-hidden"
        style={{
          transform: 'none',
          willChange: 'auto'
        }}
      >
        {/* 完整模式：顶部格式化工具栏 */}
        {!compact && (
          <div className="flex items-center gap-1 px-3 py-2.5 border-b border-[#3A3A3D] bg-[#313235]">
            {/* 格式化按钮组 */}
            <button
              className="p-1.5 hover:bg-[#3A3A3D] rounded transition-colors"
              title="Bold (Ctrl+B)"
              disabled={disabled || isSending}
              onClick={() => handleFormat('bold')}
            >
              <Bold size={18} className="text-white/60" />
            </button>
            <button
              className="p-1.5 hover:bg-[#3A3A3D] rounded transition-colors"
              title="Italic (Ctrl+I)"
              disabled={disabled || isSending}
              onClick={() => handleFormat('italic')}
            >
              <Italic size={18} className="text-white/60" />
            </button>
            <button
              className="p-1.5 hover:bg-[#3A3A3D] rounded transition-colors"
              title="Underline (Ctrl+U)"
              disabled={disabled || isSending}
              onClick={() => handleFormat('underline')}
            >
              <Underline size={18} className="text-white/60" />
            </button>
            <button
              className="p-1.5 hover:bg-[#3A3A3D] rounded transition-colors"
              title="Strikethrough"
              disabled={disabled || isSending}
              onClick={() => handleFormat('strikethrough')}
            >
              <Strikethrough size={18} className="text-white/60" />
            </button>

            {/* 分隔线 */}
            <div className="w-px h-5 bg-[#3A3A3D] mx-0.5" />

            <button
              className="p-1.5 hover:bg-[#3A3A3D] rounded transition-colors"
              title="Link (Ctrl+K)"
              disabled={disabled || isSending}
              onClick={() => handleFormat('link')}
            >
              <Link size={18} className="text-white/60" />
            </button>
            <button
              className="p-1.5 hover:bg-[#3A3A3D] rounded transition-colors"
              title="Ordered List"
              disabled={disabled || isSending}
              onClick={() => handleFormat('ol')}
            >
              <List size={18} className="text-white/60" />
            </button>
            <button
              className="p-1.5 hover:bg-[#3A3A3D] rounded transition-colors"
              title="Quote (Ctrl+Shift+Q)"
              disabled={disabled || isSending}
              onClick={() => handleFormat('quote')}
            >
              <Quote size={18} className="text-white/60" />
            </button>

            {/* 分隔线 */}
            <div className="w-px h-5 bg-[#3A3A3D] mx-0.5" />

            <button
              className="p-1.5 hover:bg-[#3A3A3D] rounded transition-colors"
              title="Inline Code (Ctrl+E)"
              disabled={disabled || isSending}
              onClick={() => handleFormat('code')}
            >
              <Code size={18} className="text-white/60" />
            </button>
            <button
              className="p-1.5 hover:bg-[#3A3A3D] rounded transition-colors"
              title="Code Block (Ctrl+Shift+C)"
              disabled={disabled || isSending}
              onClick={() => handleFormat('codeblock', 'javascript')}
            >
              <Square size={18} className="text-white/60" />
            </button>

            {/* 分隔线 */}
            <div className="w-px h-5 bg-[#3A3A3D] mx-0.5" />

            {/* 预览按钮 */}
            <button
              className="p-1.5 hover:bg-[#3A3A3D] rounded transition-colors"
              title={showPreview ? 'Hide Preview' : 'Show Preview'}
              disabled={disabled || isSending}
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? <EyeOff size={18} className="text-white/60" /> : <Eye size={18} className="text-white/60" />}
            </button>
          </div>
        )}

        {/* 预览层 */}
        {showPreview && !compact && (
          <div className="max-h-64 overflow-y-auto bg-gray-900 border-t border-[#3A3A3D] p-4">
            <div className="text-sm text-gray-300 mb-2 font-medium">Preview</div>
            <MarkdownRenderer
              content={message}
              members={members}
              currentUserId={currentUserId || ''}
              className="text-sm"
            />
          </div>
        )}

        {/* Quote Block - shown when user is quoting a message */}
        {quotedMessage && (
          <div className="px-4 pt-4 pb-2 group">
            <QuoteBlock
              content={quotedMessage.content}
              userName={quotedMessage.user?.displayName || quotedMessage.quotedUserName || 'Unknown'}
              avatarUrl={quotedMessage.user?.avatarUrl || quotedMessage.quotedAvatarUrl}
              createdAt={quotedMessage.createdAt || quotedMessage.quotedAt || new Date().toISOString()}
              isDeleted={quotedMessage.isDeleted}
              showRemoveButton={true}
              onRemove={onClearQuote}
            />
          </div>
        )}

        {/* Input Area */}
        <div className="flex items-end gap-2 p-4">
          {/* 完整模式：左侧功能区（完整版） */}
          {!compact && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* 图片上传 */}
              <button
                className="p-2 hover:bg-[#3A3A3D] rounded transition-colors"
                title="Upload images"
                disabled={disabled || isSending || isUploading}
                onClick={() => document.getElementById('image-upload-input')?.click()}
              >
                {isUploading ? (
                  <Loader2 size={18} className="text-white/60 animate-spin" />
                ) : (
                  <ImageIcon size={18} className="text-white/60" />
                )}
              </button>

              {/* 文件传输 */}
              <button
                className="p-2 hover:bg-[#3A3A3D] rounded transition-colors"
                title="File transfer"
                disabled={disabled || isSending}
                onClick={() => document.getElementById('file-transfer-input')?.click()}
              >
                <Folder size={18} className="text-white/60" />
              </button>

              {/* 格式化选项 */}
              <button
                className="p-2 hover:bg-[#3A3A3D] rounded transition-colors"
                title="Formatting"
                disabled={disabled || isSending}
              >
                <Type size={18} className="text-white/60" />
              </button>

              {/* Emoji */}
              <button
                data-emoji-button="true"
                className="p-2 hover:bg-[#3A3A3D] rounded transition-colors"
                title="Add emoji"
                disabled={disabled || isSending}
                onClick={handleEmojiButtonClick}
              >
                <Smile size={18} className="text-white/60" />
              </button>

              {/* Mention */}
              <button
                className="p-2 hover:bg-[#3A3A3D] rounded transition-colors"
                title="Mention someone"
                disabled={disabled || isSending}
                onClick={handleAtButtonClick}
              >
                <AtSign size={18} className="text-white/60" />
              </button>

              {/* 麦克风 */}
              <button
                className="p-2 hover:bg-[#3A3A3D] rounded transition-colors"
                title="Voice message"
                disabled={disabled || isSending}
              >
                <Mic size={18} className="text-white/60" />
              </button>
            </div>
          )}

          {/* 简化模式：左侧功能区（简化版） */}
          {compact && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Emoji */}
              <button
                data-emoji-button="true"
                className="p-2 hover:bg-[#3A3A3D] rounded transition-colors"
                title="Add emoji"
                disabled={disabled || isSending}
                onClick={handleEmojiButtonClick}
              >
                <Smile size={18} className="text-white/60" />
              </button>

              {/* Mention */}
              <button
                className="p-2 hover:bg-[#3A3A3D] rounded transition-colors"
                title="Mention someone"
                disabled={disabled || isSending}
                onClick={handleAtButtonClick}
              >
                <AtSign size={18} className="text-white/60" />
              </button>

              {/* More Options */}
              <button
                type="button"
                data-more-options-button="true"
                className="p-2 hover:bg-[#3A3A3D] rounded transition-colors"
                title="More options"
                disabled={disabled || isSending}
                onClick={handleMoreOptionsClick}
              >
                <MoreHorizontal size={18} className="text-white/60" />
              </button>
            </div>
          )}

          {/* 主输入框 */}
          <div
            className="flex-1 relative min-w-0"
            style={{
              overflow: 'visible',
              transform: 'none',
              willChange: 'auto'
            }}
          >
            {/* Placeholder 显示层 */}
            {!message && (
              <div className="absolute inset-0 px-4 py-4 text-white/40 pointer-events-none">
                <div style={{ fontSize: '14px', lineHeight: '1.5', letterSpacing: '0' }}>
                  {placeholder}
                </div>
              </div>
            )}

            {/* 格式化预览层 */}
            <div
              ref={previewRef}
              className="absolute inset-0 px-4 py-4 text-white pointer-events-none overflow-y-auto"
              style={{
                minHeight: '52px',
                maxHeight: '200px',
                lineHeight: '1.5',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                fontSize: '14px',
                letterSpacing: '0',
                textRendering: 'optimizeLegibility',
                fontVariantLigatures: 'none',
                fontVariantNumeric: 'normal', // 禁用tabular-nums，确保数字宽度一致
                fontFeatureSettings: 'normal', // 禁用字体特性
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              <div
                style={{
                  fontSize: '14px',
                  lineHeight: '1.5',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                  letterSpacing: '0',
                  textRendering: 'optimizeLegibility',
                  fontVariantLigatures: 'none',
                  fontVariantNumeric: 'normal',
                  fontFeatureSettings: 'normal',
                  whiteSpace: 'inherit',
                  wordBreak: 'inherit'
                }}
              >
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
              className="w-full px-4 py-4 bg-transparent text-transparent caret-white border-0 resize-none focus:outline-none overflow-y-auto"
              style={{
                minHeight: '52px',
                maxHeight: '200px',
                lineHeight: '1.5',
                caretColor: 'white',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                fontSize: '14px',
                textRendering: 'optimizeLegibility',
                fontVariantLigatures: 'none',
                fontVariantNumeric: 'normal', // 禁用tabular-nums，确保数字宽度一致
                fontFeatureSettings: 'normal', // 禁用字体特性
                letterSpacing: '0'
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${Math.min(target.scrollHeight, 200)}px`;

                // 恢复光标位置
                if (pendingCursorPositionRef.current !== null && target === document.activeElement) {
                  requestAnimationFrame(() => {
                    target.setSelectionRange(
                      pendingCursorPositionRef.current!,
                      pendingCursorPositionRef.current!
                    );
                    pendingCursorPositionRef.current = null;
                  });
                }
              }}
              onScroll={(e) => {
                // 标记是否正在同步滚动，防止无限递归
                const textarea = e.target as HTMLTextAreaElement;
                const previewLayer = previewRef.current;
                if (previewLayer && textarea.scrollHeight > textarea.clientHeight) {
                  const scrollPercentage = textarea.scrollTop / (textarea.scrollHeight - textarea.clientHeight);
                  const previewScrollTop = scrollPercentage * (previewLayer.scrollHeight - previewLayer.clientHeight);
                  previewLayer.scrollTop = previewScrollTop;
                }
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

            {/* Emoji Picker - 使用 Portal 渲染到 document.body */}
            {showEmojiPicker ? createPortal(
              <div
                data-emoji-picker="true"
                className="fixed z-[999999] bg-[#2A2A2D] border border-[#3A3A3D] rounded-lg shadow-2xl"
                style={{
                  left: `${emojiPickerPosition.x}px`,
                  top: `${emojiPickerPosition.y}px`,
                  width: '320px',
                  maxHeight: '280px',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05)'
                }}
              >
                {/* 箭头指示器 - 根据弹出方向显示 */}
                <div
                  className={`absolute w-3 h-3 bg-[#2A2A2D] border-[#3A3A3D] ${
                    emojiPickerPosition.isAbove ? 'top-full' : 'bottom-full'
                  }`}
                  style={{
                    transform: emojiPickerPosition.isAbove ? 'rotate(45deg) translateY(-6px)' : 'rotate(45deg) translateY(6px)',
                    left: '24px',
                    borderLeft: emojiPickerPosition.isAbove ? 'none' : '1px',
                    borderTop: emojiPickerPosition.isAbove ? 'none' : '1px',
                    borderRight: emojiPickerPosition.isAbove ? '1px' : 'none',
                    borderBottom: emojiPickerPosition.isAbove ? '1px' : 'none'
                  }}
                />

                <div className="p-3 border-b border-[#3A3A3D] flex items-center justify-between">
                  <h3 className="text-sm font-medium text-white">Select Emoji</h3>
                  <button
                    onClick={() => setShowEmojiPicker(false)}
                    className="text-white/60 hover:text-white transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="p-3 overflow-y-auto" style={{ maxHeight: '240px' }}>
                  <div className="grid grid-cols-6 gap-2">
                    {commonEmojis.map((emoji, index) => (
                      <button
                        key={index}
                        onClick={() => handleEmojiSelect(emoji)}
                        className="w-11 h-11 flex items-center justify-center text-3xl hover:bg-[#3A3A3D] rounded-lg transition-colors"
                        title={emoji}
                        style={{
                          fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
                          lineHeight: 1
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>,
              document.body
            ) : null}
          </div>

          {/* 文件预览区域 */}
          {uploadedFiles.length > 0 && (
            <div className="flex-1 px-4 pb-2">
              <div className="flex flex-wrap gap-2">
                {uploadedFiles.map((uploadedFile) => (
                  <div
                    key={uploadedFile.id}
                    className="relative group"
                  >
                    {uploadedFile.file.type.startsWith('image/') ? (
                      // 图片文件预览 - 可点击全屏查看
                      <div
                        className="w-20 h-20 rounded-lg overflow-hidden border border-[#3A3A3D] cursor-pointer hover:border-[#4A4A4D] transition-colors"
                        onClick={() => handleImagePreview(imageFiles.findIndex(img => img.id === uploadedFile.id))}
                      >
                        <img
                          src={uploadedFile.preview}
                          alt={uploadedFile.file.name}
                          className="w-full h-full object-cover"
                        />
                        {uploadedFile.error && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <span className="text-xs text-red-400">Upload failed</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      // 非图片文件显示
                      <div className="w-48 h-20 rounded-lg border border-[#3A3A3D] bg-[#2A2A2D] flex items-center px-3">
                        <div className="flex items-center gap-3">
                          <Upload size={20} className="text-white/60 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-white/90 truncate">
                              {uploadedFile.file.name}
                            </div>
                            <div className="text-xs text-white/50">
                              {(uploadedFile.file.size / 1024 / 1024).toFixed(2)} MB
                            </div>
                          </div>
                        </div>
                        {uploadedFile.error && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <span className="text-xs text-red-400">Upload failed</span>
                          </div>
                        )}
                      </div>
                    )}
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

      {/* 全屏图片预览模态框 */}
      {showFilePreview && imageFiles.length > 0 ? createPortal(
        <div
          className="fixed inset-0 z-[999999] bg-black/90 flex items-center justify-center"
          onClick={closePreview}
        >
          {/* 关闭按钮 */}
          <button
            onClick={closePreview}
            className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
          >
            <X size={24} className="text-white" />
          </button>

          {/* 上一张按钮 */}
          {imageFiles.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToPrevious();
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}

          {/* 下一张按钮 */}
          {imageFiles.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToNext();
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          )}

          {/* 图片容器 */}
          <div
            className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={imageFiles[previewFileIndex]?.preview || ''}
              alt={imageFiles[previewFileIndex]?.file.name || ''}
              className="max-w-full max-h-full object-contain"
            />
          </div>

          {/* 图片信息 */}
          {imageFiles.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 rounded-full">
              <span className="text-white text-sm">
                {previewFileIndex + 1} / {imageFiles.length}
              </span>
            </div>
          )}

          {/* 图片名称 */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 max-w-[80vw] px-4 py-2 bg-black/50 rounded-lg">
            <span className="text-white text-sm text-center block">
              {imageFiles[previewFileIndex]?.file.name}
            </span>
          </div>
        </div>,
        document.body
      ) : null}

      {/* More Options Dropdown Menu */}
      {showMoreOptions && (
        createPortal(
          <div
            data-more-options="true"
            className="bg-[#313235] border border-[#3A3A3D] rounded-lg shadow-xl py-2 w-64"
            style={{
              left: moreOptionsPosition.x,
              top: moreOptionsPosition.y,
              zIndex: 999999,
              position: 'fixed',
              display: 'block',
              visibility: 'visible',
              maxWidth: '320px',
              minWidth: '200px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Formatting Group */}
            <div className="px-3 py-1">
              <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">
                Formatting
              </div>
              <div className="grid grid-cols-2 gap-1">
                <button
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#3A3A3D] rounded transition-colors text-left"
                  onClick={() => {
                    handleFormat('bold');
                    setShowMoreOptions(false);
                  }}
                >
                  <Bold size={16} className="text-white/60" />
                  <span className="text-sm text-white/80">Bold</span>
                </button>
                <button
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#3A3A3D] rounded transition-colors text-left"
                  onClick={() => {
                    handleFormat('italic');
                    setShowMoreOptions(false);
                  }}
                >
                  <Italic size={16} className="text-white/60" />
                  <span className="text-sm text-white/80">Italic</span>
                </button>
                <button
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#3A3A3D] rounded transition-colors text-left"
                  onClick={() => {
                    handleFormat('underline');
                    setShowMoreOptions(false);
                  }}
                >
                  <Underline size={16} className="text-white/60" />
                  <span className="text-sm text-white/80">Underline</span>
                </button>
                <button
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#3A3A3D] rounded transition-colors text-left"
                  onClick={() => {
                    handleFormat('strikethrough');
                    setShowMoreOptions(false);
                  }}
                >
                  <Strikethrough size={16} className="text-white/60" />
                  <span className="text-sm text-white/80">Strikethrough</span>
                </button>
                <button
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#3A3A3D] rounded transition-colors text-left"
                  onClick={() => {
                    handleFormat('link');
                    setShowMoreOptions(false);
                  }}
                >
                  <Link size={16} className="text-white/60" />
                  <span className="text-sm text-white/80">Link</span>
                </button>
                <button
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#3A3A3D] rounded transition-colors text-left"
                  onClick={() => {
                    handleFormat('ol');
                    setShowMoreOptions(false);
                  }}
                >
                  <List size={16} className="text-white/60" />
                  <span className="text-sm text-white/80">List</span>
                </button>
                <button
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#3A3A3D] rounded transition-colors text-left"
                  onClick={() => {
                    handleFormat('quote');
                    setShowMoreOptions(false);
                  }}
                >
                  <Quote size={16} className="text-white/60" />
                  <span className="text-sm text-white/80">Quote</span>
                </button>
                <button
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#3A3A3D] rounded transition-colors text-left"
                  onClick={() => {
                    handleFormat('code');
                    setShowMoreOptions(false);
                  }}
                >
                  <Code size={16} className="text-white/60" />
                  <span className="text-sm text-white/80">Inline Code</span>
                </button>
                <button
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#3A3A3D] rounded transition-colors text-left"
                  onClick={() => {
                    handleFormat('codeblock', 'javascript');
                    setShowMoreOptions(false);
                  }}
                >
                  <Square size={16} className="text-white/60" />
                  <span className="text-sm text-white/80">Code Block</span>
                </button>
                <button
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#3A3A3D] rounded transition-colors text-left"
                  onClick={() => {
                    setShowPreview(!showPreview);
                    setShowMoreOptions(false);
                  }}
                >
                  {showPreview ? <EyeOff size={16} className="text-white/60" /> : <Eye size={16} className="text-white/60" />}
                  <span className="text-sm text-white/80">{showPreview ? 'Hide Preview' : 'Preview'}</span>
                </button>
              </div>
            </div>

            {/* Media Group */}
            <div className="px-3 py-1 mt-2 border-t border-[#3A3A3D]">
              <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">
                Media
              </div>
              <div className="space-y-1">
                <button
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#3A3A3D] rounded transition-colors w-full text-left"
                  disabled={disabled || isSending || isUploading}
                  onClick={() => {
                    document.getElementById('image-upload-input')?.click();
                    setShowMoreOptions(false);
                  }}
                >
                  {isUploading ? (
                    <Loader2 size={16} className="text-white/60 animate-spin" />
                  ) : (
                    <ImageIcon size={16} className="text-white/60" />
                  )}
                  <span className="text-sm text-white/80">Upload Images</span>
                </button>
                <button
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#3A3A3D] rounded transition-colors w-full text-left"
                  disabled={disabled || isSending}
                  onClick={() => {
                    document.getElementById('file-transfer-input')?.click();
                    setShowMoreOptions(false);
                  }}
                >
                  <Folder size={16} className="text-white/60" />
                  <span className="text-sm text-white/80">File Transfer</span>
                </button>
                <button
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#3A3A3D] rounded transition-colors w-full text-left"
                  disabled={disabled || isSending}
                >
                  <Mic size={16} className="text-white/60" />
                  <span className="text-sm text-white/80">Voice Message</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      )}

      {/* Hidden file inputs */}
      <input
        id="image-upload-input"
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          handleFileUpload(files);
          e.currentTarget.value = '';
        }}
      />
      <input
        id="file-transfer-input"
        type="file"
        accept=".xls,.xlsx,.doc,.docx,.ppt,.pptx,.zip,.pdf,.txt"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          handleFileTransfer(files);
          e.currentTarget.value = '';
        }}
      />
    </div>
  );
}
