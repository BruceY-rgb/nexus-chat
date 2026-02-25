'use client';

import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { TeamMember } from '@/types';
import { getAvatarUrl } from '@/lib/avatar';

interface MentionAutocompleteProps {
  onSelect: (user: TeamMember) => void;
  onClose: () => void;
  query: string;
  members?: TeamMember[]; // Changed to optional property
  position: { x: number; y: number };
  targetRef: React.RefObject<HTMLTextAreaElement>; // Target input reference
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

  // Create Portal element
  useEffect(() => {
    const element = document.getElementById('mention-portal') || document.body;
    setPortalElement(element);
  }, []);

  // Dynamically calculate popup position
  const getPopupPosition = (): { x: number; bottom: number } => {
    if (!targetRef.current || !portalElement) {
      // Fallback to original position calculation
      const targetRect = targetRef.current?.getBoundingClientRect();
      const offset = 10;
      return {
        x: position.x,
        bottom: targetRect ? window.innerHeight - targetRect.top + offset : 0
      };
    }

    const targetRect = targetRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;

    // Calculate absolute position relative to viewport
    const popupWidth = 280;

    // X coordinate calculation (left/right boundary detection)
    let x = targetRect.left + position.x;
    if (x + popupWidth > viewportWidth - 20) {
      x = viewportWidth - popupWidth - 20;
    }
    if (x < 20) {
      x = 20;
    }

    // Y coordinate calculation (pop-up mode)
    const offset = 10; // Safe margin
    const bottom = window.innerHeight - targetRect.top + offset;

    return { x, bottom };
  };

  // Use passed members or API-fetched members
  const allMembers = members.length > 0 ? members : apiMembers;

  // Search users from API
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
      // Silently handle error
    }
  };

  // Search users when query changes
  useEffect(() => {
    if (members.length === 0) {
      const timeoutId = setTimeout(() => {
        searchUsers(query);
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [query, members.length]);

  // Reset selection index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Filter members list - enhanced version, supports special characters
  const filteredMembers = allMembers.filter(member => {
    if (!query) return true;

    const searchQuery = query.toLowerCase().trim();
    // Remove special characters from query, keep only alphanumeric
    const cleanSearchQuery = searchQuery.replace(/[^a-z0-9]/gi, '');

    const displayName = member.displayName.toLowerCase();
    const realName = member.realName?.toLowerCase() || '';
    const email = member.email.toLowerCase();

    // Multiple matching methods
    const matches = (
      // Exact match (including special characters)
      displayName.includes(searchQuery) ||
      realName.includes(searchQuery) ||
      email.includes(searchQuery) ||
      // Cleaned match (remove special characters)
      displayName.replace(/[^a-z0-9]/gi, '').includes(cleanSearchQuery) ||
      realName.replace(/[^a-z0-9]/gi, '').includes(cleanSearchQuery) ||
      // Prefix match
      displayName.startsWith(searchQuery) ||
      realName.startsWith(searchQuery)
    );

    return matches;
  });

  // Get popup position
  const popupPosition = getPopupPosition();

  // Handle keyboard events
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

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // If no filtered members and there is a query, show "No matching members found" message
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
          No matching members found
        </div>
      </div>
    );

    // Use Portal to render under body
    if (portalElement) {
      return ReactDOM.createPortal(popup, portalElement);
    }
    return null;
  }

  // If no members and no query, don't show popup
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
              src={getAvatarUrl(member.avatarUrl, member, 32)}
              alt={member.displayName}
              className="w-8 h-8 rounded-md flex-shrink-0"
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

      {/* Bottom hint */}
      <div className="border-t border-[#3A3A3D] px-3 py-2">
        <div className="text-xs text-white/50 flex items-center justify-between">
          <span>↑↓ Navigate • Enter Select • Esc Close</span>
        </div>
      </div>
    </div>
  );

  // Use Portal to render under body
  if (portalElement) {
    return ReactDOM.createPortal(popup, portalElement);
  }
  return null;
}
