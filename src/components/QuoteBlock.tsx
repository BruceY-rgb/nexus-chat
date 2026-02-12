'use client';

import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface QuoteBlockProps {
  content: string;
  userName: string;
  avatarUrl?: string | null;
  createdAt: string;
  isDeleted?: boolean;
  onRemove?: () => void;
  showRemoveButton?: boolean;
}

export default function QuoteBlock({
  content,
  userName,
  avatarUrl,
  createdAt,
  isDeleted = false,
  onRemove,
  showRemoveButton = false
}: QuoteBlockProps) {
  // Format timestamp
  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return '';
    }
  };

  // Truncate content to max 3 lines
  const truncatedContent = content.length > 200 ? content.substring(0, 200) + '...' : content;

  return (
    <div className="relative mb-2 rounded-md bg-[#2A2A2D] border-l-[3px] border-[#4A4A4D] overflow-hidden">
      {/* Quote indicator bar */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#4A4A4D]" />

      <div className="pl-3 pr-8 py-2">
        {isDeleted ? (
          // Deleted message placeholder
          <div className="flex items-center gap-2 text-gray-400">
            <AlertTriangle size={14} />
            <span className="text-sm">Original message unavailable</span>
          </div>
        ) : (
          // Normal quote content
          <>
            {/* Header: avatar, name, time */}
            <div className="flex items-center gap-2 mb-1">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={userName}
                  className="w-5 h-5 rounded-full object-cover"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-[#4A4A4D] flex items-center justify-center">
                  <span className="text-[10px] text-gray-300">
                    {userName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <span className="text-sm font-medium text-gray-300">{userName}</span>
              <span className="text-xs text-gray-500">·</span>
              <span className="text-xs text-gray-500">{formatTime(createdAt)}</span>
            </div>

            {/* Content */}
            <div className="text-sm text-gray-300 line-clamp-3 leading-relaxed">
              {truncatedContent}
            </div>
          </>
        )}
      </div>

      {/* Remove button */}
      {showRemoveButton && onRemove && !isDeleted && (
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 p-1 rounded hover:bg-[#3A3A3D] transition-colors opacity-0 group-hover:opacity-100"
          title="Remove quote"
        >
          <X size={14} className="text-gray-400 hover:text-white" />
        </button>
      )}
    </div>
  );
}
