import { TeamMember } from "@/types";
import { convertShortcodesToEmoji } from "./emoji";

export class MarkdownProcessor {
  /**
   * Convert Slack-format markup to standard markdown.
   * Handles:
   * - <url|label> → [label](url)
   * - <url> → [url](url)
   * - <@UXXXX> → **@username** (styled mention)
   * - &amp; &lt; &gt; → decoded HTML entities
   * - :emoji_name: → Unicode emoji
   */
  static convertSlackFormat(
    content: string,
    members: { id: string; slackUserId?: string | null; displayName: string }[] = [],
  ): string {
    if (!content) return content;

    let result = content;

    // 1. Convert Slack links: <url|label> → [label](url)
    result = result.replace(
      /<(https?:\/\/[^|>]+)\|([^>]+)>/g,
      (_, url, label) => `[${label}](${url})`,
    );

    // 2. Convert bare Slack links: <url> → [url](url)
    result = result.replace(
      /<(https?:\/\/[^>]+)>/g,
      (_, url) => `[${url}](${url})`,
    );

    // 3. Convert Slack mentions: <@UXXXX> → @{UXXXX:username} for later token processing
    // If user is found in members, use their displayName; otherwise use the ID
    result = result.replace(/<@([A-Z0-9]+)>/g, (_, slackUserId) => {
      // First try to match by slackUserId, then fall back to id
      const member = members.find(m => m.slackUserId === slackUserId || m.id === slackUserId);
      const displayName = member?.displayName || slackUserId;
      return `@{${slackUserId}:${displayName}}`;
    });

    // 4. Decode HTML entities from Slack
    result = result.replace(/&amp;/g, "&");
    result = result.replace(/&lt;/g, "<");
    result = result.replace(/&gt;/g, ">");

    // 5. Convert emoji shortcodes: :emoji_name: → Unicode emoji
    result = convertShortcodesToEmoji(result);

    return result;
  }

  /**
   * Check if content contains Slack-format markup
   */
  static hasSlackFormat(content: string): boolean {
    return /<(?:https?:\/\/|@[A-Z0-9])/.test(content) ||
      /&amp;|&lt;|&gt;/.test(content) ||
      /:[a-z0-9_+\-]+:/.test(content);
  }

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
    // If contains Slack format markup, always use Markdown rendering
    if (this.hasSlackFormat(content)) return true;
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
