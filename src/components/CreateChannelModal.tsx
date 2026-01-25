'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (channelName: string, description?: string) => void;
}

export default function CreateChannelModal({
  isOpen,
  onClose,
  onCreate
}: CreateChannelModalProps) {
  const [channelName, setChannelName] = useState('');
  const [description, setDescription] = useState('');

  // 检查频道名称是否有效（不为空且不以空格开头）
  const isChannelNameValid = channelName.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isChannelNameValid) {
      onCreate(channelName.trim(), description.trim() || undefined);
      // 重置表单
      setChannelName('');
      setDescription('');
    }
  };

  const handleClose = () => {
    setChannelName('');
    setDescription('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* 模态框 */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Create a channel
            </h2>
          </div>

          {/* Body */}
          <div className="px-6 py-4">
            {/* 说明文字 */}
            <p className="text-sm text-gray-600 mb-4">
              Channels are where your team communicates. They're best when organized around a topic — like{' '}
              <span className="font-medium text-gray-900">#marketing</span>.
            </p>

            {/* 频道名称输入框 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">
                  #
                </span>
                <input
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900"
                  placeholder="e.g. marketing"
                  autoFocus
                />
              </div>
              {/* 错误提示 */}
              {!isChannelNameValid && channelName.length > 0 && (
                <p className="mt-1 text-xs text-red-500">
                  Channel name cannot be empty or start with a space
                </p>
              )}
            </div>

            {/* 描述输入框 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900"
                placeholder="What's this channel about?"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              className="mr-2"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!isChannelNameValid}
              className={`${
                isChannelNameValid
                  ? 'bg-[#2BAC76] hover:bg-[#239a63] text-white'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Create
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
