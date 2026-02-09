import { TeamMember } from '@/types';

export class MarkdownProcessor {
  /**
   * 预处理消息内容，保护Token格式@提及
   * 将 @{userId:displayName} 格式临时替换为标记，便于后续处理
   */
  static protectTokens(content: string): string {
    return content.replace(/@\{([^:]+):([^}]+)\}/g, '[[MENTION_TOKEN:$1:$2]]');
  }

  /**
   * 还原Token格式@提及（如果需要的话）
   * 将 [[MENTION_TOKEN:userId:displayName]] 格式还原为显示文本
   */
  static restoreTokens(content: string, members: TeamMember[] = []): string {
    return content.replace(/\[\[MENTION_TOKEN:([^:]+):([^\]]+)\]\]/g, (match, userId, displayName) => {
      const member = members.find(m => m.id === userId);
      const actualDisplayName = member?.displayName || displayName;
      return `@${actualDisplayName}`;
    });
  }

  /**
   * 检测是否包含Markdown语法
   * 检查常见的Markdown标记符
   */
  static hasMarkdownSyntax(content: string): boolean {
    // 检测常见Markdown语法：粗体、斜体、代码、标题、引用、列表、链接
    return /\*\*|\*|`|#|>|-\s|\[|\(https?:\/\//.test(content);
  }

  /**
   * 智能检测是否应该使用Markdown渲染
   * 优先考虑现有Token格式的存在
   * 规则：
   * 1. 如果包含Token格式且没有其他Markdown语法，回退到现有渲染
   * 2. 如果包含其他Markdown语法，使用Markdown渲染
   */
  static shouldUseMarkdown(content: string): boolean {
    // 如果包含Token格式且没有其他Markdown语法，回退到现有渲染
    if (/@\{[^}]+\}/.test(content) && !this.hasMarkdownSyntax(content)) {
      return false;
    }
    return this.hasMarkdownSyntax(content);
  }

  /**
   * 提取Token信息
   * 用于在自定义组件中处理Token
   */
  static extractToken(text: string): { userId: string; displayName: string } | null {
    const match = text.match(/\[\[MENTION_TOKEN:([^:]+):([^\]]+)\]\]/);
    if (match) {
      return {
        userId: match[1],
        displayName: match[2]
      };
    }
    return null;
  }

  /**
   * 清理内容，移除Token保护标记
   */
  static cleanProtectedTokens(content: string): string {
    return content.replace(/\[\[MENTION_TOKEN:[^\]]+\]\]/g, '');
  }
}
