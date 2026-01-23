/**
 * 解析消息内容中的 @提及
 * 支持格式：
 * 1. Token 格式：@{userId:displayName}
 * 2. 传统格式：@username 或 @displayName
 */

export interface ParsedMention {
  mentionText: string; // 完整的提及文本
  userId?: string; // Token 格式中的 userId
  displayName: string; // 显示名称
  startIndex: number;
  endIndex: number;
}

/**
 * 从消息内容中提取所有 @提及
 * @param content 消息内容
 * @returns 提及列表
 */
export function parseMentions(content: string): ParsedMention[] {
  const mentions: ParsedMention[] = [];

  // 首先匹配 Token 格式：@{userId:displayName}
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

  // 然后匹配传统格式：@username 或 @displayName（避免重复匹配 Token）
  const traditionalPattern = /@([a-zA-Z0-9._-]+)/g;
  let traditionalMatch: RegExpExecArray | null;
  while ((traditionalMatch = traditionalPattern.exec(content)) !== null) {
    const mentionText = traditionalMatch[0];
    const displayName = traditionalMatch[1];

    // 检查是否已经是 Token 格式
    if (mentionText.includes('{')) {
      continue;
    }

    // 避免重复添加
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

  // 按出现顺序排序
  return mentions.sort((a, b) => a.startIndex - b.startIndex);
}

/**
 * 检查消息内容是否包含 @提及
 * @param content 消息内容
 * @returns 是否包含提及
 */
export function hasMentions(content: string): boolean {
  return /@\{[^:]+:[^}]+\}|@[a-zA-Z0-9._-]+/.test(content);
}

/**
 * 从提及列表中提取用户名
 * @param mentions 提及列表
 * @returns 用户名数组
 */
export function extractUsernames(mentions: ParsedMention[]): string[] {
  return mentions.map(m => m.displayName);
}

/**
 * 从 Token 格式中提取 userId
 * @param mentions 提及列表
 * @returns userId 数组
 */
export function extractUserIds(mentions: ParsedMention[]): string[] {
  return mentions
    .filter(m => m.userId)
    .map(m => m.userId!);
}

/**
 * 将 Token 格式的提及转换为传统格式
 * @param content 消息内容
 * @returns 转换后的内容
 */
export function convertTokensToTraditionalFormat(content: string): string {
  return content.replace(/@\{([^:]+):([^}]+)\}/g, '@$2');
}

/**
 * 从传统格式中提取 displayName
 * @param content 消息内容
 * @returns displayName 数组
 */
export function extractDisplayNamesFromTraditional(content: string): string[] {
  const mentions = parseMentions(content);
  return mentions
    .filter(m => !m.userId)
    .map(m => m.displayName);
}

/**
 * 验证 Token 格式是否有效
 * @param token 要验证的 Token
 * @returns 是否有效
 */
export function isValidMentionToken(token: string): boolean {
  return /^@\{[a-zA-Z0-9-]+:[^}]+\}$/.test(token);
}
