'use client';

import { TeamMember } from '../types';

interface DirectMessagesProps {
  members?: TeamMember[];
  currentUserId?: string;
  selectedDirectMessageId?: string;
  onStartChat?: (memberId: string) => void;
  onNewChat?: () => void;
}

export default function DirectMessagesDebug({
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

  const handleMemberClick = (member: TeamMember) => {
    console.log('\n🔵 ===== DIRECT MESSAGES CLICK DEBUG =====');
    console.log('🔵 [DirectMessages] 成员被点击:', {
      memberId: member.id,
      memberName: member.displayName,
      currentUserId: currentUserId,
      timestamp: new Date().toISOString()
    });

    console.log('🔵 [DirectMessages] 准备调用 onStartChat...');
    if (onStartChat) {
      onStartChat(member.id);
      console.log('🔵 [DirectMessages] onStartChat 已调用，参数:', member.id);
    } else {
      console.error('🔴 [DirectMessages] onStartChat 未定义！');
    }
    console.log('🔵 ===== END DEBUG =====\n');
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
          onClick={(e) => {
            e.stopPropagation();
            onNewChat?.();
          }}
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
              onClick={() => handleMemberClick(member)}
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

              {/* Debug badge */}
              <span className="ml-auto text-xs text-white/40">
                ID: {member.id.slice(0, 6)}
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
