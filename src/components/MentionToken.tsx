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
    // Display mode: highlight mention
    const tokenClass = isCurrentUserMentioned
      ? 'inline-block px-1.5 py-0.5 mx-0.5 rounded-full bg-blue-500/30 text-blue-300 font-semibold border border-blue-400 shadow-sm'
      : 'inline-block px-1.5 py-0.5 mx-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium border border-blue-500/30';

    return (
      <span
        className={tokenClass}
        title={`Mentioned: ${displayName}`}
      >
        @{displayName}
      </span>
    );
  }

  // Edit mode: removable Token
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
      {/* Hidden input for cursor positioning */}
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
 * Tokenize mention text
 * Convert @{displayName} to special marker format for backend parsing
 */
export function createMentionToken(userId: string, displayName: string): string {
  // Use special format: @{userId:displayName}
  return `@{${userId}:${displayName}}`;
}

/**
 * Parse mention Token
 * Extract userId and displayName from special marker
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
 * Check if text contains Token
 */
export function containsMentionTokens(text: string): boolean {
  return /@\{[^:]+:[^}]+\}/.test(text);
}

/**
 * Extract all mention Tokens
 */
export function extractMentionTokens(text: string): string[] {
  const tokens = text.match(/@\{[^:]+:[^}]+\}/g);
  return tokens || [];
}

/**
 * Extract username from tokenized text (for display)
 */
export function extractDisplayNames(text: string): string[] {
  const tokens = text.match(/@\{[^:]+:([^}]+)\}/g);
  if (!tokens) return [];
  return tokens.map(token => {
    const match = token.match(/@\{[^:]+:([^}]+)\}/);
    return match ? match[1] : '';
  });
}
