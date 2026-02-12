'use client';

import { useConversationFiles, ConversationAttachment } from '@/hooks/useConversationFiles';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Filter, Grid, List, File, Image, Video, FileText, Trash2, Download, Eye } from 'lucide-react';
import { useState } from 'react';
import FilePreviewModal from './FilePreviewModal';

interface FileListProps {
  conversationId: string;
  conversationType: 'channel' | 'dm';
}

function formatFileSize(bytes: string | number): string {
  const size = typeof bytes === 'string' ? parseInt(bytes) : bytes;
  if (size === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(size) / Math.log(k));
  return parseFloat((size / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return 'Today';
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return `${days} days ago`;
  } else {
    return date.toLocaleDateString('en-US');
  }
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <Image className="w-5 h-5" />;
  if (mimeType.startsWith('video/')) return <Video className="w-5 h-5" />;
  if (mimeType.includes('pdf')) return <FileText className="w-5 h-5" />;
  if (mimeType.includes('word') || mimeType.includes('document')) return <FileText className="w-5 h-5" />;
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return <FileText className="w-5 h-5" />;
  return <File className="w-5 h-5" />;
}

function getPreviewUrl(attachment: ConversationAttachment): string {
  if (attachment.previewUrl) return attachment.previewUrl;
  if (attachment.thumbnailUrl) return attachment.thumbnailUrl;
  return attachment.filePath;
}

export default function FileList({ conversationId, conversationType }: FileListProps) {
  const { user } = useAuth();
  const {
    filteredAttachments,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    filter,
    setFilter,
    deleteAttachment,
    refetch
  } = useConversationFiles(conversationId, conversationType);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [previewAttachment, setPreviewAttachment] = useState<ConversationAttachment | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDelete = async (attachmentId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;

    setIsDeleting(attachmentId);
    const success = await deleteAttachment(attachmentId);
    setIsDeleting(null);

    if (!success) {
      alert('Failed to delete. Please try again.');
    }
  };

  const handleDownload = async (attachment: ConversationAttachment) => {
    const url = getPreviewUrl(attachment);
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filterOptions = [
    { id: 'all', label: 'All' },
    { id: 'image', label: 'Images', icon: Image },
    { id: 'video', label: 'Videos', icon: Video },
    { id: 'document', label: 'Documents', icon: FileText }
  ] as const;

  if (isLoading && filteredAttachments.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-secondary">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-text-secondary">Failed to load files</div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary/90"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search and filter toolbar */}
      <div className="flex-shrink-0 p-4 border-b border-border">
        <div className="flex items-center gap-3 mb-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-[#1A1A1D] border border-[#3A3A3D] rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-white placeholder:text-text-secondary"
            />
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-[#1A1A1D] rounded-md p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-primary/20 text-primary' : 'text-text-secondary hover:text-text-primary'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-primary/20 text-primary' : 'text-text-secondary hover:text-text-primary'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter tags */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-text-secondary" />
          {filterOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setFilter(option.id)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                filter === option.id
                  ? 'bg-primary text-white'
                  : 'bg-[#1A1A1D] text-text-secondary hover:text-text-primary'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredAttachments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-secondary">
            <File className="w-12 h-12 mb-2 opacity-50" />
            <p>No files yet</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredAttachments.map((attachment) => (
              <div
                key={attachment.id}
                className="group relative bg-[#1A1A1D] rounded-lg overflow-hidden border border-[#3A3A3D] hover:border-primary/50 transition-colors"
              >
                {/* Preview area */}
                <div
                  className="aspect-square flex items-center justify-center bg-[#2A2A2D] cursor-pointer"
                  onClick={() => setPreviewAttachment(attachment)}
                >
                  {attachment.mimeType.startsWith('image/') && attachment.thumbnailUrl ? (
                    <img
                      src={attachment.thumbnailUrl}
                      alt={attachment.fileName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-text-secondary">
                      {getFileIcon(attachment.mimeType)}
                    </div>
                  )}
                </div>

                {/* File info */}
                <div className="p-2">
                  <p className="text-sm font-medium truncate" title={attachment.fileName}>
                    {attachment.fileName}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-text-secondary">
                      {formatFileSize(attachment.fileSize)}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {formatDate(attachment.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Hover action buttons */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setPreviewAttachment(attachment)}
                    className="p-1.5 bg-[#2A2A2D]/80 rounded-md hover:bg-[#2A2A2D]"
                    title="Preview"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDownload(attachment)}
                    className="p-1.5 bg-[#2A2A2D]/80 rounded-md hover:bg-[#2A2A2D]"
                    title="Download"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  {user?.id === attachment.sender?.id && (
                    <button
                      onClick={() => handleDelete(attachment.id)}
                      disabled={isDeleting === attachment.id}
                      className="p-1.5 bg-[#2A2A2D]/80 rounded-md hover:bg-[#2A2A2D] text-red-500"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAttachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center gap-3 p-3 bg-[#1A1A1D] rounded-lg border border-[#3A3A3D] hover:border-primary/50 transition-colors group"
              >
                {/* Preview/Icon */}
                <div
                  className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-[#2A2A2D] rounded cursor-pointer overflow-hidden"
                  onClick={() => setPreviewAttachment(attachment)}
                >
                  {attachment.mimeType.startsWith('image/') && attachment.thumbnailUrl ? (
                    <img
                      src={attachment.thumbnailUrl}
                      alt={attachment.fileName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-text-secondary">
                      {getFileIcon(attachment.mimeType)}
                    </div>
                  )}
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate cursor-pointer hover:text-primary"
                    onClick={() => setPreviewAttachment(attachment)}
                    title={attachment.fileName}
                  >
                    {attachment.fileName}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-text-secondary">
                      {formatFileSize(attachment.fileSize)}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {attachment.sender?.displayName}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {formatDate(attachment.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPreviewAttachment(attachment)}
                    className="p-2 text-text-secondary hover:text-primary rounded-md hover:bg-[#2A2A2D]"
                    title="Preview"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDownload(attachment)}
                    className="p-2 text-text-secondary hover:text-primary rounded-md hover:bg-[#2A2A2D]"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  {user?.id === attachment.sender?.id && (
                    <button
                      onClick={() => handleDelete(attachment.id)}
                      disabled={isDeleting === attachment.id}
                      className="p-2 text-text-secondary hover:text-red-500 rounded-md hover:bg-[#2A2A2D]"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview modal */}
      {previewAttachment && (
        <FilePreviewModal
          attachment={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
        />
      )}
    </div>
  );
}
