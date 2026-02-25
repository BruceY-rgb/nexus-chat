'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useDebounce } from '@/hooks/useDebounce';
import { Search, X, Hash, MessageSquare } from 'lucide-react';
import SearchFilterPanel from './SearchFilterPanel';

interface SearchFilters {
  userId: string | null;
  startDate: string | null;
  endDate: string | null;
}

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

interface SearchMessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelId?: string;
  dmConversationId?: string;
  contextName?: string; // Used to display search context, like "#general" or "Zhang San"
}

export default function SearchMessagesModal({
  isOpen,
  onClose,
  channelId,
  dmConversationId,
  contextName
}: SearchMessagesModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [filters, setFilters] = useState<SearchFilters>({
    userId: null,
    startDate: null,
    endDate: null
  });
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce handling
  const debouncedQuery = useDebounce(query, 300);

  // Auto-focus input
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Execute search
  useEffect(() => {
    const searchMessages = async () => {
      // Check if search needs to be executed: has keyword or filter conditions
      const hasQuery = debouncedQuery.trim();
      const hasFilters = filters.userId || filters.startDate || filters.endDate;

      if (!hasQuery && !hasFilters) {
        setResults([]);
        setSelectedIndex(-1);
        return;
      }

      try {
        setIsSearching(true);
        const params = new URLSearchParams();

        // Only add query parameter when there's a search keyword
        if (hasQuery) {
          params.append('query', debouncedQuery);
        }

        // Add search scope limit (channel or DM)
        if (channelId) {
          params.append('channelId', channelId);
        }
        if (dmConversationId) {
          params.append('dmConversationId', dmConversationId);
        }

        // Add filter parameters
        if (filters.userId) {
          params.append('userId', filters.userId);
        }
        if (filters.startDate) {
          params.append('startDate', filters.startDate);
        }
        if (filters.endDate) {
          params.append('endDate', filters.endDate);
        }

        const response = await fetch(`/api/messages/search?${params.toString()}`, {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          setResults(data.results || []);
          setSelectedIndex(-1);
        }
      } catch (error) {
        console.error('Search failed:', error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    searchMessages();
  }, [debouncedQuery, filters]);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!results.length && !isSearching) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < results.length - 1 ? prev + 1 : prev
        );
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
        e.preventDefault();
        onClose();
        break;
    }
  };

  // Highlight search keywords
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

  // Format time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  // Get conversation display name
  const getDmDisplayName = (result: SearchResult) => {
    if (result.type !== 'dm' || !result.dmConversation) return '';
    const participants = result.dmConversation.participants;
    if (participants.length === 1) {
      return participants[0].displayName;
    }
    return participants.map(p => p.displayName).join(', ');
  };

  // Navigate to message
  const navigateToMessage = (result: SearchResult) => {
    if (result.type === 'channel' && result.channel) {
      router.push(`/dashboard?channel=${result.channel.id}&messageId=${result.id}`);
    } else if (result.type === 'dm') {
      const participantId = result.dmConversation?.participants[0]?.id;
      if (participantId) {
        router.push(`/dm/${participantId}?messageId=${result.id}`);
      }
    }
    onClose();
    setQuery('');
  };

  // Clear search
  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setSelectedIndex(-1);
    setFilters({
      userId: null,
      startDate: null,
      endDate: null
    });
    inputRef.current?.focus();
  };

  // Close modal
  const handleClose = () => {
    onClose();
    setQuery('');
    setResults([]);
    setSelectedIndex(-1);
    setFilters({
      userId: null,
      startDate: null,
      endDate: null
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Background overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal content */}
      <div
        ref={searchRef}
        className="relative w-full max-w-2xl mx-4 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden"
      >
        {/* Top title bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Search messages</h2>
            {contextName && (
              <p className="text-sm text-gray-500 mt-0.5">
                Search in the {contextName}
              </p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Search input */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search for messages..."
              className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900"
            />
            {query && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={18} />
              </button>
            )}
            {isSearching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Main content: left filter + right search results */}
        <div className="flex h-96">
          {/* Left filter panel */}
          <SearchFilterPanel
            filters={filters}
            onFiltersChange={setFilters}
            contextType={channelId ? 'channel' : dmConversationId ? 'dm' : 'global'}
            channelId={channelId}
          />

          {/* Search results */}
          <div className="flex-1 overflow-y-auto border-l border-gray-200">
          {isSearching ? (
            <div className="p-8 text-center text-gray-500">
              <div className="inline-block w-5 h-5 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin mr-2" />
              Searching...
            </div>
          ) : results.length > 0 ? (
            <div className="py-2">
              <div className="px-4 py-2 text-xs font-medium text-gray-500 border-b border-gray-200">
                Search results ({results.length})
              </div>
              <div className="divide-y divide-gray-200">
                {results.map((result, index) => (
                  <div
                    key={result.id}
                    onClick={() => navigateToMessage(result)}
                    className={`px-4 py-3 cursor-pointer transition-colors ${
                      index === selectedIndex
                        ? 'bg-blue-50'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className="flex-shrink-0 mt-1">
                        {result.type === 'channel' ? (
                          <div className="w-8 h-8 rounded-sm bg-[#1164A3] flex items-center justify-center">
                            <Hash size={16} className="text-white" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <MessageSquare size={16} className="text-blue-600" />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Top info */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-900">
                            {result.type === 'channel'
                              ? `#${result.channel?.name}`
                              : getDmDisplayName(result)}
                          </span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-500">
                            {result.user.displayName}
                          </span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-500">
                            {formatTime(result.createdAt)}
                          </span>
                        </div>

                        {/* Message content */}
                        <div className="text-sm text-gray-600 line-clamp-2">
                          {highlightText(result.content, query)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : query.trim() ? (
            <div className="p-8 text-center text-gray-500">
              No results found for "{query}"
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400">
              Enter a keyword to search messages
            </div>
          )}
          </div>
        </div>

        {/* Bottom hint */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
          <div className="flex items-center justify-between">
            <span>Use ↑↓ keys to select, Enter to jump</span>
            <span>Esc to close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
