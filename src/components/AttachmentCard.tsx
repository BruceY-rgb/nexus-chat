'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Attachment } from '@/types/message';
import {
  Download,
  Eye,
  FileText,
  File,
  Table,
  Archive
} from 'lucide-react';

// 动态导入 FilePreviewModal，禁用 SSR
const FilePreviewModal = dynamic(
  () => import('./FilePreviewModal'),
  { ssr: false }
);

interface AttachmentCardProps {
  attachment: Attachment;
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

      {/* 预览模态窗口 - 使用动态导入，禁用 SSR */}
      {showPreview && (
        <FilePreviewModal
          attachment={attachment}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
}
