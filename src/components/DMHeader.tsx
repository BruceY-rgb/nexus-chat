'use client';

import { TeamMember } from '../types';

interface DMHeaderProps {
  member: TeamMember;
  currentUserId: string;
  onBack?: () => void;
}

export default function DMHeader({
  member,
  currentUserId
}: DMHeaderProps) {
  const isOwnSpace = member.id === currentUserId;
  const displayName = isOwnSpace ? 'My Space' : member.displayName;
  const subtitle = isOwnSpace
    ? 'Direct message'
    : `${member.displayName} • ${member.email}`;

  return (
    <div className="flex-shrink-0 bg-background-secondary border-b border-border">
      {/* 主标题栏 */}
      <div className="flex items-center justify-between px-4 py-3">
        {/* 左侧 - 头像和名称 */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={member.avatarUrl || '/default-avatar.png'}
              alt={displayName}
              className="w-9 h-9 rounded-sm"
              style={{ borderRadius: '4px' }}
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                if (img.src !== '/default-avatar.png') {
                  img.src = '/default-avatar.png';
                }
              }}
            />
            {/* 在线状态指示器 */}
            {!isOwnSpace && (
              <span
                className={`absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full border-2 border-white ${
                  member.status === 'online'
                    ? 'bg-status-success'
                    : member.status === 'away'
                    ? 'bg-status-warning'
                    : 'bg-text-muted'
                }`}
              />
            )}
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text-primary">
              {displayName}
            </h1>
            <p className="text-sm text-text-secondary">
              {subtitle}
            </p>
          </div>
        </div>

        {/* 右侧 - 功能图标 */}
        <div className="flex items-center gap-2">
          {/* Star 图标 */}
          <button
            className="p-2 hover:bg-background-tertiary rounded-full transition-colors"
            title="Star conversation"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5 text-text-secondary hover:text-yellow-500"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.659.446 1.004l-1.348 1.867a.562.562 0 00-.146.353l-.36 3.178a.563.563 0 01-.611.43l-2.612-.642a.563.563 0 00-.465.316l-1.82 2.165a.562.562 0 01-.857-.348l.109-3.181a.563.563 0 00-.19-.458l-1.867-1.348a.563.563 0 00-.353-.146l-3.178-.36a.563.563 0 01-.43-.611l.642-2.612a.563.563 0 00-.316-.465l-2.165-1.82a.562.562 0 01.348-.857l3.181.109a.563.563 0 00.458-.19l1.348-1.867z"
              />
            </svg>
          </button>

          {/* Settings 图标 */}
          <button
            className="p-2 hover:bg-background-tertiary rounded-full transition-colors"
            title="Settings"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5 text-text-secondary"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
