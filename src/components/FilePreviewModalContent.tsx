'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Attachment } from '@/types/message';
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize,
  Minimize,
  RotateCcw,
  Move3D,
  AlertCircle,
  Loader2
} from 'lucide-react';

// Helper to get the correct file URL
function getFileUrl(attachment: Attachment): string {
  if (attachment.thumbnailUrl) {
    return attachment.thumbnailUrl;
  }
  return attachment.filePath;
}

interface FilePreviewContentProps {
  attachment: Attachment;
  onClose: () => void;
}

// Internal component - handles actual preview logic
export default function FilePreviewModalContent({ attachment, onClose }: FilePreviewContentProps) {
  // All Hooks
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState(false);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string>('');
  const [loadingText, setLoadingText] = useState(false);
  const [fileUrlError, setFileUrlError] = useState(false);

  // Refs
  const iframeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // File type detection
  const isImage = attachment.mimeType.startsWith('image/');
  const isPDF = attachment.mimeType === 'application/pdf';
  const isText = attachment.mimeType.startsWith('text/');
  const isOfficeDoc = /\.(docx|doc|xlsx|xls|pptx|ppt)$/i.test(attachment.fileName);
  const isVideo = attachment.mimeType.startsWith('video/');

  // Check file URL accessibility
  useEffect(() => {
    const checkFileUrl = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        // Use proxy URL to bypass CORS
        const proxyUrl = getFileUrl(attachment);

        const response = await fetch(proxyUrl, {
          method: 'HEAD',
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          setFileUrlError(true);
        }
      } catch (error) {
        console.error('File URL check failed:', error);
        setFileUrlError(true);
      }
    };

    checkFileUrl();
  }, [attachment]);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        setScale(s => Math.min(s + 0.1, 3));
      } else if (e.key === '-') {
        e.preventDefault();
        setScale(s => Math.max(s - 0.1, 0.5));
      } else if (e.key === '0') {
        e.preventDefault();
        setScale(1);
        setPosition({ x: 0, y: 0 });
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setIsFullscreen(!isFullscreen);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isFullscreen]);

  // Reset state (when attachment changes)
  useEffect(() => {
    setPreviewLoading(true);
    setPreviewError(false);
    setFileUrlError(false);
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setIframeSrc(null);
    // Clear previous timeout
    if (iframeTimeoutRef.current) {
      clearTimeout(iframeTimeoutRef.current);
      iframeTimeoutRef.current = null;
    }
  }, [attachment]);

  // Delayed iframe src setup - fix PDF preview
  useEffect(() => {
    if (attachment && (isPDF || isOfficeDoc)) {
      const timer = setTimeout(() => {
        // Use proxy URL for CORS bypass
        let src = getFileUrl(attachment);

        // Add inline parameter for PDF, force inline display
        if (isPDF) {
          const separator = src.includes('?') ? '&' : '?';
          src = `${src}${separator}response-content-disposition=inline`;
        }

        // Office document preview - needs original file URL
        if (isOfficeDoc) {
          src = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(getFileUrl(attachment))}`;
        }

        setIframeSrc(src);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [attachment, isPDF, isOfficeDoc]);

  // Text file content loading
  useEffect(() => {
    if (attachment && isText) {
      setLoadingText(true);
      fetch(getFileUrl(attachment))
        .then(response => response.text())
        .then(content => {
          setTextContent(content);
          setLoadingText(false);
        })
        .catch(error => {
          console.error('Error loading text:', error);
          setLoadingText(false);
        });
    }
  }, [attachment, isText]);

  // Utility functions
  const formatFileSize = (sizeStr: string) => {
    const bytes = Number(sizeStr);
    const mb = bytes / 1024 / 1024;
    if (mb < 1) {
      const kb = bytes / 1024;
      return `${kb.toFixed(1)} KB`;
    }
    return `${mb.toFixed(2)} MB`;
  };

  const handleDownload = () => {
    if (fileUrlError) {
      alert('Document URL is not accessible.');
      return;
    }

    const link = document.createElement('a');
    link.href = getFileUrl(attachment);
    link.download = attachment.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleZoomIn = () => {
    setScale(s => Math.min(s + 0.1, 3));
  };

  const handleZoomOut = () => {
    setScale(s => Math.max(s - 0.1, 0.5));
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (isImage) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      setScale(s => Math.max(0.5, Math.min(3, s + delta)));
    }
  };

  const handleIframeLoad = () => {
    // Clear timeout timer
    if (iframeTimeoutRef.current) {
      clearTimeout(iframeTimeoutRef.current);
      iframeTimeoutRef.current = null;
    }
    setPreviewLoading(false);
    setPreviewError(false);
  };

  const handleIframeError = () => {
    // Clear timeout timer
    if (iframeTimeoutRef.current) {
      clearTimeout(iframeTimeoutRef.current);
      iframeTimeoutRef.current = null;
    }
    setPreviewLoading(false);
    setPreviewError(true);
  };

  // Set iframe timeout detection
  useEffect(() => {
    if ((isPDF || isOfficeDoc) && iframeSrc && !previewError) {
      // Set 10 second timeout
      iframeTimeoutRef.current = setTimeout(() => {
        setPreviewLoading(false);
        setPreviewError(true);
        console.warn('Iframe load timeout after 10 seconds');
      }, 10000);
    }

    // Cleanup function
    return () => {
      if (iframeTimeoutRef.current) {
        clearTimeout(iframeTimeoutRef.current);
        iframeTimeoutRef.current = null;
      }
    };
  }, [iframeSrc, isPDF, isOfficeDoc, previewError]);

  const handleImageLoad = () => {
    setPreviewLoading(false);
    setPreviewError(false);
  };

  const handleImageError = () => {
    setPreviewLoading(false);
    setPreviewError(true);
  };

  // Render
  return (
    <div
      className={`fixed inset-0 bg-black/80 flex items-center justify-center z-50 ${isFullscreen ? 'p-0' : 'p-4'}`}
      onClick={onClose}
    >
      <div
        className={`relative bg-[#2A2A2D] rounded-lg w-full ${isFullscreen ? 'h-full' : 'max-w-4xl max-h-[90vh]'} overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between p-4 border-b border-[#3A3A3D]">
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-medium truncate">
              {attachment.fileName}
            </h3>
            <p className="text-white/60 text-sm">
              {formatFileSize(attachment.fileSize)} • Zoom: {(scale * 100).toFixed(0)}%
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            {/* Image-specific toolbar */}
            {isImage && (
              <>
                <button
                  onClick={handleZoomOut}
                  className="p-2 hover:bg-[#3A3A3D] rounded transition-colors"
                  title="Zoom out (-)"
                >
                  <ZoomOut size={18} className="text-white/60" />
                </button>
                <button
                  onClick={handleReset}
                  className="p-2 hover:bg-[#3A3A3D] rounded transition-colors"
                  title="Reset (0)"
                >
                  <RotateCcw size={18} className="text-white/60" />
                </button>
                <button
                  onClick={handleZoomIn}
                  className="p-2 hover:bg-[#3A3A3D] rounded transition-colors"
                  title="Zoom in (+)"
                >
                  <ZoomIn size={18} className="text-white/60" />
                </button>
                <div className="w-px h-6 bg-[#3A3A3D] mx-1" />
              </>
            )}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 hover:bg-[#3A3A3D] rounded transition-colors"
              title="Fullscreen (F)"
            >
              {isFullscreen ? <Minimize size={18} className="text-white/60" /> : <Maximize size={18} className="text-white/60" />}
            </button>
            <div className="w-px h-6 bg-[#3A3A3D] mx-1" />
            <button
              onClick={handleDownload}
              className="p-2 hover:bg-[#3A3A3D] rounded transition-colors"
              title="Download"
            >
              <Download size={18} className="text-white/60" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#3A3A3D] rounded transition-colors"
              title="Close (ESC)"
            >
              <X size={18} className="text-white/60" />
            </button>
          </div>
        </div>

        {/* File URL error message */}
        {fileUrlError && (
          <div className="p-4 bg-red-500/20 border-b border-red-500/30">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle size={18} />
              <span className="text-sm">File URL is not accessible. Please check your network connection or if the file has been deleted.</span>
            </div>
          </div>
        )}

        {/* Preview content area */}
        <div
          className="flex-1 overflow-hidden bg-[#1A1A1D] relative"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {isImage ? (
            // Image preview
            <div className="w-full h-full flex items-center justify-center overflow-hidden relative">
              {previewLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#1A1A1D] z-10">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 size={32} className="text-white/60 animate-spin" />
                    <div className="text-white/60 text-sm">Loading...</div>
                  </div>
                </div>
              )}
              {previewError && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#1A1A1D] z-10">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle size={32} className="text-red-400" />
                    <div className="text-white/60 text-sm">Failed to load image</div>
                    <button
                      onClick={handleDownload}
                      className="px-4 py-2 bg-[#1164A3] text-white rounded hover:bg-[#0D4A7C] transition-colors text-sm"
                    >
                      Download to view
                    </button>
                  </div>
                </div>
              )}
              <img
                src={getFileUrl(attachment)}
                alt={attachment.fileName}
                className={`max-w-none transition-transform duration-200 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} ${previewLoading || previewError ? 'opacity-0' : 'opacity-100'}`}
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                  transformOrigin: 'center',
                }}
                onMouseDown={handleMouseDown}
                onLoad={handleImageLoad}
                onError={handleImageError}
                draggable={false}
              />
              {scale > 1 && !previewError && (
                <div className="absolute bottom-4 left-4 bg-black/70 text-white px-3 py-2 rounded text-sm flex items-center gap-2">
                  <Move3D size={16} />
                  Drag to move
                </div>
              )}
            </div>
          ) : isPDF ? (
            // PDF preview - add timeout detection
            <div className="w-full h-full relative">
              {previewLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#1A1A1D] z-10">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 size={32} className="text-white/60 animate-spin" />
                    <div className="text-white/60 text-sm">Loading PDF... (up to 10 seconds)</div>
                  </div>
                </div>
              )}
              {previewError && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#1A1A1D] z-10">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle size={32} className="text-red-400" />
                    <div className="text-white/60 text-sm mb-4">PDF preview failed or timed out</div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDownload}
                        className="px-4 py-2 bg-[#1164A3] text-white rounded hover:bg-[#0D4A7C] transition-colors text-sm"
                      >
                        Download to view
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <iframe
                src={getFileUrl(attachment)}
                className={`w-full h-full border-0 ${previewLoading || previewError ? 'opacity-0' : 'opacity-100'}`}
                title={`${attachment.fileName} - PDF Preview`}
                onLoad={handleIframeLoad}
                onError={handleIframeError}
              />
            </div>
          ) : isVideo ? (
            // Video preview
            <div className="w-full h-full flex items-center justify-center bg-black">
              <video
                src={getFileUrl(attachment)}
                controls
                autoPlay
                className="max-w-full max-h-full"
                title={attachment.fileName}
              >
                Your browser does not support video playback
              </video>
            </div>
          ) : isText ? (
            // Text preview - fix scroll issue
            <div className="w-full h-full overflow-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
              {(loadingText || previewLoading) ? (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 size={32} className="text-white/60 animate-spin" />
                    <div className="text-white/60 text-sm">Loading text content...</div>
                  </div>
                </div>
              ) : previewError ? (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle size={32} className="text-red-400" />
                    <div className="text-white/60 text-sm">Failed to load text</div>
                    <button
                      onClick={handleDownload}
                      className="px-4 py-2 bg-[#1164A3] text-white rounded hover:bg-[#0D4A7C] transition-colors text-sm"
                    >
                      Download to view
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6">
                  <pre className="text-sm text-white/90 whitespace-pre-wrap break-words font-mono" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
                    <code>{textContent || 'Unable to load file content'}</code>
                  </pre>
                </div>
              )}
            </div>
          ) : isOfficeDoc ? (
            // Office document preview - add timeout detection
            <div className="w-full h-full relative">
              {previewLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#1A1A1D] z-10">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 size={32} className="text-white/60 animate-spin" />
                    <div className="text-white/60 text-sm">Loading Office preview... (up to 10 seconds)</div>
                  </div>
                </div>
              )}
              {previewError && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#1A1A1D] z-10">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle size={32} className="text-red-400" />
                    <div className="text-white/60 text-sm">Office preview failed or timed out</div>
                    <button
                      onClick={handleDownload}
                      className="px-4 py-2 bg-[#1164A3] text-white rounded hover:bg-[#0D4A7C] transition-colors text-sm"
                    >
                      Download to view
                    </button>
                  </div>
                </div>
              )}
              <iframe
                src={iframeSrc || ''}
                className={`w-full h-full border-0 ${previewLoading || previewError ? 'opacity-0' : 'opacity-100'}`}
                title={`${attachment.fileName} - Office Online Preview`}
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                referrerPolicy="no-referrer"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
              />
            </div>
          ) : (
            // Unsupported preview files
            <div className="w-full h-full flex flex-col items-center justify-center text-white/60">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mb-4">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeWidth="2"/>
                <polyline points="14 2 14 8 20 8" strokeWidth="2"/>
                <line x1="16" y1="13" x2="8" y2="13" strokeWidth="2"/>
                <line x1="16" y1="17" x2="8" y2="17" strokeWidth="2"/>
                <polyline points="10 9 9 9 8 9" strokeWidth="2"/>
              </svg>
              <p className="text-center mb-4">This file type is not supported for preview</p>
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-[#1164A3] text-white rounded hover:bg-[#0D4A7C] transition-colors"
              >
                Download file
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
