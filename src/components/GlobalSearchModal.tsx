'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useDebounce } from "@/hooks/useDebounce";
import { useGlobalSearch } from "@/hooks/GlobalSearchContext";
import { Hash, MessageSquare, FileText, Users, X, Search } from "lucide-react";

// Highlight matching text in search results
function highlightText(text: string, query: string) {
  if (!query.trim()) return text;

  try {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
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
  } catch {
    return text;
  }
}

// Global search API response
interface SearchResponse {
  query: string;
  type: string;
  results: {
    messages?: any[];
    files?: any[];
    channels?: any[];
    users?: any[];
  };
}

// Search result item for display
interface SearchItem {
  id: string;
  type: "message" | "file" | "channel" | "user" | "section";
  name: string;
  subtitle?: string;
  icon?: React.ReactNode;
  data?: any;
  rawContent?: string; // Original full content for highlight
}

export default function GlobalSearchModal() {
  const router = useRouter();
  const { isOpen, close } = useGlobalSearch();
  const [query, setQuery] = useState("");
  const [searchData, setSearchData] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(query, 300);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Fetch search results
  useEffect(() => {
    const fetchResults = async () => {
      if (!debouncedQuery.trim()) {
        setSearchData(null);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/search?query=${encodeURIComponent(debouncedQuery)}&type=all&limit=20`
        );
        if (response.ok) {
          const data = await response.json();
          setSearchData(data);
        }
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [debouncedQuery]);

  // Transform search results to flat list for display
  const items = useMemo(() => {
    if (!searchData?.results) return [];

    const resultItems: SearchItem[] = [];
    const { messages, files, channels, users } = searchData.results;

    // Add messages section
    if (messages && messages.length > 0) {
      resultItems.push({ id: "section-messages", type: "section", name: "Messages" });
      messages.slice(0, 5).forEach((msg: any) => {
        resultItems.push({
          id: `msg-${msg.id}`,
          type: "message",
          name: msg.content.substring(0, 120) + (msg.content.length > 120 ? "..." : ""),
          subtitle: msg.type === "channel"
            ? `#${msg.channel?.name} · ${msg.user?.displayName || "Unknown"}`
            : `DM · ${msg.user?.displayName || "Unknown"}`,
          data: msg,
          rawContent: msg.content,
        });
      });
    }

    // Add files section
    if (files && files.length > 0) {
      resultItems.push({ id: "section-files", type: "section", name: "Files" });
      files.slice(0, 5).forEach((file: any) => {
        resultItems.push({
          id: `file-${file.id}`,
          type: "file",
          name: file.fileName,
          subtitle: file.message?.channel?.name || "File",
          data: file,
        });
      });
    }

    // Add channels section
    if (channels && channels.length > 0) {
      resultItems.push({ id: "section-channels", type: "section", name: "Channels" });
      channels.slice(0, 5).forEach((channel: any) => {
        resultItems.push({
          id: `channel-${channel.id}`,
          type: "channel",
          name: `#${channel.name}`,
          subtitle: channel.description || `${channel.memberCount} members`,
          data: channel,
        });
      });
    }

    // Add users section
    if (users && users.length > 0) {
      resultItems.push({ id: "section-users", type: "section", name: "Users" });
      users.slice(0, 5).forEach((user: any) => {
        resultItems.push({
          id: `user-${user.id}`,
          type: "user",
          name: user.displayName,
          subtitle: user.email,
          data: user,
        });
      });
    }

    return resultItems;
  }, [searchData]);

  // Handle result selection
  const handleSelect = useCallback((item: SearchItem) => {
    if (item.type === "section" || !item.data) return;

    let targetUrl = "";

    switch (item.type) {
      case "message":
        if (item.data.type === "channel") {
          targetUrl = `/dashboard?channel=${item.data.channel?.id}&messageId=${item.data.id}`;
        } else {
          const participantId = item.data.dmConversation?.participants?.[0]?.id;
          if (participantId) {
            targetUrl = `/dm/${participantId}?messageId=${item.data.id}`;
          }
        }
        break;
      case "channel":
        targetUrl = `/dashboard?channel=${item.data.id}`;
        break;
      case "user":
        targetUrl = `/dm/${item.data.id}`;
        break;
      case "file":
        if (item.data.message?.channel?.id) {
          targetUrl = `/dashboard?channel=${item.data.message.channel.id}&messageId=${item.data.message.id}`;
        } else if (item.data.conversation?.type === "dm") {
          const dmConversationId = item.data.conversation.id;
          const messageId = item.data.message?.id;
          if (messageId) {
            targetUrl = `/dm/${dmConversationId}?messageId=${messageId}`;
          } else {
            targetUrl = `/dm/${dmConversationId}`;
          }
        }
        break;
    }

    // Close modal first
    setQuery("");
    setSearchData(null);
    setSelectedIndex(-1);
    close();

    if (targetUrl) {
      // Dispatch a custom event to notify message highlight
      const msgId = new URLSearchParams(targetUrl.split("?")[1] || "").get("messageId");
      if (msgId) {
        // Fire event after navigation so ChannelView/DirectMessageView can pick it up
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("search-navigate-to-message", {
            detail: { messageId: msgId }
          }));
        }, 300);
      }
      router.push(targetUrl);
    }
  }, [router, close]);

  // Close modal
  const handleClose = () => {
    setQuery("");
    setSearchData(null);
    setSelectedIndex(-1);
    close();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const selectableItems = items.filter(item => item.type !== "section");

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < selectableItems.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectableItems[selectedIndex]) {
          handleSelect(selectableItems[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        handleClose();
        break;
    }
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Get icon for result type
  const getIcon = (type: string) => {
    switch (type) {
      case "message":
        return (
          <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center">
            <MessageSquare size={14} className="text-blue-600" />
          </div>
        );
      case "file":
        return (
          <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center">
            <FileText size={14} className="text-gray-600" />
          </div>
        );
      case "channel":
        return (
          <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center">
            <Hash size={14} className="text-slate-600" />
          </div>
        );
      case "user":
        return (
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <Users size={14} className="text-green-600" />
          </div>
        );
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      {/* Background overlay */}
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      {/* Search Modal - Slack style */}
      <div
        ref={containerRef}
        className="relative w-full max-w-2xl mx-4 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden"
      >
        {/* Search Input */}
        <div className="flex items-center px-4 py-3 border-b border-gray-200">
          <Search size={18} className="text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search messages, files, channels, and users..."
            className="flex-1 px-3 py-1 bg-transparent outline-none text-gray-900 placeholder-gray-400 text-base"
          />
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
          ) : query ? (
            <button
              onClick={() => setQuery("")}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          ) : null}
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {items.length > 0 ? (
            <div className="py-2">
              {items.map((item, index) => {
                if (item.type === "section") {
                  return (
                    <div
                      key={item.id}
                      className="px-4 py-2 text-xs font-medium text-gray-500 bg-gray-50 border-b border-gray-100"
                    >
                      {item.name}
                    </div>
                  );
                }

                const selectableIndex = items.filter(i => i.type !== "section").indexOf(item);
                const isSelected = selectableIndex === selectedIndex;

                return (
                  <div
                    key={item.id}
                    className={`px-4 py-3 cursor-pointer flex items-start gap-3 transition-colors ${
                      isSelected ? "bg-blue-50" : "hover:bg-gray-50"
                    }`}
                    onClick={() => handleSelect(item)}
                  >
                    {item.icon || getIcon(item.type)}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-900 line-clamp-2">
                        {item.type === "message" || item.type === "file"
                          ? highlightText(item.name, query)
                          : <span className="font-medium">{item.name}</span>}
                      </div>
                      {item.subtitle && (
                        <div className="text-xs text-gray-500 truncate mt-0.5">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : query && !isLoading ? (
            <div className="p-8 text-center text-gray-500">
              No results found for "{query}"
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400">
              Type to search messages, files, channels, and users
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 flex items-center justify-between">
          <span>
            <span className="inline-block w-5 h-5 px-1 bg-gray-200 rounded text-xs text-gray-600 mr-1">↑</span>
            <span className="inline-block w-5 h-5 px-1 bg-gray-200 rounded text-xs text-gray-600 mr-1">↓</span>
            to select
          </span>
          <span>
            <span className="inline-block px-1 bg-gray-200 rounded text-xs text-gray-600 mr-1">Enter</span>
            to open
          </span>
          <span>
            <span className="inline-block px-1 bg-gray-200 rounded text-xs text-gray-600 mr-1">Esc</span>
            to close
          </span>
        </div>
      </div>
    </div>
  );
}
