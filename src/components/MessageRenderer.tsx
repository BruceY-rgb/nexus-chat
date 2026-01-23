'use client';

import React, { useState } from 'react';
import { Message } from '@/types/message';
import MentionToken from './MentionToken';
import { X } from 'lucide-react';

interface MessageRendererProps {
  message: Message;
  currentUserId: string;
  className?: string;
  members?: { id: string; displayName: string }[];
}

interface ImageModalProps {
  src: string;
  alt: string;
  onClose: () => void;
  currentIndex: number;
  totalImages: number;
  onPrevious?: () => void;
  onNext?: () => void;
}

function ImageModal({ src, alt, onClose, currentIndex, totalImages, onPrevious, onNext }: ImageModalProps) {
  // 处理键盘事件
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && onPrevious) {
        onPrevious();
      } else if (e.key === 'ArrowRight' && onNext) {
        onNext();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPrevious, onNext, onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors z-10"
        >
          <X size={32} />
        </button>

        {/* 上一张按钮 */}
        {onPrevious && totalImages > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPrevious();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 transition-colors z-10 bg-black/50 rounded-full p-2 hover:bg-black/70"
            aria-label="Previous image"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className="w-8 h-8"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        )}

        {/* 图片 */}
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-full object-contain rounded-lg"
          onClick={(e) => e.stopPropagation()}
        />

        {/* 下一张按钮 */}
        {onNext && totalImages > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 transition-colors z-10 bg-black/50 rounded-full p-2 hover:bg-black/70"
            aria-label="Next image"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className="w-8 h-8"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        )}

        {/* 图片索引指示器 */}
        {totalImages > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
            {currentIndex + 1} / {totalImages}
          </div>
        )}
      </div>
    </div>
  );
}

interface MentionedUser {
  id: string;
  displayName: string;
}

/**
 * 将消息内容中的 @提及高亮显示
 * 支持 Token 化提及和传统文本提及
 */
export default function MessageRenderer({
  message,
  currentUserId,
  className = '',
  members = []
}: MessageRendererProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  // 从消息的 mentions 字段中提取被提及的用户
  const mentionedUsers: MentionedUser[] = message.mentions?.map(m => ({
    id: m.mentionedUser.id,
    displayName: m.mentionedUser.displayName
  })) || [];

  // 检查当前用户是否被提及
  const isMentioned = mentionedUsers.some(user => user.id === currentUserId);

  // 获取当前选中的图片
  const imageAttachments = message.attachments?.filter(att => att.mimeType.startsWith('image/')) || [];
  const selectedImage = selectedImageIndex !== null ? {
    src: imageAttachments[selectedImageIndex].thumbnailUrl || imageAttachments[selectedImageIndex].filePath,
    alt: imageAttachments[selectedImageIndex].fileName
  } : null;

  // 导航到上一张图片
  const goToPreviousImage = () => {
    if (selectedImageIndex !== null && selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1);
    }
  };

  // 导航到下一张图片
  const goToNextImage = () => {
    if (selectedImageIndex !== null && selectedImageIndex < imageAttachments.length - 1) {
      setSelectedImageIndex(selectedImageIndex + 1);
    }
  };

  // 关闭预览
  const closeImagePreview = () => {
    setSelectedImageIndex(null);
  };

  /**
   * 渲染消息内容，支持 Token 化提及
   */
  const renderMessageContent = () => {
    if (!message.content) {
      return null;
    }

    // 检查是否包含 Token
    const tokenPattern = /@\{([^:]+):([^}]+)\}/g;
    const parts = message.content.split(tokenPattern);

    return parts.map((part, index) => {
      // 奇数索引是捕获组（ID 和显示名称）
      if (index % 2 === 1) {
        const userId = parts[index];
        const displayName = parts[index + 1];

        // 只有当 displayName 存在且不是空白时才处理这个 token
        if (!displayName) {
          // 如果没有 displayName，返回原始文本
          return part;
        }

        // 查找成员信息
        const member = members.find(m => m.id === userId);
        const actualDisplayName = member?.displayName || displayName;

        return (
          <MentionToken
            key={`${userId}-${index}`}
            userId={userId}
            displayName={actualDisplayName}
            isCurrentUserMentioned={userId === currentUserId}
            onRemove={() => {}} // 消息中不可删除
            isEditing={false}
          />
        );
      }

      // 处理普通 @提及（传统格式，支持带空格的用户名）
      if (part.includes('@')) {
        // 匹配 @ 后面1-30个非@非换行符的字符（支持空格）
        const mentionRegex = /@([^@\n]{1,30})/g;
        const textParts = part.split(mentionRegex);

        return textParts.map((textPart, textIndex) => {
          if (textIndex % 2 === 1) {
            // 这是一个 @提及
            const isCurrentUserMentioned = mentionedUsers.some(
              user => user.displayName === textPart
            );

            return (
              <span
                key={`${part}-${textIndex}`}
                className={`inline-block px-1.5 py-0.5 mx-0.5 rounded font-medium ${
                  isCurrentUserMentioned
                    ? 'bg-blue-500/20 text-blue-400 font-semibold border border-blue-500/30'
                    : 'bg-blue-500/10 text-blue-300'
                }`}
              >
                @{textPart}
              </span>
            );
          }

          // 普通文本
          return textPart;
        });
      }

      // 普通文本
      return part;
    });
  };

  /**
   * 渲染图片附件
   */
  const renderAttachments = () => {
    if (imageAttachments.length === 0) {
      return null;
    }

    // 根据图片数量决定布局
    const imageCount = imageAttachments.length;

    return (
      <div className="mt-2">
        {imageCount === 1 ? (
          // 单张图片 - 显示较大
          <div className="relative group cursor-pointer rounded-lg overflow-hidden max-w-md">
            <img
              src={imageAttachments[0].thumbnailUrl || imageAttachments[0].filePath}
              alt={imageAttachments[0].fileName}
              className="w-full h-auto object-cover hover:opacity-90 transition-opacity"
              style={{ maxHeight: '400px' }}
              onClick={() => setSelectedImageIndex(0)}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
          </div>
        ) : imageCount === 2 ? (
          // 两张图片 - 水平排列
          <div className="grid grid-cols-2 gap-2">
            {imageAttachments.map((attachment) => (
              <div
                key={attachment.id}
                className="relative group cursor-pointer rounded-lg overflow-hidden"
                onClick={() => {
                  const index = imageAttachments.findIndex(att => att.id === attachment.id);
                  if (index !== -1) {
                    setSelectedImageIndex(index);
                  }
                }}
              >
                <img
                  src={attachment.thumbnailUrl || attachment.filePath}
                  alt={attachment.fileName}
                  className="w-full h-auto object-cover hover:opacity-90 transition-opacity"
                  style={{ aspectRatio: '1', maxHeight: '200px' }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
              </div>
            ))}
          </div>
        ) : imageCount === 3 ? (
          // 三张图片 - 第一个占一半，剩下两个在右边
          <div className="grid grid-cols-2 gap-2">
            <div
              className="relative group cursor-pointer rounded-lg overflow-hidden row-span-2"
              onClick={() => setSelectedImageIndex(0)}
            >
              <img
                src={imageAttachments[0].thumbnailUrl || imageAttachments[0].filePath}
                alt={imageAttachments[0].fileName}
                className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                style={{ aspectRatio: '1', maxHeight: '400px' }}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
            </div>
            {imageAttachments.slice(1, 3).map((attachment) => (
              <div
                key={attachment.id}
                className="relative group cursor-pointer rounded-lg overflow-hidden"
                onClick={() => {
                  const index = imageAttachments.findIndex(att => att.id === attachment.id);
                  if (index !== -1) {
                    setSelectedImageIndex(index);
                  }
                }}
              >
                <img
                  src={attachment.thumbnailUrl || attachment.filePath}
                  alt={attachment.fileName}
                  className="w-full h-auto object-cover hover:opacity-90 transition-opacity"
                  style={{ aspectRatio: '1' }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
              </div>
            ))}
          </div>
        ) : imageCount === 4 ? (
          // 四张图片 - 2x2 网格
          <div className="grid grid-cols-2 gap-2">
            {imageAttachments.map((attachment) => (
              <div
                key={attachment.id}
                className="relative group cursor-pointer rounded-lg overflow-hidden"
                onClick={() => {
                  const index = imageAttachments.findIndex(att => att.id === attachment.id);
                  if (index !== -1) {
                    setSelectedImageIndex(index);
                  }
                }}
              >
                <img
                  src={attachment.thumbnailUrl || attachment.filePath}
                  alt={attachment.fileName}
                  className="w-full h-auto object-cover hover:opacity-90 transition-opacity"
                  style={{ aspectRatio: '1' }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
              </div>
            ))}
          </div>
        ) : (
          // 超过四张图片 - 显示前四张，其余显示计数
          <div className="grid grid-cols-2 gap-2">
            {imageAttachments.slice(0, 4).map((attachment, index) => (
              <div
                key={attachment.id}
                className="relative group cursor-pointer rounded-lg overflow-hidden"
                onClick={() => {
                  const index = imageAttachments.findIndex(att => att.id === attachment.id);
                  if (index !== -1) {
                    setSelectedImageIndex(index);
                  }
                }}
              >
                <img
                  src={attachment.thumbnailUrl || attachment.filePath}
                  alt={attachment.fileName}
                  className="w-full h-auto object-cover hover:opacity-90 transition-opacity"
                  style={{ aspectRatio: '1' }}
                />
                {index === 3 && imageCount > 4 && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                    <span className="text-white text-2xl font-bold">+{imageCount - 4}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // 检查是否有内容或附件
  const hasContent = message.content && message.content.trim() !== '';
  const hasAttachments = message.attachments && message.attachments.length > 0;

  // 如果既没有内容也没有附件，返回 null（这种情况不应该发生，但为了安全起见）
  if (!hasContent && !hasAttachments) {
    return null;
  }

  return (
    <div className={className}>
      <div className="text-sm whitespace-pre-wrap break-words flex flex-wrap items-center">
        {renderMessageContent()}
      </div>

      {/* 渲染图片附件 */}
      {renderAttachments()}

      {/* 如果被提及，显示提示标识 */}
      {isMentioned && (
        <div className="mt-1 text-xs text-blue-400 font-medium flex items-center gap-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-3 h-3"
          >
            <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm-1-6h2v-2h-2v2zm0-4h2V7h-2v3z"/>
          </svg>
          你被提及了
        </div>
      )}

      {/* 图片模态框 */}
      {selectedImage && (
        <ImageModal
          src={selectedImage.src}
          alt={selectedImage.alt}
          currentIndex={selectedImageIndex!}
          totalImages={imageAttachments.length}
          onPrevious={goToPreviousImage}
          onNext={goToNextImage}
          onClose={closeImagePreview}
        />
      )}
    </div>
  );
}
