'use client';

import { useState } from 'react';
import DirectMessages from './DirectMessages';
import { TeamMember } from '../types';

export default function DirectMessagesExample() {
  // Mock current user
  const [currentUser] = useState({
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'Current User'
  });

  const [members] = useState<TeamMember[]>([
    {
      id: 'user-2',
      email: 'user2@example.com',
      displayName: 'User Two',
      isOnline: true
    },
    {
      id: 'user-3',
      email: 'user3@example.com',
      displayName: 'User Three',
      isOnline: false
    }
  ]);

  const handleStartChat = (memberId: string) => {
    console.log('Starting chat with member:', memberId);
    // TODO: 实现打开私聊窗口逻辑
  };

  const handleNewChat = () => {
    console.log('Opening new chat dialog');
    // TODO: 实现打开新聊天对话框逻辑
  };

  return (
    <div className="w-64 h-full bg-[#3F0E40] overflow-y-auto">
      {/* Workspace Header */}
      <div className="flex items-center px-4 py-3 border-b border-white/10">
        <h2 className="text-white font-semibold text-lg">My Workspace</h2>
      </div>

      {/* Sidebar Navigation */}
      <div className="px-3 py-2 space-y-1">
        <div className="flex items-center px-3 py-2 text-white/80 hover:bg-white/10 rounded cursor-pointer">
          <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span className="text-sm font-medium">Channels</span>
        </div>

        <DirectMessages
          members={members}
          currentUserId={currentUser.id}
          onStartChat={handleStartChat}
          onNewChat={handleNewChat}
        />
      </div>
    </div>
  );
}
