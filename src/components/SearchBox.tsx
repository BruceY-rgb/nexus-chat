'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDebounce } from '@/hooks/useDebounce';
import { Search, Hash, MessageSquare, X } from 'lucide-react';

interface SearchResult {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
  type: 'channel' | 'dm';
  channel?: {
    id: string;
    name: string;
  };
  dmConversation?: {
    id: string;
    participants: Array<{
      id: string;
      displayName: string;
    }>;
  };
}

interface SearchBoxProps {
  className?: string;
}

export default function SearchBox({ className = '' }: SearchBoxProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 防抖处理
  const debouncedQuery = useDebounce(query, 500);

  // 执行搜索
  useEffect(() => {
    const searchMessages = async () => {
      if (!debouncedQuery.trim()) {
        setResults([]);
        setShowResults(false);
        return;
      }

      try {
        setIsSearching(true);
        const response = await fetch(`/api/messages/search?query=${encodeURIComponent(debouncedQuery)}`, {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          setResults(data.results || []);
          setShowResults(true);
          setSelectedIndex(-1);
        }
      } catch (error) {
        console.error('搜索失败:', error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    searchMessages();
  }, [debouncedQuery]);

  // 点击外部关闭结果
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 高亮搜索关键词
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;

    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <span key={index} className="bg-yellow-200 text-yellow-900 px-0.5 rounded">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  // 格式化时间
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      return `${diffInMinutes}分钟前`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}小时前`;
    } else {
      return date.toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  // 获取对话显示名称
  const getDmDisplayName = (result: SearchResult) => {
    if (result.type !== 'dm' || !result.dmConversation) return '';
    const participants = result.dmConversation.participants;
    if (participants.length === 1) {
      return participants[0].displayName;
    }
    return participants.map(p => p.displayName).join(', ');
  };

  // 跳转到消息
  const navigateToMessage = (result: SearchResult) => {
    if (result.type === 'channel') {
      // 跳转到频道
      router.push(`/dashboard?channel=${result.channel?.id}&messageId=${result.id}`);
    } else if (result.type === 'dm') {
      // 跳转到 DM
      const participantId = result.dmConversation?.participants[0]?.id;
      if (participantId) {
        router.push(`/dm/${participantId}?messageId=${result.id}`);
      }
    }
    setShowResults(false);
    setQuery('');
  };

  // 键盘导航
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          navigateToMessage(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowResults(false);
        inputRef.current?.blur();
        break;
    }
  };

  // 清除搜索
  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    setSelectedIndex(-1);
  };

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      {/* 搜索输入框 */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query && setShowResults(true)}
          placeholder="搜索消息..."
          className="w-full pl-10 pr-10 py-2 bg-white/5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
          >
            <X size={16} />
          </button>
        )}
        {isSearching && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* 搜索结果 */}
      {showResults && (results.length > 0 || isSearching) && (
        <div className="absolute top-full mt-2 w-full bg-background-elevated border border-border rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          {isSearching ? (
            <div className="p-4 text-center text-text-secondary">
              <div className="inline-block w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin mr-2" />
              搜索中...
            </div>
          ) : results.length > 0 ? (
            <>
              <div className="p-2 text-xs font-medium text-text-secondary border-b border-border">
                搜索结果 ({results.length})
              </div>
              <div className="py-2">
                {results.map((result, index) => (
                  <div
                    key={result.id}
                    onClick={() => navigateToMessage(result)}
                    className={`px-4 py-3 cursor-pointer transition-colors ${
                      index === selectedIndex
                        ? 'bg-primary/10'
                        : 'hover:bg-background-component'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* 图标 */}
                      <div className="flex-shrink-0 mt-1">
                        {result.type === 'channel' ? (
                          <div className="w-8 h-8 rounded-sm bg-[#1164A3] flex items-center justify-center">
                            <Hash size={16} className="text-white" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                            <MessageSquare size={16} className="text-primary" />
                          </div>
                        )}
                      </div>

                      {/* 内容 */}
                      <div className="flex-1 min-w-0">
                        {/* 顶部信息 */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-text-primary">
                            {result.type === 'channel'
                              ? `#${result.channel?.name}`
                              : getDmDisplayName(result)}
                          </span>
                          <span className="text-xs text-text-tertiary">•</span>
                          <span className="text-xs text-text-tertiary">
                            {result.user.displayName}
                          </span>
                          <span className="text-xs text-text-tertiary">•</span>
                          <span className="text-xs text-text-tertiary">
                            {formatTime(result.createdAt)}
                          </span>
                        </div>

                        {/* 消息内容 */}
                        <div className="text-sm text-text-secondary line-clamp-2">
                          {highlightText(result.content, query)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="p-4 text-center text-text-secondary">
              未找到匹配的消息
            </div>
          )}
        </div>
      )}
    </div>
  );
}
