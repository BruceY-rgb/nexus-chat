'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Message } from '@/types/message';
import { TeamMember } from '@/types';
import MentionToken from './MentionToken';
import AttachmentCard from './AttachmentCard';
import MarkdownRenderer from './MarkdownRenderer';
import { MarkdownProcessor } from '@/lib/markdown';
import { convertShortcodesToEmoji } from '@/lib/emoji';
import { X } from 'lucide-react';
import ImageGallery from './ImageGallery';

interface MessageRendererProps {
  message: Message;
  currentUserId: string;
  className?: string;
  members?: { id: string; displayName: string }[];
  markdownVariant?: 'dark' | 'light';
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
  // Handle keyboard events
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
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors z-10"
        >
          <X size={32} />
        </button>

        {/* Previous image button */}
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

        {/* Image */}
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-full object-contain rounded-lg"
          onClick={(e) => e.stopPropagation()}
        />

        {/* Next image button */}
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

        {/* Image index indicator */}
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
 * Helper to get the correct file URL
 */
function getFileUrl(attachment: { thumbnailUrl?: string | null; filePath: string }): string {
  if (attachment.thumbnailUrl) {
    return attachment.thumbnailUrl;
  }
  return attachment.filePath;
}

/**
 * Highlight @mentions in message content
 * Supports tokenized mentions and traditional text mentions
 */
export default function MessageRenderer({
  message,
  currentUserId,
  className = '',
  members = [],
  markdownVariant = 'dark'
}: MessageRendererProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  // Extract mentioned users from message's mentions field
  const mentionedUsers: MentionedUser[] = message.mentions?.map(m => ({
    id: m.mentionedUser.id,
    displayName: m.mentionedUser.displayName
  })) || [];

  // Check if current user is mentioned
  const isMentioned = mentionedUsers.some(user => user.id === currentUserId);

  // Get currently selected image
  const imageAttachments = message.attachments?.filter(att => att.mimeType.startsWith('image/')) || [];
  const selectedImage = selectedImageIndex !== null ? {
    src: getFileUrl(imageAttachments[selectedImageIndex]),
    alt: imageAttachments[selectedImageIndex].fileName
  } : null;

  // Smart detection of whether to use Markdown rendering
  const shouldUseMarkdown = useMemo(() => {
    return MarkdownProcessor.shouldUseMarkdown(message.content || '');
  }, [message.content]);

  // Navigate to previous image
  const goToPreviousImage = () => {
    if (selectedImageIndex !== null && selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1);
    }
  };

  // Navigate to next image
  const goToNextImage = () => {
    if (selectedImageIndex !== null && selectedImageIndex < imageAttachments.length - 1) {
      setSelectedImageIndex(selectedImageIndex + 1);
    }
  };

  // Close preview
  const closeImagePreview = () => {
    setSelectedImageIndex(null);
  };

  /**
   * Render message content, supports tokenized mentions and Emoji optimization
   * Use matchAll instead of split to avoid duplicate rendering issues
   */
  const renderMessageContent = () => {
    if (!message.content) {
      return null;
    }

    // Token mode: /@\{([^:]+):([^}]+)\}/g
    const tokenPattern = /@\{([^:]+):([^}]+)\}/g;
    const matches = [...message.content.matchAll(tokenPattern)];
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    matches.forEach((match, matchIndex) => {
      const matchStart = match.index!;
      const matchEnd = matchStart + match[0].length;

      // Add normal text before match
      if (matchStart > lastIndex) {
        const beforeText = message.content.slice(lastIndex, matchStart);
        // Render normal text (including Emoji optimization)
        elements.push(
          <EmojiText key={`text-${matchIndex}`} text={beforeText} />
        );
      }

      // Extract Token info
      const userId = match[1];
      const displayName = match[2];

      // Find member info
      const member = members.find(m => m.id === userId);
      const actualDisplayName = member?.displayName || displayName;

      // Add MentionToken component
      elements.push(
        <MentionToken
          key={`mention-${matchIndex}`}
          userId={userId}
          displayName={actualDisplayName}
          isCurrentUserMentioned={userId === currentUserId}
          onRemove={() => {}} // Cannot remove in message
          isEditing={false}
        />
      );

      lastIndex = matchEnd;
    });

    // Add remaining text
    if (lastIndex < message.content.length) {
      const remainingText = message.content.slice(lastIndex);
      elements.push(
        <EmojiText key={`text-${matches.length}`} text={remainingText} />
      );
    }

    // Return all elements
    return elements;
  };

  /**
   * Emoji text rendering component
   * Supports Jumboji effect (pure Emoji messages displayed in large size)
   * And medium size Emoji in mixed text
   */
  const EmojiText = ({ text }: { text: string }) => {
    // Convert Slack :shortcode: to Unicode emoji first
    const convertedText = convertShortcodesToEmoji(text);

    // Match various Unicode range Emoji characters
    // Includes: Basic Multilingual Plane, Supplementary Multilingual Plane, Miscellaneous Symbols, Emoticons etc.
    const emojiRegex = /(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji})/gu;

    // Check if it's pure Emoji text (after removing spaces and newlines)
    const isPureEmoji = convertedText.replace(/\s/g, '').match(/^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji})+$/u);

    if (isPureEmoji) {
      // Pure Emoji message: unified 14px font size
      return (
        <span style={{ fontSize: '14px', lineHeight: '1.5' }}>
          {convertedText}
        </span>
      );
    }

    // Mixed text: split by character and render
    const parts = [...convertedText];

    return (
      <>
        {parts.map((char, index) => {
          const isEmoji = emojiRegex.test(char);
          if (isEmoji) {
            // Reset regex state
            emojiRegex.lastIndex = 0;
            // Emoji character: unified 14px font size
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
          // Normal text character: unified 14px font size
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
   * Render attachments - supports images and other file types
   */
  const renderAttachments = () => {
    if (!message.attachments || message.attachments.length === 0) {
      return null;
    }

    // Separate image attachments and other attachments
    const imageAttachments = message.attachments.filter(att => att.mimeType.startsWith('image/'));
    const otherAttachments = message.attachments.filter(att => !att.mimeType.startsWith('image/'));

    // Use ImageGallery component for image rendering
    const handleImageClick = useCallback((index: number) => {
      setSelectedImageIndex(index);
    }, []);

    return (
      <div className="mt-2">
        {/* Render image attachments - using ImageGallery component */}
        {imageAttachments.length > 0 && (
          <div className="mb-2">
            <ImageGallery
              attachments={imageAttachments}
              onImageClick={handleImageClick}
              getFileUrl={getFileUrl}
            />
          </div>
        )}

        {/* Render other attachment types - using AttachmentCard */}
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

  // Check if there is content or attachments
  const hasContent = message.content && message.content.trim() !== '';
  const hasAttachments = message.attachments && message.attachments.length > 0;

  // If neither content nor attachments, return null (shouldn't happen, but for safety)
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
            variant={markdownVariant}
          />
        ) : (
          renderMessageContent()
        )}
      </div>

      {/* Render image attachments */}
      {renderAttachments()}

      {/* If mentioned, show hint indicator */}
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

      {/* Image modal */}
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
