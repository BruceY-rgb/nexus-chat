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
}

/**
 * Emoji文本渲染组件
 * 支持Jumboji效果（纯Emoji消息大尺寸显示）
 * 和混合文本中的中等尺寸Emoji
 */
const EmojiText = ({ text }: { text: string }) => {
  // 匹配各种Unicode范围的Emoji字符
  // 包括：基本多语言平面、补充多语言平面、杂项符号、表情符号等
  const emojiRegex = /(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji})/gu;

  // 检查是否是纯Emoji文本（去除空格和换行后）
  const isPureEmoji = text.replace(/\s/g, '').match(/^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji})+$/u);

  if (isPureEmoji) {
    // 纯Emoji消息：统一14px字体大小
    return (
      <span style={{ fontSize: '14px', lineHeight: '1.5' }}>
        {text}
      </span>
    );
  }

  // 混合文本：按字符分割并渲染
  const parts = [...text];

  return (
    <>
      {parts.map((char, index) => {
        const isEmoji = emojiRegex.test(char);
        if (isEmoji) {
          // 重置正则状态
          emojiRegex.lastIndex = 0;
          // Emoji字符：统一14px字体大小
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
        // 普通文本字符：统一14px字体大小
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
  className = ''
}: MarkdownRendererProps) {
  console.log("[MarkdownRenderer] Received members:", members);
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

  // 智能检测是否包含Markdown语法
  const hasMarkdownSyntax = useMemo(() => {
    return MarkdownProcessor.hasMarkdownSyntax(protectedContent);
  }, [protectedContent]);

  // 总是渲染内容，无论是普通文本还是Markdown
  // 普通文本会正常显示，Markdown语法会被正确格式化

  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize, rehypeRaw]}
        components={{
          // 支持HTML标签（如<u>下划线）
          u: ({ node, children, ...props }) => (
            <u className="underline decoration-gray-400 decoration-2" {...props}>
              {children}
            </u>
          ),
          // 代码块组件
          code: ({ node, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const isInline = !language;

            if (!isInline && language) {
              // 多行代码块
              return (
                <div className="relative group my-3">
                  <div className="flex items-center justify-between bg-gray-800 text-gray-300 px-4 py-2 rounded-t-lg text-xs">
                    <span className="font-medium">{language}</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(String(children))}
                      className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-white flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-700"
                      title="Copy code"
                    >
                      <Copy size={14} />
                      Copy
                    </button>
                  </div>
                  <pre className="bg-gray-800 text-gray-100 p-4 rounded-b-lg overflow-x-auto text-sm font-mono">
                    <code {...props}>{children}</code>
                  </pre>
                </div>
              );
            }

            // 行内代码
            return (
              <code
                className="bg-gray-800 text-pink-400 px-1.5 py-0.5 rounded text-sm font-mono"
                {...props}
              >
                {children}
              </code>
            );
          },

          // 链接组件
          a: ({ node, href, children, ...props }) => (
            <a
              href={href}
              className="text-blue-400 hover:text-blue-300 underline transition-colors"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            >
              {children}
            </a>
          ),

          // 引用组件
          blockquote: ({ node, children, ...props }) => (
            <blockquote
              className="border-l-4 border-gray-600 pl-4 italic text-gray-300 my-2 bg-gray-800/50 py-2"
              {...props}
            >
              {processMentionTokens(children)}
            </blockquote>
          ),

          // 标题组件
          h1: ({ node, children, ...props }) => (
            <h1 className="text-xl font-bold mt-4 mb-2 text-white" {...props}>{children}</h1>
          ),
          h2: ({ node, children, ...props }) => (
            <h2 className="text-lg font-bold mt-4 mb-2 text-white" {...props}>{children}</h2>
          ),
          h3: ({ node, children, ...props }) => (
            <h3 className="text-base font-bold mt-3 mb-2 text-white" {...props}>{children}</h3>
          ),

          // 表格组件
          table: ({ node, children, ...props }) => (
            <div className="overflow-x-auto my-3">
              <table className="min-w-full border border-gray-600" {...props}>
                {children}
              </table>
            </div>
          ),

          thead: ({ node, children, ...props }) => (
            <thead className="bg-gray-800" {...props}>
              {children}
            </thead>
          ),

          tbody: ({ node, children, ...props }) => (
            <tbody className="bg-gray-900/50" {...props}>
              {children}
            </tbody>
          ),

          th: ({ node, ...props }) => (
            <th
              className="border border-gray-600 bg-gray-800 px-4 py-2 text-left text-sm font-semibold text-gray-200"
              {...props}
            />
          ),

          td: ({ node, ...props }) => (
            <td
              className="border border-gray-600 px-4 py-2 text-sm text-gray-300"
              {...props}
            />
          ),

          // 列表组件
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
            <li className="text-gray-200 text-sm leading-relaxed" {...props}>
              {processMentionTokens(children)}
            </li>
          ),

          // 段落组件
          p: ({ node, children, ...props }) => (
            <p className="text-gray-200 text-sm leading-relaxed mb-2" {...props}>
              {processMentionTokens(children)}
            </p>
          ),

          // 强调组件
          strong: ({ node, children, ...props }) => (
            <strong className="font-bold text-white" {...props}>
              {processMentionTokens(children)}
            </strong>
          ),

          em: ({ node, children, ...props }) => (
            <em className="italic text-gray-300" {...props}>
              {processMentionTokens(children)}
            </em>
          ),

          // 删除线组件
          s: ({ node, children, ...props }) => (
            <s className="line-through text-gray-500" {...props}>
              {children}
            </s>
          ),

          // Emoji handling for span elements
          span: ({ node, children, ...props }) => {
            const text = String(children);
            // 检查是否包含Emoji
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
