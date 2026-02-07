'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Message } from '@/types/message';
import { useReactions } from '@/hooks/useReactions';
import EmojiPicker from './EmojiPicker';
import { Edit2, Trash2, MoreHorizontal, Smile } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MessageActionsProps {
  message: Message;
  currentUserId: string;
  isOwnMessage: boolean;
  onEdit: (message: Message) => void;
  onDelete: (messageId: string) => void;
  className?: string;
  containerRef?: React.RefObject<HTMLDivElement>;
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
  const [portalPosition, setPortalPosition] = useState<{
    top: number;
    left?: number;
    right?: number;
    transform?: string;
  }>({ top: 0 });

  const { userReactions, toggleReaction } = useReactions(message.id, currentUserId);

  const isOwner = message.userId === currentUserId;
  const toolbarRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // 智能定位计算
  useEffect(() => {
    if (showMenu || showEmojiPicker) {
      const updatePosition = () => {
        const buttonRef = showMenu ? menuButtonRef : emojiButtonRef;
        const button = buttonRef.current;
        const container = containerRef?.current || document.body;

        if (button && container) {
          const buttonRect = button.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();

          const panelHeight = showMenu ? 80 : 320;
          const panelWidth = showMenu ? 144 : 320;
          const sideOffset = 4;

          const relativeButtonTop = buttonRect.top - containerRect.top;
          const relativeButtonLeft = buttonRect.left - containerRect.left;
          const relativeButtonRight = buttonRect.right - containerRect.left;

          const containerWidth = containerRect.width;
          const collisionPadding = 4;

          const buttonCenterY = relativeButtonTop + buttonRect.height / 2;
          let top = buttonCenterY - panelHeight / 2;

          if (top < collisionPadding) {
            top = collisionPadding;
          } else if (top + panelHeight > containerRect.height - collisionPadding) {
            top = containerRect.height - panelHeight - collisionPadding;
          }

          let left: number | undefined;
          if (isOwnMessage) {
            left = relativeButtonRight + sideOffset;
            if (left + panelWidth > containerWidth - collisionPadding) {
              left = relativeButtonLeft - panelWidth - sideOffset;
            }
          } else {
            left = relativeButtonLeft - panelWidth - sideOffset;
            if (left < collisionPadding) {
              left = relativeButtonRight + sideOffset;
            }
          }

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

  // 智能对侧定位逻辑
  const getToolbarPosition = () => {
    if (isOwnMessage) {
      return 'absolute top-0 -translate-y-1/2 left-4 right-auto z-[100]';
    } else {
      return 'absolute top-0 -translate-y-1/2 right-4 left-auto z-[100]';
    }
  };

  const getToolbarDirection = () => {
    if (isOwnMessage) {
      return 'flex flex-col';
    } else {
      return 'flex flex-col items-end';
    }
  };

  const getEmojiSectionDirection = () => {
    if (isOwnMessage) {
      return 'flex items-center gap-1 mb-1';
    } else {
      return 'flex items-center gap-1 mb-1 flex-row-reverse';
    }
  };

  // 快捷表情按钮
  const quickEmojiActions = [
    { emoji: '👍', name: 'thumbs up' },
    { emoji: '🙌', name: 'raised hands' },
    { emoji: '😮', name: 'surprised' }
  ];

  // 表情回复处理
  const handleEmojiClick = async (emoji: string) => {
    await toggleReaction(emoji);
  };

  // 如果是已删除的消息，不显示任何操作
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
        {/* 悬停工具栏 */}
        <div className={`${getToolbarPosition()} opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-md shadow-2xl ${getToolbarDirection()}`}>
          {/* 表情回复区域 */}
          {!isOwnMessage && (
            <div className={getEmojiSectionDirection()}>
              {/* 快速反应按钮 */}
              {quickEmojiActions.map((action) => (
                <motion.button
                  key={action.name}
                  whileHover={{ scale: 1.25, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEmojiClick(action.emoji);
                  }}
                  className={`w-7 h-7 rounded-full backdrop-blur-md flex items-center justify-center text-sm border shadow-lg transition-all duration-150 ${
                    userReactions.has(action.emoji)
                      ? 'bg-blue-600/80 border-blue-400 text-white'
                      : 'bg-gray-800/95 hover:bg-blue-600/80 border-gray-500/40 hover:border-blue-400'
                  }`}
                  title={`React with ${action.name}`}
                >
                  <motion.span
                    initial={false}
                    animate={{
                      scale: userReactions.has(action.emoji) ? 1.2 : 1,
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    {action.emoji}
                  </motion.span>
                </motion.button>
              ))}

              {/* EmojiPicker 触发器 */}
              <motion.button
                ref={emojiButtonRef}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEmojiPicker(!showEmojiPicker);
                  setShowMenu(false);
                }}
                className="w-7 h-7 rounded-full bg-gray-800/95 backdrop-blur-md hover:bg-blue-600/80 flex items-center justify-center text-gray-300 hover:text-white transition-all duration-150 border border-gray-500/40 hover:border-blue-400"
                title="More emojis"
              >
                <motion.div
                  animate={{
                    rotate: showEmojiPicker ? 180 : 0,
                  }}
                  transition={{ duration: 0.2 }}
                >
                  <Smile size={14} />
                </motion.div>
              </motion.button>
            </div>
          )}

          {/* 更多操作按钮（仅作者可见） */}
          {isOwner && (
            <motion.button
              ref={menuButtonRef}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
                setShowEmojiPicker(false);
              }}
              className="p-1.5 rounded-md bg-gray-800/95 backdrop-blur-md shadow-xl hover:bg-gray-700/90 text-gray-300 hover:text-white transition-all duration-200 border border-gray-500/40 hover:border-gray-400/60"
              title="More actions"
            >
              <MoreHorizontal size={16} />
            </motion.button>
          )}

          {/* 下拉菜单 */}
          {isOwner && showMenu && (
            <Portal>
              <div
                className="absolute inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -10 }}
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
              </motion.div>
            </Portal>
          )}

          {/* EmojiPicker 面板 */}
          {showEmojiPicker && (
            <Portal>
              <div
                className="absolute inset-0 z-10"
                onClick={() => setShowEmojiPicker(false)}
              />
              <div
                className="absolute z-[9999]"
                style={{
                  top: portalPosition.top,
                  left: portalPosition.left,
                  transform: portalPosition.transform || 'translateY(0)'
                }}
              >
                <EmojiPicker
                  onSelectEmoji={handleEmojiClick}
                  onClose={() => setShowEmojiPicker(false)}
                />
              </div>
            </Portal>
          )}
        </div>

        {/* 删除确认对话框 */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-30"
                onClick={cancelDelete}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="fixed inset-0 z-40 flex items-center justify-center p-4"
              >
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
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

// Portal 辅助组件
function Portal({ children }: { children: React.ReactNode }) {
  const container = typeof window !== 'undefined' ? document.body : null;
  if (!container) return null;
  return createPortal(children, container);
}
