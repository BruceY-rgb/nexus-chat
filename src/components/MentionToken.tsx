'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';

interface MentionTokenProps {
  displayName: string;
  userId: string;
  onRemove: () => void;
  isEditing?: boolean;
  isCurrentUserMentioned?: boolean;
}

export default function MentionToken({
  displayName,
  userId,
  onRemove,
  isEditing = false,
  isCurrentUserMentioned = false
}: MentionTokenProps) {
  const [isHovered, setIsHovered] = useState(false);

  if (!isEditing) {
    // 显示模式：高亮显示提及
    const tokenClass = isCurrentUserMentioned
      ? 'inline-block px-1.5 py-0.5 mx-0.5 rounded bg-blue-500/30 text-blue-300 font-semibold border border-blue-400 shadow-sm'
      : 'inline-block px-1.5 py-0.5 mx-0.5 rounded bg-blue-500/20 text-blue-400 font-medium border border-blue-500/30';

    return (
      <span
        className={tokenClass}
        title={`Mentioned: ${displayName}`}
      >
        @{displayName}
      </span>
    );
  }

  // 编辑模式：可删除的 Token
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 mx-0.5 rounded bg-[#1164A3] text-white text-sm font-medium border border-blue-400"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className="text-blue-100">@{displayName}</span>
      {isHovered && (
        <button
          onClick={onRemove}
          className="p-0.5 hover:bg-blue-600 rounded transition-colors"
          aria-label="Remove mention"
        >
          <X size={14} />
        </button>
      )}
      {/* 隐藏的输入框用于光标定位 */}
      <input
        type="text"
        value={`@{${userId}:${displayName}}`}
        readOnly
        className="opacity-0 absolute pointer-events-none w-0 h-0"
        tabIndex={-1}
      />
    </span>
  );
}

/**
 * Token 化提及文本
 * 将 @{displayName} 转换为特殊的标记格式，用于后端解析
 */
export function createMentionToken(userId: string, displayName: string): string {
  // 使用特殊格式：@{userId:displayName}
  return `@{${userId}:${displayName}}`;
}

/**
 * 解析提及 Token
 * 从特殊标记中提取 userId 和 displayName
 */
export function parseMentionToken(token: string): { userId: string; displayName: string } | null {
  const match = token.match(/@\{([^:]+):([^}]+)\}/);
  if (match) {
    return {
      userId: match[1],
      displayName: match[2]
    };
  }
  return null;
}

/**
 * 检查文本是否包含 Token
 */
export function containsMentionTokens(text: string): boolean {
  return /@\{[^:]+:[^}]+\}/.test(text);
}

/**
 * 提取所有提及 Token
 */
export function extractMentionTokens(text: string): string[] {
  const tokens = text.match(/@\{[^:]+:[^}]+\}/g);
  return tokens || [];
}

/**
 * 从 Token 化文本中提取用户名（用于显示）
 */
export function extractDisplayNames(text: string): string[] {
  const tokens = text.match(/@\{[^:]+:([^}]+)\}/g);
  if (!tokens) return [];
  return tokens.map(token => {
    const match = token.match(/@\{[^:]+:([^}]+)\}/);
    return match ? match[1] : '';
  });
}
