'use client';

import React, { useState, useCallback } from 'react';

interface Attachment {
  id: string;
  fileName: string;
  filePath: string;
  thumbnailUrl?: string | null;
  mimeType: string;
}

interface ImageGalleryProps {
  attachments: Attachment[];
  onImageClick: (index: number) => void;
  getFileUrl: (attachment: Attachment) => string;
}

/**
 * Image gallery component - handles all image count layouts (1-4+ images)
 * Uses React state for error handling instead of DOM manipulation
 */
export function ImageGallery({ attachments, onImageClick, getFileUrl }: ImageGalleryProps) {
  const imageCount = attachments.length;

  if (imageCount === 1) {
    return renderSingleImage(attachments, onImageClick, getFileUrl);
  } else if (imageCount === 2) {
    return renderTwoImages(attachments, onImageClick, getFileUrl);
  } else if (imageCount === 3) {
    return renderThreeImages(attachments, onImageClick, getFileUrl);
  } else {
    return renderFourOrMoreImages(attachments, onImageClick, getFileUrl);
  }
}

function ImageWithErrorFallback({
  attachment,
  onClick,
  getFileUrl,
  className,
  style
}: {
  attachment: Attachment;
  onClick?: () => void;
  getFileUrl: (attachment: Attachment) => string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [hasError, setHasError] = useState(false);
  const src = getFileUrl(attachment);

  if (hasError) {
    return (
      <div
        className="w-full h-48 bg-gray-800 flex flex-col items-center justify-center rounded-lg cursor-pointer"
        onClick={() => window.open(attachment.filePath, '_blank')}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-12 h-12 text-gray-400 mb-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <span className="text-gray-400 text-sm">Image loading failed</span>
        <button className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
          Open in new tab
        </button>
      </div>
    );
  }

  return (
    <div className="relative group cursor-pointer rounded-lg overflow-hidden" onClick={onClick}>
      <img
        src={src}
        alt={attachment.fileName}
        className={`w-full h-auto object-cover hover:opacity-90 transition-opacity ${className || ''}`}
        style={style}
        onError={() => setHasError(true)}
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
    </div>
  );
}

function renderSingleImage(
  attachments: Attachment[],
  onImageClick: (index: number) => void,
  getFileUrl: (attachment: Attachment) => string
) {
  return (
    <div className="relative group cursor-pointer rounded-lg overflow-hidden max-w-md">
      <ImageWithErrorFallback
        attachment={attachments[0]}
        onClick={() => onImageClick(0)}
        getFileUrl={getFileUrl}
        style={{ maxHeight: '400px' }}
      />
    </div>
  );
}

function renderTwoImages(
  attachments: Attachment[],
  onImageClick: (index: number) => void,
  getFileUrl: (attachment: Attachment) => string
) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {attachments.map((attachment, idx) => (
        <ImageWithErrorFallback
          key={attachment.id}
          attachment={attachment}
          onClick={() => onImageClick(idx)}
          getFileUrl={getFileUrl}
          style={{ aspectRatio: '1', maxHeight: '200px' }}
        />
      ))}
    </div>
  );
}

function renderThreeImages(
  attachments: Attachment[],
  onImageClick: (index: number) => void,
  getFileUrl: (attachment: Attachment) => string
) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div
        className="relative group cursor-pointer rounded-lg overflow-hidden row-span-2"
        onClick={() => onImageClick(0)}
      >
        <ImageWithErrorFallback
          attachment={attachments[0]}
          onClick={() => onImageClick(0)}
          getFileUrl={getFileUrl}
          style={{ aspectRatio: '1', maxHeight: '400px' }}
        />
      </div>
      {attachments.slice(1, 3).map((attachment, idx) => (
        <ImageWithErrorFallback
          key={attachment.id}
          attachment={attachment}
          onClick={() => onImageClick(idx + 1)}
          getFileUrl={getFileUrl}
        />
      ))}
    </div>
  );
}

function renderFourOrMoreImages(
  attachments: Attachment[],
  onImageClick: (index: number) => void,
  getFileUrl: (attachment: Attachment) => string
) {
  const imageCount = attachments.length;

  return (
    <div className="grid grid-cols-2 gap-2">
      {attachments.slice(0, 4).map((attachment, imgIndex) => (
        <div key={attachment.id} className="relative">
          <ImageWithErrorFallback
            attachment={attachment}
            onClick={() => {
              const index = attachments.findIndex(att => att.id === attachment.id);
              if (index !== -1) onImageClick(index);
            }}
            getFileUrl={getFileUrl}
            style={{ aspectRatio: '1' }}
          />
          {imgIndex === 3 && imageCount > 4 && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
              <span className="text-white text-2xl font-bold">+{imageCount - 4}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default ImageGallery;
