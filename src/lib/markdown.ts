import { TeamMember } from "@/types";

export class MarkdownProcessor {
  /**
   * Preprocess message content, protect token format @mentions
   * Temporarily replace @{userId:displayName} format with markers for later processing
   */
  static protectTokens(content: string): string {
    return content.replace(/@\{([^:]+):([^}]+)\}/g, "[[MENTION_TOKEN:$1:$2]]");
  }

  /**
   * Restore token format @mentions (if needed)
   * Restore [[MENTION_TOKEN:userId:displayName]] format to display text
   */
  static restoreTokens(content: string, members: TeamMember[] = []): string {
    return content.replace(
      /\[\[MENTION_TOKEN:([^:]+):([^\]]+)\]\]/g,
      (match, userId, displayName) => {
        const member = members.find((m) => m.id === userId);
        const actualDisplayName = member?.displayName || displayName;
        return `@${actualDisplayName}`;
      },
    );
  }

  /**
   * Detect if it contains Markdown syntax
   * Check common Markdown markers
   */
  static hasMarkdownSyntax(content: string): boolean {
    // Detect common Markdown syntax: bold, italic, code, headings, quotes, lists, links
    return /\*\*|\*|`|#|>|-\s|\[|\(https?:\/\//.test(content);
  }

  /**
   * Smart detection if Markdown rendering should be used
   * Prioritize existing token format presence
   * Rules:
   * 1. If contains token format but no other Markdown syntax, fallback to existing rendering
   * 2. If contains other Markdown syntax, use Markdown rendering
   */
  static shouldUseMarkdown(content: string): boolean {
    // If contains token format but no other Markdown syntax, fallback to existing rendering
    if (/@\{[^}]+\}/.test(content) && !this.hasMarkdownSyntax(content)) {
      return false;
    }
    return this.hasMarkdownSyntax(content);
  }

  /**
   * Extract token information
   * Used to handle tokens in custom components
   */
  static extractToken(
    text: string,
  ): { userId: string; displayName: string } | null {
    const match = text.match(/\[\[MENTION_TOKEN:([^:]+):([^\]]+)\]\]/);
    if (match) {
      return {
        userId: match[1],
        displayName: match[2],
      };
    }
    return null;
  }

  /**
   * Clean content, remove token protection markers
   */
  static cleanProtectedTokens(content: string): string {
    return content.replace(/\[\[MENTION_TOKEN:[^\]]+\]\]/g, "");
  }
}
