'use client';

import React, { useMemo, useState } from 'react';
import hljs from '@/lib/highlight';
import { Copy, Check, Eye, EyeOff } from 'lucide-react';

interface CodeBlockProps {
  language: string;
  code: string;
  showLineNumbers?: boolean;
  className?: string;
}

export default function CodeBlock({
  language,
  code,
  showLineNumbers = true,
  className = ''
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [showLineNumbersState, setShowLineNumbers] = useState(showLineNumbers);

  // 高亮代码
  const highlightedCode = useMemo(() => {
    try {
      if (language && language.toLowerCase() !== 'auto') {
        return hljs.highlight(code, { language: language.toLowerCase() }).value;
      }
      return hljs.highlightAuto(code).value;
    } catch (error) {
      console.error('Syntax highlighting error:', error);
      return code;
    }
  }, [code, language]);

  // 复制代码
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  // 生成行号
  const lines = highlightedCode.split('\n');
  const lineNumbers = Array.from({ length: lines.length }, (_, i) => i + 1);

  return (
    <div className={`relative group my-3 ${className}`}>
      {/* 代码块头部 */}
      <div className="flex items-center justify-between bg-gray-800 text-gray-300 px-4 py-2 rounded-t-lg border-b border-gray-700" style={{ fontSize: '14px' }}>
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-200">
            {language || 'auto-detected'}
          </span>
          <span className="text-gray-500">
            {lines.length} 行
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLineNumbers(!showLineNumbersState)}
            className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-white p-1 rounded hover:bg-gray-700"
            title={showLineNumbersState ? '隐藏行号' : '显示行号'}
          >
            {showLineNumbersState ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button
            onClick={handleCopy}
            className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-white px-2 py-1 rounded hover:bg-gray-700 flex items-center gap-1"
            title="复制代码"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? '已复制' : '复制'}
          </button>
        </div>
      </div>

      {/* 代码内容 */}
      <div className="bg-gray-900 rounded-b-lg overflow-hidden">
        <div className="flex">
          {/* 行号 */}
          {showLineNumbersState && (
            <div className="flex flex-col text-gray-600 font-mono select-none bg-gray-800 px-3 py-4 border-r border-gray-700" style={{ fontSize: '14px' }}>
              {lineNumbers.map((num) => (
                <span
                  key={num}
                  className="leading-6 text-right"
                  style={{ minWidth: '2rem' }}
                >
                  {num}
                </span>
              ))}
            </div>
          )}

          {/* 代码 */}
          <div className="flex-1 overflow-x-auto">
            <pre className="p-4 text-sm font-mono text-gray-100 leading-6">
              <code
                className="block"
                dangerouslySetInnerHTML={{ __html: highlightedCode }}
              />
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 行内代码组件
 */
export const InlineCode = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
  return (
    <code className={`bg-gray-800 text-pink-400 px-1.5 py-0.5 rounded text-sm font-mono ${className}`}>
      {children}
    </code>
  );
};

/**
 * 代码块容器组件（用于渲染完整的多行代码块）
 */
export const PreBlock = ({ children }: { children: React.ReactNode }) => {
  return <div className="my-3">{children}</div>;
};
