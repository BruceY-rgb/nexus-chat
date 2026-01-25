'use client';

import React, { useState } from 'react';
import { Attachment } from '@/types/message';
import {
  X,
  Download,
  FileText,
  File,
  Eye,
  ZoomIn,
  ZoomOut,
  Maximize,
  Minimize,
  RotateCcw,
  Move3D,
  AlertCircle,
  Loader2,
  Table,
  Archive
} from 'lucide-react';

interface AttachmentCardProps {
  attachment: Attachment;
}

interface FilePreviewModalProps {
  attachment: Attachment | null;
  onClose: () => void;
}

function FilePreviewModal({ attachment, onClose }: FilePreviewModalProps) {
  if (!attachment) return null;

  const isImage = attachment.mimeType.startsWith('image/');
  const isPDF = attachment.mimeType === 'application/pdf';
  const isText = attachment.mimeType.startsWith('text/');
  const isOfficeDoc = /\.(docx|doc|xlsx|xls|pptx|ppt)$/i.test(attachment.fileName);

  const [scale, setScale] = React.useState(1);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
  const [previewLoading, setPreviewLoading] = React.useState(true);
  const [previewError, setPreviewError] = React.useState(false);

  const formatFileSize = (sizeStr: string) => {
    const bytes = Number(sizeStr);
    const mb = bytes / 1024 / 1024;
    if (mb < 1) {
      const kb = bytes / 1024;
      return `${kb.toFixed(1)} KB`;
    }
    return `${mb.toFixed(2)} MB`;
  };

  // 处理键盘事件
  React.useEffect(() => {
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

  const handleDownload = () => {
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

  const getOfficePreviewUrl = (url: string) => {
    return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`;
  };

  // 处理 iframe 加载事件
  const handleIframeLoad = () => {
    setPreviewLoading(false);
    setPreviewError(false);
  };

  const handleIframeError = () => {
    setPreviewLoading(false);
    setPreviewError(true);
  };

  // 处理图片加载事件
  const handleImageLoad = () => {
    setPreviewLoading(false);
    setPreviewError(false);
  };

  const handleImageError = () => {
    setPreviewLoading(false);
    setPreviewError(true);
  };

  // 重置状态（当 attachment 改变时）
  React.useEffect(() => {
    setPreviewLoading(true);
    setPreviewError(false);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [attachment]);

  const getLanguageFromFileName = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'jsx',
      'ts': 'typescript',
      'tsx': 'tsx',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'swift': 'swift',
      'kt': 'kotlin',
      'sql': 'sql',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'less': 'less',
      'json': 'json',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yml',
      'md': 'markdown',
      'sh': 'bash',
      'bash': 'bash',
      'zsh': 'bash',
      'fish': 'bash',
      'ps1': 'powershell',
      'dockerfile': 'dockerfile',
      'txt': 'text'
    };
    return langMap[ext || ''] || 'text';
  };

  const [textContent, setTextContent] = React.useState<string>('');
  const [loadingText, setLoadingText] = React.useState(false);

  React.useEffect(() => {
    if (isText) {
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
  }, [isText, attachment.filePath]);

  return (
    <div
      className={`fixed inset-0 bg-black/80 flex items-center justify-center z-50 ${isFullscreen ? 'p-0' : 'p-4'}`}
      onClick={onClose}
    >
      <div
        className={`relative bg-[#2A2A2D] rounded-lg w-full ${isFullscreen ? 'h-full' : 'max-w-4xl max-h-[90vh]'} overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 增强的模态窗口头部 */}
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

        {/* 增强的预览内容区域 */}
        <div
          className="flex-1 overflow-hidden bg-[#1A1A1D] relative"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {isImage ? (
            // 图片预览：支持缩放和拖拽
            <div className="w-full h-full flex items-center justify-center overflow-hidden relative">
              {previewLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#1A1A1D] z-10">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 size={32} className="text-white/60 animate-spin" />
                    <div className="text-white/60 text-sm">加载中...</div>
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
            // PDF 预览：直接嵌入
            <div className="w-full h-full relative">
              {previewLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#1A1A1D] z-10">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 size={32} className="text-white/60 animate-spin" />
                    <div className="text-white/60 text-sm">加载 PDF 中...</div>
                  </div>
                </div>
              )}
              {previewError && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#1A1A1D] z-10">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle size={32} className="text-red-400" />
                    <div className="text-white/60 text-sm mb-4">PDF 预览失败</div>
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
                src={attachment.filePath}
                className={`w-full h-full border-0 ${previewLoading || previewError ? 'opacity-0' : 'opacity-100'}`}
                title={attachment.fileName}
                // 移除 sandbox 以允许 PDF 渲染
                referrerPolicy="strict-origin-when-cross-origin"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
              />
            </div>
          ) : isText ? (
            // 文本预览：语法高亮显示
            <div className="w-full h-full overflow-auto">
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
                  <pre className="text-sm text-white/90 whitespace-pre-wrap break-words font-mono">
                    <code>{textContent || '无法加载文件内容'}</code>
                  </pre>
                </div>
              )}
            </div>
          ) : isOfficeDoc ? (
            // Office 文档预览：使用 Office Online
            <div className="w-full h-full relative">
              {previewLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#1A1A1D] z-10">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 size={32} className="text-white/60 animate-spin" />
                    <div className="text-white/60 text-sm">加载 Office 预览中...</div>
                  </div>
                </div>
              )}
              {previewError && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#1A1A1D] z-10">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle size={32} className="text-red-400" />
                    <div className="text-white/60 text-sm">Office 预览加载失败</div>
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
                src={getOfficePreviewUrl(attachment.filePath)}
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
              <File size={64} className="mb-4" />
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

export default function AttachmentCard({ attachment }: AttachmentCardProps) {
  const [showPreview, setShowPreview] = useState(false);

  const isImage = attachment.mimeType.startsWith('image/');
  const isPDF = attachment.mimeType === 'application/pdf';
  const isText = attachment.mimeType.startsWith('text/');
  const isExcel = /\.(xlsx|xls|csv)$/i.test(attachment.fileName);
  const isWord = /\.(docx|doc)$/i.test(attachment.fileName);
  const isPowerPoint = /\.(pptx|ppt)$/i.test(attachment.fileName);
  const isZip = /\.(zip)$/i.test(attachment.fileName);

  const getFileIcon = () => {
    if (isPDF) {
      return <FileText size={24} className="text-red-400" />;
    }
    if (isExcel) {
      return <Table size={24} className="text-green-400" />;
    }
    if (isWord) {
      return <FileText size={24} className="text-blue-400" />;
    }
    if (isPowerPoint) {
      return <FileText size={24} className="text-orange-400" />;
    }
    if (isZip) {
      return <Archive size={24} className="text-yellow-400" />;
    }
    if (isText) {
      return <FileText size={24} className="text-gray-400" />;
    }
    if (isImage) {
      return <FileText size={24} className="text-purple-400" />;
    }
    return <File size={24} className="text-white/60" />;
  };

  const getFileIconBg = () => {
    if (isPDF) return 'bg-red-500/20';
    if (isExcel) return 'bg-green-500/20';
    if (isWord) return 'bg-blue-500/20';
    if (isPowerPoint) return 'bg-orange-500/20';
    if (isZip) return 'bg-yellow-500/20';
    if (isText) return 'bg-gray-500/20';
    if (isImage) return 'bg-purple-500/20';
    return 'bg-[#1A1A1D]';
  };

  const formatFileSize = (sizeStr: string) => {
    const bytes = Number(sizeStr);
    const mb = bytes / 1024 / 1024;
    if (mb < 1) {
      const kb = bytes / 1024;
      return `${kb.toFixed(1)} KB`;
    }
    return `${mb.toFixed(2)} MB`;
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = attachment.filePath;
    link.download = attachment.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isImage || isPDF || isText || isExcel || isWord || isPowerPoint) {
      setShowPreview(true);
    } else {
      // 不支持预览的文件直接下载
      handleDownload(e);
    }
  };

  return (
    <>
      <div className="w-full max-w-md rounded-lg border border-[#3A3A3D] bg-[#2A2A2D] p-3 hover:bg-[#323235] transition-colors cursor-pointer group">
        <div className="flex items-start gap-3">
          {/* 文件图标 */}
          <div className={`flex-shrink-0 w-12 h-12 rounded flex items-center justify-center ${getFileIconBg()}`}>
            {isImage ? (
              <img
                src={attachment.thumbnailUrl || attachment.filePath}
                alt={attachment.fileName}
                className="w-full h-full object-cover rounded"
              />
            ) : (
              getFileIcon()
            )}
          </div>

          {/* 文件信息 */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white/90 truncate mb-1">
              {attachment.fileName}
            </div>
            <div className="text-xs text-white/60 mb-2">
              {formatFileSize(attachment.fileSize)}
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2">
              {(isImage || isPDF || isText || isExcel || isWord || isPowerPoint) && (
                <button
                  onClick={handlePreview}
                  className="px-3 py-1 text-xs bg-[#1164A3] hover:bg-[#0D4A7C] text-white rounded transition-colors flex items-center gap-1"
                >
                  <Eye size={14} />
                  预览
                </button>
              )}
              <button
                onClick={handleDownload}
                className="px-3 py-1 text-xs bg-[#3A3A3D] hover:bg-[#4A4A4D] text-white rounded transition-colors flex items-center gap-1"
              >
                <Download size={14} />
                下载
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 预览模态窗口 */}
      <FilePreviewModal
        attachment={showPreview ? attachment : null}
        onClose={() => setShowPreview(false)}
      />
    </>
  );
}
