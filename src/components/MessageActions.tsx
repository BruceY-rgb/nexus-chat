'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Message } from '@/types/message';
import { Edit2, Trash2, MoreHorizontal, Smile, Plus } from 'lucide-react';

interface MessageActionsProps {
  message: Message;
  currentUserId: string;
  isOwnMessage: boolean; // 🆕 标识消息归属，用于智能对侧定位
  onEdit: (message: Message) => void;
  onDelete: (messageId: string) => void;
  className?: string;
  containerRef?: React.RefObject<HTMLDivElement>; // 🆕 消息滚动容器 ref
}

export default function MessageActions({
  message,
  currentUserId,
  isOwnMessage,
  onEdit,
  onDelete,
  className = '',
  containerRef
}: MessageActionsProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [userReactions, setUserReactions] = useState<Set<string>>(new Set());
  const [portalPosition, setPortalPosition] = useState<{
    top: number;
    left?: number;
    right?: number;
    transform?: string;
  }>({ top: 0 });

  // 只有消息作者才能看到编辑/删除按钮
  const isOwner = message.userId === currentUserId;
  const toolbarRef = useRef<HTMLDivElement>(null);
  // 🆕 独立的按钮 ref - 用于精确定位
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // 🆕 对方消息的表情回复逻辑
  useEffect(() => {
    // TODO: 从API获取用户当前的表情反应状态
    // 这里先模拟一些数据
    if (!isOwnMessage) {
      setUserReactions(new Set(['👍'])); // 模拟用户已反应👍
    }
  }, [message.id, isOwnMessage]);

  // 表情回复处理函数
  const handleEmojiReaction = async (emoji: string) => {
    try {
      const response = await fetch(`/api/messages/${message.id}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji })
      });

      if (response.ok) {
        const result = await response.json();
        // 更新本地状态
        setUserReactions(prev => {
          const newReactions = new Set(prev);
          if (newReactions.has(emoji)) {
            newReactions.delete(emoji); // 取消反应
          } else {
            newReactions.add(emoji); // 添加反应
          }
          return newReactions;
        });
        console.log(`✅ Emoji reaction toggled: ${emoji} for message ${message.id}`);
      }
    } catch (error) {
      console.error('❌ Failed to toggle emoji reaction:', error);
    }
  };

  // 检查用户是否已反应某个表情
  const hasUserReacted = (emoji: string) => userReactions.has(emoji);

  // 🧠 增强的Portal辅助组件 - 支持容器限制
  const Portal = ({ children }: { children: React.ReactNode }) => {
    // 如果提供了容器ref，优先使用容器；否则回退到document.body
    const container = containerRef?.current || document.body;
    return createPortal(children, container);
  };

  // 🧠 智能定位计算 - 统一容器内坐标系
  useEffect(() => {
    if (showMenu || showEmojiPicker) {
      const updatePosition = () => {
        // 获取触发按钮和容器
        const buttonRef = showMenu ? menuButtonRef : emojiButtonRef;
        const button = buttonRef.current;
        const container = containerRef?.current || document.body;

        if (button && container) {
          const buttonRect = button.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();

          // 获取面板尺寸（估算）
          const panelHeight = showMenu ? 80 : 280; // ActionMenu约80px, EmojiPicker约280px
          const panelWidth = showMenu ? 144 : 256; // ActionMenu约144px, EmojiPicker约256px
          const sideOffset = 4; // 按钮与面板间距

          // 计算在容器内的相对位置
          const relativeButtonTop = buttonRect.top - containerRect.top;
          const relativeButtonLeft = buttonRect.left - containerRect.left;
          const relativeButtonRight = buttonRect.right - containerRect.left;

          // 容器边界
          const containerWidth = containerRect.width;
          const collisionPadding = 4; // 最小边距

          // 计算垂直位置：紧贴按钮边缘，垂直居中对齐
          const buttonCenterY = relativeButtonTop + buttonRect.height / 2;
          let top = buttonCenterY - panelHeight / 2;

          // 垂直边界检测
          if (top < collisionPadding) {
            top = collisionPadding;
          } else if (top + panelHeight > containerRect.height - collisionPadding) {
            top = containerRect.height - panelHeight - collisionPadding;
          }

          // 🧠 实现"向内弹出"逻辑：始终朝向屏幕中心
          let left: number | undefined;
          if (isOwnMessage) {
            // 己方消息：工具栏在左侧，弹窗向右展开（向屏幕中心）
            left = relativeButtonRight + sideOffset;

            // 边界检测：确保不超出容器右边界
            if (left + panelWidth > containerWidth - collisionPadding) {
              // 如果右边放不下，切换到左边（但仍保持向内弹出逻辑）
              left = relativeButtonLeft - panelWidth - sideOffset;
            }
          } else {
            // 对方消息：工具栏在右侧，弹窗向左展开（向屏幕中心）
            left = relativeButtonLeft - panelWidth - sideOffset;

            // 边界检测：确保不超出容器左边界
            if (left < collisionPadding) {
              // 如果左边放不下，切换到右边（但仍保持向内弹出逻辑）
              left = relativeButtonRight + sideOffset;
            }
          }

          // 最终安全检测：确保left在有效范围内
          if (left !== undefined) {
            left = Math.max(collisionPadding, Math.min(left, containerWidth - panelWidth - collisionPadding));
          }

          setPortalPosition({
            top,
            left,
            transform: 'translateY(0)'
          });
        }
      };
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition);
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition);
      };
    }
  }, [showMenu, showEmojiPicker, isOwnMessage, containerRef]);

  // 🧠 智能对侧定位逻辑 - 强制固定在屏幕边缘，长程对侧
  const getToolbarPosition = () => {
    if (isOwnMessage) {
      // 己方消息：工具栏强制固定在屏幕最左侧边缘
      return 'absolute top-0 -translate-y-1/2 left-4 right-auto z-[100]';
    } else {
      // 对方消息：工具栏强制固定在屏幕最右侧边缘
      return 'absolute top-0 -translate-y-1/2 right-4 left-auto z-[100]';
    }
  };

  // 获取工具栏内部flex方向
  const getToolbarDirection = () => {
    if (isOwnMessage) {
      // 己方消息：工具栏在左侧，保持正常顺序
      return 'flex flex-col';
    } else {
      // 对方消息：工具栏在右侧，使用反向顺序，让表情靠近屏幕中心
      return 'flex flex-col items-end';
    }
  };

  // 获取表情回复区域方向
  const getEmojiSectionDirection = () => {
    if (isOwnMessage) {
      // 己方消息：正常顺序
      return 'flex items-center gap-1 mb-1';
    } else {
      // 对方消息：反向顺序，表情靠近屏幕中心
      return 'flex items-center gap-1 mb-1 flex-row-reverse';
    }
  };

  // 表情回复快速操作 - 针对对方消息
  const quickEmojiActions = [
    { emoji: '👍', name: 'thumbs up' },
    { emoji: '🙌', name: 'raised hands' },
    { emoji: '😮', name: 'surprised' }
  ];

  // 完整的表情选择列表
  const fullEmojiActions = [
    { emoji: '👍', name: 'thumbs up' },
    { emoji: '❤️', name: 'heart' },
    { emoji: '😂', name: 'joy' },
    { emoji: '😮', name: 'surprised' },
    { emoji: '😢', name: 'cry' },
    { emoji: '😡', name: 'angry' },
    { emoji: '✅', name: 'check' },
    { emoji: '❌', name: 'cross' },
    { emoji: '🔥', name: 'fire' },
    { emoji: '🎉', name: 'party' }
  ];

  // 🆕 如果是已删除的消息，不显示任何操作
  if (message.isDeleted) {
    return null;
  }

  const handleEdit = () => {
    setShowMenu(false);
    onEdit(message);
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
    setShowMenu(false);
  };

  const confirmDelete = () => {
    onDelete(message.id);
    setShowDeleteConfirm(false);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <div className={`relative ${className}`} ref={toolbarRef}>
        {/* 🧠 智能对侧悬停工具栏 - 集成表情回复和操作 */}
        <div className={`${getToolbarPosition()} opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-md shadow-2xl ${getToolbarDirection()}`}>
          {/* 对方消息的表情回复区域 */}
          {!isOwnMessage && (
            <div className={getEmojiSectionDirection()}>
              {/* 快速反应按钮 */}
              {quickEmojiActions.map((action) => (
                <button
                  key={action.name}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEmojiReaction(action.emoji);
                    setShowMenu(false); // 关闭菜单
                    setShowEmojiPicker(false); // 关闭表情面板
                  }}
                  className={`w-7 h-7 rounded-full backdrop-blur-md flex items-center justify-center text-sm hover:scale-125 hover:-translate-y-0.5 transition-all duration-150 border shadow-lg ${
                    hasUserReacted(action.emoji)
                      ? 'bg-blue-600/80 border-blue-400 text-white'
                      : 'bg-gray-800/95 hover:bg-blue-600/80 border-gray-500/40'
                  }`}
                  title={`React with ${action.name}`}
                >
                  {action.emoji}
                </button>
              ))}

              {/* EmojiPicker触发器 */}
              <button
                ref={emojiButtonRef}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEmojiPicker(!showEmojiPicker);
                  setShowMenu(false); // 关闭菜单
                }}
                className="w-7 h-7 rounded-full bg-gray-800/95 backdrop-blur-md hover:bg-blue-600/80 flex items-center justify-center text-gray-300 hover:text-white transition-all duration-150 border border-gray-500/40 hover:border-blue-400 hover:scale-110 active:scale-95"
                title="More emojis"
              >
                <Smile size={14} />
              </button>
            </div>
          )}

          {/* 更多操作按钮（仅作者可见） */}
          {isOwner && (
            <button
              ref={menuButtonRef}
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
                setShowEmojiPicker(false); // 关闭表情面板
              }}
              className="p-1.5 rounded-md bg-gray-800/95 backdrop-blur-md shadow-xl hover:bg-gray-700/90 text-gray-300 hover:text-white transition-all duration-200 border border-gray-500/40 hover:border-gray-400/60 hover:scale-110 active:scale-95"
              title="More actions"
            >
              <MoreHorizontal size={16} />
            </button>
          )}

          {/* 🧠 智能对侧下拉菜单（仅作者可见） - 使用Portal */}
          {isOwner && showMenu && (
            <Portal>
              <div
                className="absolute inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div
                className="absolute w-36 bg-gray-800/95 backdrop-blur-md rounded-lg shadow-xl border border-gray-600/30 py-1.5 z-[9998]"
                style={{
                  top: portalPosition.top,
                  left: portalPosition.left,
                  transform: portalPosition.transform || 'translateY(0)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={handleEdit}
                  className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-700/80 flex items-center gap-2.5 transition-colors duration-150"
                >
                  <Edit2 size={14} />
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/20 hover:text-red-300 flex items-center gap-2.5 transition-colors duration-150"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </Portal>
          )}

          {/* 🧠 EmojiPicker面板 - 使用Portal解决被截断问题 */}
          {showEmojiPicker && (
            <Portal>
              <div
                className="absolute w-64 bg-gray-800/95 backdrop-blur-md rounded-lg shadow-2xl border border-gray-600/30 p-3 z-[9999]"
                style={{
                  top: portalPosition.top,
                  left: portalPosition.left,
                  transform: portalPosition.transform || 'translateY(0)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="grid grid-cols-5 gap-2">
                  {fullEmojiActions.map((action) => (
                    <button
                      key={action.name}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEmojiReaction(action.emoji);
                        setShowEmojiPicker(false);
                      }}
                      className="w-10 h-10 rounded-lg bg-gray-700/50 hover:bg-gray-600/70 flex items-center justify-center text-lg hover:scale-110 transition-all duration-150"
                      title={`React with ${action.name}`}
                    >
                      {action.emoji}
                    </button>
                  ))}
                </div>
              </div>
            </Portal>
          )}
        </div>

        {/* 删除确认对话框 */}
        {showDeleteConfirm && (
          <>
            {/* 背景遮罩 */}
            <div
              className="fixed inset-0 bg-black/50 z-30"
              onClick={cancelDelete}
            />
            {/* 确认对话框 */}
            <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
              <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-6 max-w-sm w-full">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Delete Message
                </h3>
                <p className="text-gray-300 text-sm mb-4">
                  Are you sure you want to delete this message? This action cannot be undone.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={cancelDelete}
                    className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
