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

interface FilePreviewContentProps {
  attachment: Attachment;
  onClose: () => void;
}

// 内部组件 - 处理实际的预览逻辑
export default function FilePreviewModalContent({ attachment, onClose }: FilePreviewContentProps) {
  // 所有 Hook
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

  // 文件类型检测
  const isImage = attachment.mimeType.startsWith('image/');
  const isPDF = attachment.mimeType === 'application/pdf';
  const isText = attachment.mimeType.startsWith('text/');
  const isOfficeDoc = /\.(docx|doc|xlsx|xls|pptx|ppt)$/i.test(attachment.fileName);

  // 检查文件URL可达性
  useEffect(() => {
    const checkFileUrl = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(attachment.filePath, {
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
  }, [attachment.filePath]);

  // 处理键盘事件
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

  // 重置状态（当 attachment 改变时）
  useEffect(() => {
    setPreviewLoading(true);
    setPreviewError(false);
    setFileUrlError(false);
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setIframeSrc(null);
    // 清除之前的超时
    if (iframeTimeoutRef.current) {
      clearTimeout(iframeTimeoutRef.current);
      iframeTimeoutRef.current = null;
    }
  }, [attachment]);

  // 延迟设置 iframe src - 修复 PDF 预览
  useEffect(() => {
    if (attachment && (isPDF || isOfficeDoc)) {
      const timer = setTimeout(() => {
        let src = attachment.filePath;

        // 为 PDF 添加 inline 参数，强制内联显示
        if (isPDF) {
          const separator = src.includes('?') ? '&' : '?';
          src = `${src}${separator}response-content-disposition=inline`;
        }

        // Office 文档预览
        if (isOfficeDoc) {
          src = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(attachment.filePath)}`;
        }

        setIframeSrc(src);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [attachment, isPDF, isOfficeDoc]);

  // 文本文件内容加载
  useEffect(() => {
    if (attachment && isText) {
      setLoadingText(true);
      fetch(attachment.filePath)
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

  // 工具函数
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
      alert('文件暂时无法访问，请稍后重试');
      return;
    }

    const link = document.createElement('a');
    link.href = attachment.filePath;
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
    // 清除超时定时器
    if (iframeTimeoutRef.current) {
      clearTimeout(iframeTimeoutRef.current);
      iframeTimeoutRef.current = null;
    }
    setPreviewLoading(false);
    setPreviewError(false);
  };

  const handleIframeError = () => {
    // 清除超时定时器
    if (iframeTimeoutRef.current) {
      clearTimeout(iframeTimeoutRef.current);
      iframeTimeoutRef.current = null;
    }
    setPreviewLoading(false);
    setPreviewError(true);
  };

  // 设置 iframe 超时检测
  useEffect(() => {
    if ((isPDF || isOfficeDoc) && iframeSrc && !previewError) {
      // 设置 10 秒超时
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

  // 渲染
  return (
    <div
      className={`fixed inset-0 bg-black/80 flex items-center justify-center z-50 ${isFullscreen ? 'p-0' : 'p-4'}`}
      onClick={onClose}
    >
      <div
        className={`relative bg-[#2A2A2D] rounded-lg w-full ${isFullscreen ? 'h-full' : 'max-w-4xl max-h-[90vh]'} overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 模态窗口头部 */}
        <div className="flex items-center justify-between p-4 border-b border-[#3A3A3D]">
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-medium truncate">
              {attachment.fileName}
            </h3>
            <p className="text-white/60 text-sm">
              {formatFileSize(attachment.fileSize)} • 缩放: {(scale * 100).toFixed(0)}%
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            {/* 图片专用工具栏 */}
            {isImage && (
              <>
                <button
                  onClick={handleZoomOut}
                  className="p-2 hover:bg-[#3A3A3D] rounded transition-colors"
                  title="缩小 (-)"
                >
                  <ZoomOut size={18} className="text-white/60" />
                </button>
                <button
                  onClick={handleReset}
                  className="p-2 hover:bg-[#3A3A3D] rounded transition-colors"
                  title="重置 (0)"
                >
                  <RotateCcw size={18} className="text-white/60" />
                </button>
                <button
                  onClick={handleZoomIn}
                  className="p-2 hover:bg-[#3A3A3D] rounded transition-colors"
                  title="放大 (+)"
                >
                  <ZoomIn size={18} className="text-white/60" />
                </button>
                <div className="w-px h-6 bg-[#3A3A3D] mx-1" />
              </>
            )}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 hover:bg-[#3A3A3D] rounded transition-colors"
              title="全屏 (F)"
            >
              {isFullscreen ? <Minimize size={18} className="text-white/60" /> : <Maximize size={18} className="text-white/60" />}
            </button>
            <div className="w-px h-6 bg-[#3A3A3D] mx-1" />
            <button
              onClick={handleDownload}
              className="p-2 hover:bg-[#3A3A3D] rounded transition-colors"
              title="下载"
            >
              <Download size={18} className="text-white/60" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#3A3A3D] rounded transition-colors"
              title="关闭 (ESC)"
            >
              <X size={18} className="text-white/60" />
            </button>
          </div>
        </div>

        {/* 文件URL错误提示 */}
        {fileUrlError && (
          <div className="p-4 bg-red-500/20 border-b border-red-500/30">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle size={18} />
              <span className="text-sm">文件URL无法访问，请检查网络连接或文件是否已被删除</span>
            </div>
          </div>
        )}

        {/* 预览内容区域 */}
        <div
          className="flex-1 overflow-hidden bg-[#1A1A1D] relative"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {isImage ? (
            // 图片预览
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
                    <div className="text-white/60 text-sm">图片加载失败</div>
                    <button
                      onClick={handleDownload}
                      className="px-4 py-2 bg-[#1164A3] text-white rounded hover:bg-[#0D4A7C] transition-colors text-sm"
                    >
                      下载查看
                    </button>
                  </div>
                </div>
              )}
              <img
                src={attachment.thumbnailUrl || attachment.filePath}
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
                  拖拽移动
                </div>
              )}
            </div>
          ) : isPDF ? (
            // PDF 预览 - 添加超时检测
            <div className="w-full h-full relative">
              {previewLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#1A1A1D] z-10">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 size={32} className="text-white/60 animate-spin" />
                    <div className="text-white/60 text-sm">加载 PDF 中...（最多等待10秒）</div>
                  </div>
                </div>
              )}
              {previewError && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#1A1A1D] z-10">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle size={32} className="text-red-400" />
                    <div className="text-white/60 text-sm mb-4">PDF 预览加载失败或超时</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => window.open(attachment.filePath, '_blank')}
                        className="px-4 py-2 bg-[#1164A3] text-white rounded hover:bg-[#0D4A7C] transition-colors text-sm"
                      >
                        在新标签页打开
                      </button>
                      <button
                        onClick={handleDownload}
                        className="px-4 py-2 bg-[#3A3A3D] text-white rounded hover:bg-[#4A4A4D] transition-colors text-sm"
                      >
                        下载查看
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <iframe
                src={iframeSrc || ''}
                className={`w-full h-full border-0 ${previewLoading || previewError ? 'opacity-0' : 'opacity-100'}`}
                title={attachment.fileName}
                referrerPolicy="strict-origin-when-cross-origin"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
              />
            </div>
          ) : isText ? (
            // 文本预览 - 修复滚动问题
            <div className="w-full h-full overflow-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
              {(loadingText || previewLoading) ? (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 size={32} className="text-white/60 animate-spin" />
                    <div className="text-white/60 text-sm">加载文本内容中...</div>
                  </div>
                </div>
              ) : previewError ? (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle size={32} className="text-red-400" />
                    <div className="text-white/60 text-sm">文本加载失败</div>
                    <button
                      onClick={handleDownload}
                      className="px-4 py-2 bg-[#1164A3] text-white rounded hover:bg-[#0D4A7C] transition-colors text-sm"
                    >
                      下载查看
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6">
                  <pre className="text-sm text-white/90 whitespace-pre-wrap break-words font-mono" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
                    <code>{textContent || '无法加载文件内容'}</code>
                  </pre>
                </div>
              )}
            </div>
          ) : isOfficeDoc ? (
            // Office 文档预览 - 添加超时检测
            <div className="w-full h-full relative">
              {previewLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#1A1A1D] z-10">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 size={32} className="text-white/60 animate-spin" />
                    <div className="text-white/60 text-sm">加载 Office 预览中...（最多等待10秒）</div>
                  </div>
                </div>
              )}
              {previewError && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#1A1A1D] z-10">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle size={32} className="text-red-400" />
                    <div className="text-white/60 text-sm">Office 预览加载失败或超时</div>
                    <button
                      onClick={handleDownload}
                      className="px-4 py-2 bg-[#1164A3] text-white rounded hover:bg-[#0D4A7C] transition-colors text-sm"
                    >
                      下载查看
                    </button>
                  </div>
                </div>
              )}
              <iframe
                src={iframeSrc || ''}
                className={`w-full h-full border-0 ${previewLoading || previewError ? 'opacity-0' : 'opacity-100'}`}
                title={`${attachment.fileName} - Office Online 预览`}
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                referrerPolicy="no-referrer"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
              />
            </div>
          ) : (
            // 不支持预览的文件
            <div className="w-full h-full flex flex-col items-center justify-center text-white/60">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mb-4">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeWidth="2"/>
                <polyline points="14 2 14 8 20 8" strokeWidth="2"/>
                <line x1="16" y1="13" x2="8" y2="13" strokeWidth="2"/>
                <line x1="16" y1="17" x2="8" y2="17" strokeWidth="2"/>
                <polyline points="10 9 9 9 8 9" strokeWidth="2"/>
              </svg>
              <p className="text-center mb-4">此文件类型不支持预览</p>
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-[#1164A3] text-white rounded hover:bg-[#0D4A7C] transition-colors"
              >
                下载文件
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
