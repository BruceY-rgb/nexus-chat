'use client';

import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { TeamMember } from '@/types';

interface MentionAutocompleteProps {
  onSelect: (user: TeamMember) => void;
  onClose: () => void;
  query: string;
  members?: TeamMember[]; // 改为可选属性
  position: { x: number; y: number };
  targetRef: React.RefObject<HTMLTextAreaElement>; // 目标输入框引用
}

export default function MentionAutocomplete({
  onSelect,
  onClose,
  query,
  members = [],
  position,
  targetRef
}: MentionAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [apiMembers, setApiMembers] = useState<TeamMember[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [portalElement, setPortalElement] = useState<HTMLElement | null>(null);

  // 创建Portal元素
  useEffect(() => {
    const element = document.getElementById('mention-portal') || document.body;
    setPortalElement(element);
  }, []);

  // 动态计算弹窗位置
  const getPopupPosition = (): { x: number; bottom: number } => {
    if (!targetRef.current || !portalElement) {
      // 回退到原始位置计算
      const targetRect = targetRef.current?.getBoundingClientRect();
      const offset = 10;
      return {
        x: position.x,
        bottom: targetRect ? window.innerHeight - targetRect.top + offset : 0
      };
    }

    const targetRect = targetRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;

    // 计算相对于视口的绝对位置
    const popupWidth = 280;

    // X坐标计算（左右边界检测）
    let x = targetRect.left + position.x;
    if (x + popupWidth > viewportWidth - 20) {
      x = viewportWidth - popupWidth - 20;
    }
    if (x < 20) {
      x = 20;
    }

    // Y坐标计算（向上弹出模式）
    const offset = 10; // 安全边距
    const bottom = window.innerHeight - targetRect.top + offset;

    return { x, bottom };
  };

  // 使用传入的 members 或 API 获取的 members
  const allMembers = members.length > 0 ? members : apiMembers;

  // 从 API 搜索用户
  const searchUsers = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setApiMembers([]);
      return;
    }

    try {
      const url = `/api/users?search=${encodeURIComponent(searchQuery)}`;
      const response = await fetch(url, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setApiMembers(data.users || []);
      }
    } catch (error) {
      // 静默处理错误
    }
  };

  // 当查询变化时搜索用户
  useEffect(() => {
    if (members.length === 0) {
      const timeoutId = setTimeout(() => {
        searchUsers(query);
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [query, members.length]);

  // 当查询变化时重置选择索引
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // 过滤成员列表 - 增强版，支持特殊字符
  const filteredMembers = allMembers.filter(member => {
    if (!query) return true;

    const searchQuery = query.toLowerCase().trim();
    // 移除查询中的特殊字符，只保留字母数字
    const cleanSearchQuery = searchQuery.replace(/[^a-z0-9]/gi, '');

    const displayName = member.displayName.toLowerCase();
    const realName = member.realName?.toLowerCase() || '';
    const email = member.email.toLowerCase();

    // 多种匹配方式
    const matches = (
      // 精确匹配（包含特殊字符）
      displayName.includes(searchQuery) ||
      realName.includes(searchQuery) ||
      email.includes(searchQuery) ||
      // 清理后的匹配（移除特殊字符）
      displayName.replace(/[^a-z0-9]/gi, '').includes(cleanSearchQuery) ||
      realName.replace(/[^a-z0-9]/gi, '').includes(cleanSearchQuery) ||
      // 前缀匹配
      displayName.startsWith(searchQuery) ||
      realName.startsWith(searchQuery)
    );

    return matches;
  });

  // 获取弹窗位置
  const popupPosition = getPopupPosition();

  // 处理键盘事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (filteredMembers.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % filteredMembers.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => (prev - 1 + filteredMembers.length) % filteredMembers.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredMembers[selectedIndex]) {
            onSelect(filteredMembers[selectedIndex]);
          }
          break;
        case 'Tab':
          e.preventDefault();
          if (filteredMembers[selectedIndex]) {
            onSelect(filteredMembers[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [filteredMembers, selectedIndex, onSelect, onClose]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // 如果没有过滤成员且有查询，显示"未找到匹配成员"提示
  if (filteredMembers.length === 0 && query) {
    const popup = (
      <div
        ref={dropdownRef}
        className="fixed z-[999999] bg-[#2D2D2F] border border-[#3A3A3D] rounded-lg shadow-xl py-2 px-3"
        style={{
          left: popupPosition.x,
          bottom: popupPosition.bottom,
          minWidth: '220px',
          maxWidth: '280px',
          pointerEvents: 'auto',
          transform: 'translateZ(0)',
          isolation: 'isolate'
        }}
      >
        <div className="text-white/60 text-sm px-2 py-1.5 text-center">
          未找到匹配的成员
        </div>
      </div>
    );

    // 使用 Portal 渲染到 body 下
    if (portalElement) {
      return ReactDOM.createPortal(popup, portalElement);
    }
    return null;
  }

  // 如果没有成员且没有查询，不显示弹窗
  if (filteredMembers.length === 0 && !query) {
    return null;
  }

  const popup = (
    <div
      ref={dropdownRef}
      className="fixed z-[999999] bg-[#2D2D2F] border-4 border-yellow-400 rounded-lg shadow-2xl py-1 max-h-60 overflow-y-auto"
      style={{
        left: popupPosition.x,
        bottom: popupPosition.bottom,
        minWidth: '220px',
        maxWidth: '280px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
        backgroundColor: 'rgba(45, 45, 47, 0.95)',
        pointerEvents: 'auto',
        transform: 'translateZ(0)',
        isolation: 'isolate'
      }}
    >
      {filteredMembers.map((member, index) => (
        <div
          key={member.id}
          className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all duration-150 ${
            index === selectedIndex
              ? 'bg-[#1164A3] text-white'
              : 'hover:bg-[#3A3A3D] text-white'
          }`}
          onClick={() => onSelect(member)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <div className="relative flex-shrink-0">
            <img
              src={member.avatarUrl || `https://api.dicebear.com/7.x/identicon/png?seed=${member.displayName || member.id}&size=32`}
              alt={member.displayName}
              className="w-8 h-8 rounded-md flex-shrink-0"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                if (!img.src.includes('api.dicebear.com')) {
                  img.src = `https://api.dicebear.com/7.x/identicon/png?seed=${member.displayName || member.id}&size=32`;
                }
              }}
            />
            {member.isOnline && (
              <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-[#2D2D2F]" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium truncate">
                {member.displayName}
              </div>
              {member.isOnline && (
                <span className="text-xs text-green-400 font-medium">●</span>
              )}
            </div>
            {member.realName && member.realName !== member.displayName && (
              <div className="text-xs text-white/60 truncate">
                {member.realName}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* 底部提示 */}
      <div className="border-t border-[#3A3A3D] px-3 py-2">
        <div className="text-xs text-white/50 flex items-center justify-between">
          <span>↑↓ 选择 • Enter 确认 • Esc 关闭</span>
        </div>
      </div>
    </div>
  );

  // 使用 Portal 渲染到 body 下
  if (portalElement) {
    return ReactDOM.createPortal(popup, portalElement);
  }
  return null;
}
