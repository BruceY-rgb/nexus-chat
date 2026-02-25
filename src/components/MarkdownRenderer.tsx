'use client';

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import rehypeRaw from 'rehype-raw';
import { TeamMember } from '@/types';
import { MarkdownProcessor } from '@/lib/markdown';
import MentionToken from './MentionToken';
import { Copy } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  members?: TeamMember[];
  currentUserId: string;
  className?: string;
  variant?: 'dark' | 'light';
}

/**
 * Emoji text rendering component
 * Supports Jumboji effect (large size for pure Emoji messages)
 * and medium size Emoji in mixed text
 */
const EmojiText = ({ text }: { text: string }) => {
  // Match Emoji characters from various Unicode ranges
  // Including: Basic Multilingual Plane, Supplementary Multilingual Plane, Miscellaneous Symbols, Emoticons, etc.
  const emojiRegex = /(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji})/gu;

  // Check if it's pure Emoji text (after removing spaces and newlines)
  const isPureEmoji = text.replace(/\s/g, '').match(/^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji})+$/u);

  if (isPureEmoji) {
    // Pure Emoji message: unified 14px font size
    return (
      <span style={{ fontSize: '14px', lineHeight: '1.5' }}>
        {text}
      </span>
    );
  }

  // Mixed text: split by character and render
  const parts = [...text];

  return (
    <>
      {parts.map((char, index) => {
        const isEmoji = emojiRegex.test(char);
        if (isEmoji) {
          // Reset regex state
          emojiRegex.lastIndex = 0;
          // Emoji character: unified 14px font size
          return (
            <span
              key={index}
              style={{
                fontSize: '14px',
                verticalAlign: 'middle',
                lineHeight: '1.5'
              }}
            >
              {char}
            </span>
          );
        }
        // Normal text character: unified 14px font size
        return (
          <span key={index} style={{ fontSize: '14px', lineHeight: '1.5' }}>
            {char}
          </span>
        );
      })}
    </>
  );
};

export default function MarkdownRenderer({
  content,
  members = [],
  currentUserId,
  className = '',
  variant = 'dark'
}: MarkdownRendererProps) {
  // Set colors based on variant
  const colors = variant === 'light' ? {
    text: 'text-black',
    textMuted: 'text-gray-600',
    textLight: 'text-gray-700',
    bg: 'bg-gray-100',
    bgLight: 'bg-gray-50',
    border: 'border-gray-300',
  } : {
    text: 'text-gray-200',
    textMuted: 'text-gray-400',
    textLight: 'text-gray-300',
    bg: 'bg-gray-800',
    bgLight: 'bg-gray-900',
    border: 'border-gray-600',
  };

  // Preprocess: convert Slack format markup, then protect Token @mentions
  const protectedContent = useMemo(() => {
    let processed = content || '';
    // Convert Slack format (<url|label>, <@UXXXX>, &amp; etc.) to standard markdown
    // Pass members to enable user ID → username mapping
    if (MarkdownProcessor.hasSlackFormat(processed)) {
      processed = MarkdownProcessor.convertSlackFormat(processed, members);
    }
    return MarkdownProcessor.protectTokens(processed);
  }, [content, members]);

  /**
   * Process React children from ReactMarkdown, replacing any
   * [[MENTION_TOKEN:userId:displayName]] text segments with MentionToken components.
   * This is needed because ReactMarkdown renders plain text as text nodes inside <p>,
   * not as <span> elements, so the span handler never fires for mention tokens.
   */
  const processMentionTokens = (children: React.ReactNode): React.ReactNode => {
    return React.Children.map(children, (child) => {
      if (typeof child === 'string') {
        const tokenPattern = /\[\[MENTION_TOKEN:([^:]+):([^\]]+)\]\]/g;
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        let match;

        while ((match = tokenPattern.exec(child)) !== null) {
          // Text before the token
          if (match.index > lastIndex) {
            parts.push(child.slice(lastIndex, match.index));
          }
          // The mention token
          const userId = match[1];
          const displayName = match[2];
          // First try to match by slackUserId, then fall back to id
          const member = members.find(m => m.slackUserId === userId || m.id === userId);
          const actualDisplayName = member?.displayName || displayName;
          parts.push(
            <MentionToken
              key={`mention-${match.index}`}
              userId={userId}
              displayName={actualDisplayName}
              isCurrentUserMentioned={userId === currentUserId}
              onRemove={() => {}}
              isEditing={false}
            />
          );
          lastIndex = match.index + match[0].length;
        }

        if (parts.length === 0) {
          return child; // No tokens found, return original string
        }
        // Remaining text after last token
        if (lastIndex < child.length) {
          parts.push(child.slice(lastIndex));
        }
        return <>{parts}</>;
      }
      // If it's a React element, recurse into its children
      if (React.isValidElement(child) && child.props.children) {
        return React.cloneElement(child, {
          ...child.props,
          children: processMentionTokens(child.props.children),
        });
      }
      return child;
    });
  };

  // Smart detection for Markdown syntax
  const hasMarkdownSyntax = useMemo(() => {
    return MarkdownProcessor.hasMarkdownSyntax(protectedContent);
  }, [protectedContent]);

  // Always render content, whether plain text or Markdown
  // Plain text will display normally, Markdown syntax will be correctly formatted

  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize, rehypeRaw]}
        components={{
          // Support HTML tags (e.g., <u> underline)
          u: ({ node, children, ...props }) => {
            const uColor = variant === 'light' ? 'decoration-gray-500' : 'decoration-gray-400';
            return (
              <u className={`underline ${uColor} decoration-2`} {...props}>
                {children}
              </u>
            );
          },
          // Code block component
          code: ({ node, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const isInline = !language;

            // Code block colors
            const codeColors = variant === 'light' ? {
              bg: 'bg-gray-100',
              text: 'text-gray-800',
              headerBg: 'bg-gray-200',
              headerText: 'text-gray-700',
              inlineBg: 'bg-gray-100',
              inlineText: 'text-red-500',
            } : {
              bg: 'bg-gray-800',
              text: 'text-gray-100',
              headerBg: 'bg-gray-800',
              headerText: 'text-gray-300',
              inlineBg: 'bg-gray-800',
              inlineText: 'text-pink-400',
            };

            if (!isInline && language) {
              // Multi-line code block
              return (
                <div className="relative group my-3">
                  <div className={`flex items-center justify-between ${codeColors.headerBg} ${codeColors.headerText} px-4 py-2 rounded-t-lg text-xs`}>
                    <span className="font-medium">{language}</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(String(children))}
                      className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-white flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-600"
                      title="Copy code"
                    >
                      <Copy size={14} />
                      Copy
                    </button>
                  </div>
                  <pre className={`${codeColors.bg} ${codeColors.text} p-4 rounded-b-lg overflow-x-auto text-sm font-mono`}>
                    <code {...props}>{children}</code>
                  </pre>
                </div>
              );
            }

            // Inline code
            return (
              <code
                className={`${codeColors.inlineBg} ${codeColors.inlineText} px-1.5 py-0.5 rounded text-sm font-mono`}
                {...props}
              >
                {children}
              </code>
            );
          },

          // Link component
          a: ({ node, href, children, ...props }) => {
            const linkColors = variant === 'light'
              ? 'text-blue-600 hover:text-blue-800'
              : 'text-blue-400 hover:text-blue-300';
            return (
              <a
                href={href}
                className={`${linkColors} underline transition-colors`}
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              >
                {children}
              </a>
            );
          },

          // Blockquote component
          blockquote: ({ node, children, ...props }) => (
            <blockquote
              className={`border-l-4 ${colors.border} pl-4 italic ${colors.textLight} my-2 ${colors.bgLight} py-2`}
              {...props}
            >
              {processMentionTokens(children)}
            </blockquote>
          ),

          // Heading components
          h1: ({ node, children, ...props }) => (
            <h1 className={`text-xl font-bold mt-4 mb-2 ${colors.text}`} {...props}>{children}</h1>
          ),
          h2: ({ node, children, ...props }) => (
            <h2 className={`text-lg font-bold mt-4 mb-2 ${colors.text}`} {...props}>{children}</h2>
          ),
          h3: ({ node, children, ...props }) => (
            <h3 className={`text-base font-bold mt-3 mb-2 ${colors.text}`} {...props}>{children}</h3>
          ),

          // Table components
          table: ({ node, children, ...props }) => (
            <div className="overflow-x-auto my-3">
              <table className={`min-w-full border ${colors.border}`} {...props}>
                {children}
              </table>
            </div>
          ),

          thead: ({ node, children, ...props }) => (
            <thead className={colors.bg} {...props}>
              {children}
            </thead>
          ),

          tbody: ({ node, children, ...props }) => (
            <tbody className={colors.bgLight} {...props}>
              {children}
            </tbody>
          ),

          th: ({ node, ...props }) => (
            <th
              className={`border ${colors.border} ${colors.bg} px-4 py-2 text-left text-sm font-semibold ${colors.text}`}
              {...props}
            />
          ),

          td: ({ node, ...props }) => (
            <td
              className={`border ${colors.border} px-4 py-2 text-sm ${colors.text}`}
              {...props}
            />
          ),

          // List components
          ul: ({ node, children, ...props }) => {
            return (
              <ul className="list-disc list-inside space-y-1 my-2 ml-4" {...props}>
                {children}
              </ul>
            );
          },

          ol: ({ node, children, ...props }) => (
            <ol className="list-decimal list-inside space-y-1 my-2 ml-4" {...props}>
              {children}
            </ol>
          ),

          li: ({ node, children, ...props }) => (
            <li className={`${colors.text} text-sm leading-relaxed`} {...props}>
              {processMentionTokens(children)}
            </li>
          ),

          // Paragraph component
          p: ({ node, children, ...props }) => (
            <p className={`${colors.text} text-sm leading-relaxed mb-2`} {...props}>
              {processMentionTokens(children)}
            </p>
          ),

          // Strong emphasis component
          strong: ({ node, children, ...props }) => (
            <strong className={`font-bold ${colors.text}`} {...props}>
              {processMentionTokens(children)}
            </strong>
          ),

          em: ({ node, children, ...props }) => (
            <em className={`italic ${colors.textLight}`} {...props}>
              {processMentionTokens(children)}
            </em>
          ),

          // Strikethrough component
          s: ({ node, children, ...props }) => (
            <s className={`line-through ${colors.textMuted}`} {...props}>
              {children}
            </s>
          ),

          // Emoji handling for span elements
          span: ({ node, children, ...props }) => {
            const text = String(children);
            // Check if contains Emoji
            if (/(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji})/u.test(text)) {
              return (
                <span {...props}>
                  <EmojiText text={text} />
                </span>
              );
            }
            return <span {...props}>{children}</span>;
          },
        }}
      >
        {protectedContent}
      </ReactMarkdown>
    </div>
  );
}
