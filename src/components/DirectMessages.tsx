'use client';

import { TeamMember } from '../types';

interface DirectMessagesProps {
  members?: TeamMember[];
  currentUserId?: string;
  selectedDirectMessageId?: string;
  onStartChat?: (memberId: string) => void;
  onNewChat?: () => void;
}

export default function DirectMessages({
  members = [],
  currentUserId,
  selectedDirectMessageId,
  onStartChat,
  onNewChat
}: DirectMessagesProps) {
  // 显示所有成员，包括当前用户

  const getStatusIndicator = (status: TeamMember['status']) => {
    if (status === 'online') {
      return (
        <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full bg-green-500" />
      );
    }
    return (
      <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full border border-gray-400 bg-transparent" />
    );
  };

  return (
    <div className="mb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 hover:bg-white/10 cursor-pointer" onClick={onNewChat}>
        <h3 className="text-white/80 text-sm font-medium tracking-wide uppercase">
          DIRECT MESSAGES
        </h3>
        <button
          className="text-white/60 hover:text-white transition-colors"
          aria-label="New direct message"
          title="New direct message"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
        </button>
      </div>

      {/* Members List */}
      <div className="space-y-0.5">
        {members.map((member) => {
          const isSelected = selectedDirectMessageId === member.id;
          const isCurrentUser = member.id === currentUserId;

          return (
            <div
              key={member.id}
              className={`flex items-center px-3 py-1.5 mx-2 rounded cursor-pointer transition-colors group ${
                isSelected
                  ? 'bg-[#1164A3] text-white'
                  : 'hover:bg-white/10'
              }`}
              onClick={() => onStartChat?.(member.id)}
            >
              {/* Avatar with status indicator */}
              <div className="relative flex-shrink-0">
                <img
                  src={member.avatarUrl}
                  alt={member.displayName}
                  className="w-5 h-5 rounded-sm"
                  style={{ borderRadius: '4px' }}
                />
                {getStatusIndicator(member.status)}
              </div>

              {/* Display Name */}
              <span className={`ml-3 text-sm font-medium truncate transition-colors ${
                isSelected
                  ? 'text-white'
                  : 'text-white/80 group-hover:text-white'
              }`}>
                {member.displayName}{isCurrentUser ? ' (you)' : ''}
              </span>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {members.length === 0 && (
        <div className="px-3 py-2 text-white/50 text-sm">
          No team members available
        </div>
      )}
    </div>
  );
}
