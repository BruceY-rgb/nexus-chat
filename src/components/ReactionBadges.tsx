'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface GroupedReaction {
  emoji: string;
  count: number;
  users: Array<{
    id: string;
    displayName: string;
  }>;
}

interface ReactionBadgesProps {
  reactions: GroupedReaction[];
  currentUserId: string;
  isOwnMessage: boolean;
  onToggleReaction: (emoji: string) => void;
  className?: string;
  pendingReactions?: PendingReaction[];
}

interface PendingReaction {
  emoji: string;
  action: 'add' | 'remove';
  tempId: string;
  timestamp: number;
}

export default function ReactionBadges({
  reactions,
  currentUserId,
  isOwnMessage,
  onToggleReaction,
  className = '',
  pendingReactions = [],
}: ReactionBadgesProps) {
  const [hoveredEmoji, setHoveredEmoji] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{
    x: number;
    y: number;
  }>({ x: 0, y: 0 });

  // 检查 emoji 是否在待处理队列中
  const isEmojiPending = (emoji: string) => {
    return pendingReactions.some(p => p.emoji === emoji);
  };

  // 如果没有 reactions，不显示任何内容
  if (!reactions || reactions.length === 0) {
    return null;
  }

  // 处理鼠标悬停
  const handleMouseEnter = (emoji: string, event: React.MouseEvent) => {
    setHoveredEmoji(emoji);

    // 计算 Tooltip 位置
    const rect = event.currentTarget.getBoundingClientRect();
    const tooltipX = rect.left + rect.width / 2;
    const tooltipY = rect.top - 10;

    setTooltipPosition({ x: tooltipX, y: tooltipY });
  };

  const handleMouseLeave = () => {
    setHoveredEmoji(null);
  };

  // 检查当前用户是否已对该 emoji 做出反应
  const hasUserReacted = (emoji: string) => {
    return reactions.some(r => r.emoji === emoji && r.users.some(u => u.id === currentUserId));
  };

  // 获取悬停的 emoji 信息
  const hoveredReaction = reactions.find(r => r.emoji === hoveredEmoji);

  return (
    <>
      <div
        className={`flex flex-wrap gap-1 mt-1 ${
          isOwnMessage ? 'justify-end' : 'justify-start'
        } ${className}`}
      >
        <AnimatePresence mode="popLayout">
          {reactions.map((reaction) => {
            const isReactedByUser = hasUserReacted(reaction.emoji);
            const isPending = isEmojiPending(reaction.emoji);

            return (
              <motion.button
                key={reaction.emoji}
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                  scale: 1,
                  opacity: isPending ? 0.7 : 1,
                  transition: { duration: 0.2 }
                }}
                exit={{ scale: 0, opacity: 0 }}
                whileHover={!isPending ? { scale: 1.1 } : {}}
                whileTap={!isPending ? { scale: 0.95 } : {}}
                transition={{ duration: 0.2 }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isPending) {
                    onToggleReaction(reaction.emoji);
                  }
                }}
                onMouseEnter={(e) => !isPending && handleMouseEnter(reaction.emoji, e)}
                onMouseLeave={handleMouseLeave}
                disabled={isPending}
                className={`
                  flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
                  transition-all duration-200 hover:shadow-md relative
                  ${
                    isReactedByUser
                      ? 'bg-blue-600/20 border border-blue-500/50 text-blue-300'
                      : 'bg-slate-800/60 border border-slate-600/50 text-slate-300 hover:bg-slate-700/60'
                  }
                  ${isPending ? 'cursor-wait' : 'cursor-pointer'}
                `}
              >
                <span className="text-sm">{reaction.emoji}</span>
                <span className="font-semibold">{reaction.count}</span>

                {/* 加载动画 */}
                {isPending && (
                  <motion.span
                    className="absolute inset-0 rounded-full border-2 border-blue-400"
                    initial={{ opacity: 0 }}
                    animate={{
                      opacity: [0, 1, 0],
                      scale: [1, 1.2, 1],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                )}
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {hoveredEmoji && hoveredReaction && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            transition={{ duration: 0.15 }}
            className="fixed z-[9999] pointer-events-none"
            style={{
              left: tooltipPosition.x,
              top: tooltipPosition.y,
              transform: 'translateX(-50%) translateY(-100%)',
            }}
          >
            <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl border border-gray-700 whitespace-nowrap">
              <div className="flex items-center gap-1.5">
                <span className="text-base">{hoveredReaction.emoji}</span>
                <span className="text-gray-300">
                  {hoveredReaction.users.map(u => u.displayName).join(', ')}
                </span>
              </div>
              <div className="text-gray-400 text-xs mt-0.5">
                {hoveredReaction.count} {hoveredReaction.count === 1 ? 'person' : 'people'}
              </div>
              {/* Tooltip 箭头 */}
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
