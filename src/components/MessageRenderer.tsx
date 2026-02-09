'use client';

import React, { useState, useMemo } from 'react';
import { Message } from '@/types/message';
import { TeamMember } from '@/types';
import MentionToken from './MentionToken';
import AttachmentCard from './AttachmentCard';
import MarkdownRenderer from './MarkdownRenderer';
import { MarkdownProcessor } from '@/lib/markdown';
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

  // 智能检测是否使用Markdown渲染
  const shouldUseMarkdown = useMemo(() => {
    return MarkdownProcessor.shouldUseMarkdown(message.content || '');
  }, [message.content]);

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
   * 渲染消息内容，支持 Token 化提及和 Emoji 优化
   * 使用 matchAll 替代 split 避免重复渲染问题
   */
  const renderMessageContent = () => {
    if (!message.content) {
      return null;
    }

    // Token 模式：/@\{([^:]+):([^}]+)\}/g
    const tokenPattern = /@\{([^:]+):([^}]+)\}/g;
    const matches = [...message.content.matchAll(tokenPattern)];
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    matches.forEach((match, matchIndex) => {
      const matchStart = match.index!;
      const matchEnd = matchStart + match[0].length;

      // 添加匹配前的普通文本
      if (matchStart > lastIndex) {
        const beforeText = message.content.slice(lastIndex, matchStart);
        // 渲染普通文本（包含 Emoji 优化）
        elements.push(
          <EmojiText key={`text-${matchIndex}`} text={beforeText} />
        );
      }

      // 提取 Token 信息
      const userId = match[1];
      const displayName = match[2];

      // 查找成员信息
      const member = members.find(m => m.id === userId);
      const actualDisplayName = member?.displayName || displayName;

      // 添加 MentionToken 组件
      elements.push(
        <MentionToken
          key={`mention-${matchIndex}`}
          userId={userId}
          displayName={actualDisplayName}
          isCurrentUserMentioned={userId === currentUserId}
          onRemove={() => {}} // 消息中不可删除
          isEditing={false}
        />
      );

      lastIndex = matchEnd;
    });

    // 添加最后剩余的文本
    if (lastIndex < message.content.length) {
      const remainingText = message.content.slice(lastIndex);
      elements.push(
        <EmojiText key={`text-${matches.length}`} text={remainingText} />
      );
    }

    // 返回所有元素
    return elements;
  };

  /**
   * Emoji 文本渲染组件
   * 支持 Jumboji 效果（纯 Emoji 消息大尺寸显示）
   * 和混合文本中的中等尺寸 Emoji
   */
  const EmojiText = ({ text }: { text: string }) => {
    // 匹配各种 Unicode 范围的 Emoji 字符
    // 包括：基本多语言平面、补充多语言平面、杂项符号、表情符号等
    const emojiRegex = /(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji})/gu;

    // 检查是否是纯 Emoji 文本（去除空格和换行后）
    const isPureEmoji = text.replace(/\s/g, '').match(/^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji})+$/u);

    if (isPureEmoji) {
      // 纯 Emoji 消息：统一14px字体大小
      return (
        <span style={{ fontSize: '14px', lineHeight: '1.5' }}>
          {text}
        </span>
      );
    }

    // 混合文本：按字符分割并渲染
    const parts = [...text];

    return (
      <>
        {parts.map((char, index) => {
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
                  lineHeight: '1.5'
                }}
              >
                {char}
              </span>
            );
          }
          // 普通文本字符：统一14px字体大小
          return (
            <span key={index} style={{ fontSize: '14px', lineHeight: '1.5' }}>
              {char}
            </span>
          );
        })}
      </>
    );
  };

  /**
   * 渲染附件 - 支持图片和其他类型文件
   */
  const renderAttachments = () => {
    if (!message.attachments || message.attachments.length === 0) {
      return null;
    }

    // 分离图片附件和其他附件
    const imageAttachments = message.attachments.filter(att => att.mimeType.startsWith('image/'));
    const otherAttachments = message.attachments.filter(att => !att.mimeType.startsWith('image/'));

    return (
      <div className="mt-2">
        {/* 渲染图片附件 - 使用原有布局 */}
        {imageAttachments.length > 0 && (
          <div className="mb-2">
            {(() => {
              const imageCount = imageAttachments.length;

              if (imageCount === 1) {
                // 单张图片 - 显示较大
                return (
                  <div className="relative group cursor-pointer rounded-lg overflow-hidden max-w-md">
                    <img
                      src={imageAttachments[0].thumbnailUrl || imageAttachments[0].filePath}
                      alt={imageAttachments[0].fileName}
                      className="w-full h-auto object-cover hover:opacity-90 transition-opacity"
                      style={{ maxHeight: '400px' }}
                      onClick={() => setSelectedImageIndex(0)}
                      onError={(e) => {
                        // 图片加载失败时显示错误占位符
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = `
                            <div class="w-full h-48 bg-gray-800 flex flex-col items-center justify-center rounded-lg">
                              <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span class="text-gray-400 text-sm">Image loading failed</span>
                              <button onclick="window.open('${imageAttachments[0].filePath}', '_blank')" class="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                                Open in new tab
                              </button>
                            </div>
                          `;
                        }
                      }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                  </div>
                );
              } else if (imageCount === 2) {
                // 两张图片 - 水平排列
                return (
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
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = `
                                <div class="w-full h-32 bg-gray-800 flex flex-col items-center justify-center rounded-lg">
                                  <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-gray-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span class="text-gray-400 text-xs">Loading failed</span>
                                </div>
                              `;
                            }
                          }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                      </div>
                    ))}
                  </div>
                );
              } else if (imageCount === 3) {
                // 三张图片 - 第一个占一半，剩下两个在右边
                return (
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
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = `
                                <div class="w-full h-32 bg-gray-800 flex flex-col items-center justify-center rounded-lg">
                                  <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-gray-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span class="text-gray-400 text-xs">Loading failed</span>
                                </div>
                              `;
                            }
                          }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                      </div>
                    ))}
                  </div>
                );
              } else if (imageCount === 4) {
                // 四张图片 - 2x2 网格
                return (
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
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = `
                                <div class="w-full h-32 bg-gray-800 flex flex-col items-center justify-center rounded-lg">
                                  <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-gray-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span class="text-gray-400 text-xs">Loading failed</span>
                                </div>
                              `;
                            }
                          }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                      </div>
                    ))}
                  </div>
                );
              } else {
                // 超过四张图片 - 显示前四张，其余显示计数
                return (
                  <div className="grid grid-cols-2 gap-2">
                    {imageAttachments.slice(0, 4).map((attachment, imgIndex) => (
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
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = `
                                <div class="w-full h-32 bg-gray-800 flex flex-col items-center justify-center rounded-lg">
                                  <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-gray-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span class="text-gray-400 text-xs">Loading failed</span>
                                </div>
                              `;
                            }
                          }}
                        />
                        {imgIndex === 3 && imageCount > 4 && (
                          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                            <span className="text-white text-2xl font-bold">+{imageCount - 4}</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                      </div>
                    ))}
                  </div>
                );
              }
            })()}
          </div>
        )}

        {/* 渲染其他类型附件 - 使用 AttachmentCard */}
        {otherAttachments.length > 0 && (
          <div className="space-y-2">
            {otherAttachments.map((attachment) => (
              <AttachmentCard key={attachment.id} attachment={attachment} />
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
        {shouldUseMarkdown ? (
          <MarkdownRenderer
            content={message.content || ''}
            members={members as TeamMember[]}
            currentUserId={currentUserId}
            className="text-sm"
          />
        ) : (
          renderMessageContent()
        )}
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
          You were mentioned
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
