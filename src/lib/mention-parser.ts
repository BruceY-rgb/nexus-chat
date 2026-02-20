/**
 * Parse @mentions in message content
 * Supports formats:
 * 1. Token format: @{userId:displayName}
 * 2. Traditional format: @username or @displayName
 */

export interface ParsedMention {
  mentionText: string; // Complete mention text
  userId?: string; // userId in token format
  displayName: string; // Display name
  startIndex: number;
  endIndex: number;
}

/**
 * Extract all @mentions from message content
 * @param content Message content
 * @returns List of mentions
 */
export function parseMentions(content: string): ParsedMention[] {
  const mentions: ParsedMention[] = [];

  // First match token format: @{userId:displayName}
  const tokenPattern = /@\{([^:]+):([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = tokenPattern.exec(content)) !== null) {
    const startIndex = match.index;
    if (startIndex !== null) {
      mentions.push({
        mentionText: match[0],
        userId: match[1],
        displayName: match[2],
        startIndex,
        endIndex: startIndex + match[0].length
      });
    }
  }

  // Then match traditional format: @username or @displayName (avoid duplicating token matches)
  const traditionalPattern = /@([a-zA-Z0-9._-]+)/g;
  let traditionalMatch: RegExpExecArray | null;
  while ((traditionalMatch = traditionalPattern.exec(content)) !== null) {
    const mentionText = traditionalMatch[0];
    const displayName = traditionalMatch[1];

    // Check if it's already in token format
    if (mentionText.includes('{')) {
      continue;
    }

    // Avoid duplicate additions
    const startIndex = traditionalMatch.index;
    if (startIndex !== null) {
      const isDuplicate = mentions.some(m => m.startIndex === startIndex);
      if (!isDuplicate) {
        mentions.push({
          mentionText,
          displayName,
          startIndex,
          endIndex: startIndex + mentionText.length
        });
      }
    }
  }

  // Sort by order of appearance
  return mentions.sort((a, b) => a.startIndex - b.startIndex);
}

/**
 * Check if message content contains @mentions
 * @param content Message content
 * @returns Whether it contains mentions
 */
export function hasMentions(content: string): boolean {
  return /@\{[^:]+:[^}]+\}|@[a-zA-Z0-9._-]+/.test(content);
}

/**
 * Extract usernames from mention list
 * @param mentions Mention list
 * @returns Array of usernames
 */
export function extractUsernames(mentions: ParsedMention[]): string[] {
  return mentions.map(m => m.displayName);
}

/**
 * Extract userId from token format
 * @param mentions Mention list
 * @returns Array of userIds
 */
export function extractUserIds(mentions: ParsedMention[]): string[] {
  return mentions
    .filter(m => m.userId)
    .map(m => m.userId!);
}

/**
 * Convert token format mentions to traditional format
 * @param content Message content
 * @returns Converted content
 */
export function convertTokensToTraditionalFormat(content: string): string {
  return content.replace(/@\{([^:]+):([^}]+)\}/g, '@$2');
}

/**
 * Extract displayNames from traditional format
 * @param content Message content
 * @returns Array of displayNames
 */
export function extractDisplayNamesFromTraditional(content: string): string[] {
  const mentions = parseMentions(content);
  return mentions
    .filter(m => !m.userId)
    .map(m => m.displayName);
}

/**
 * Validate if token format is valid
 * @param token Token to validate
 * @returns Whether it's valid
 */
export function isValidMentionToken(token: string): boolean {
  return /^@\{[a-zA-Z0-9-]+:[^}]+\}$/.test(token);
}
