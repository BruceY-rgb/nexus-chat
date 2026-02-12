'use client';

import { useState } from 'react';

interface DMTabsProps {
  isOwnSpace?: boolean;
  activeTab?: 'messages' | 'canvas' | 'files' | 'shared';
  onTabChange?: (tab: 'messages' | 'canvas' | 'files' | 'shared') => void;
}

type TabType = 'messages' | 'canvas' | 'files' | 'shared';

export default function DMTabs({ isOwnSpace = false, activeTab: controlledActiveTab, onTabChange }: DMTabsProps) {
  const [internalActiveTab, setInternalActiveTab] = useState<TabType>('messages');

  // 受控模式优先，否则使用内部状态
  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab;

  const handleTabChange = (tab: TabType) => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setInternalActiveTab(tab);
    }
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: 'messages', label: 'Messages' },
    { id: 'canvas', label: isOwnSpace ? 'My Canvas' : 'Canvas' },
    { id: 'files', label: 'Files' },
    { id: 'shared', label: 'Shared' }
  ];

  return (
    <div className="flex-shrink-0 border-b border-border bg-background-secondary">
      <div className="flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
