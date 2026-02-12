'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, User, Calendar, X } from 'lucide-react';
import UserSelect from './UserSelect';

interface User {
  id: string;
  displayName: string;
  avatarUrl?: string;
}

interface SearchFilters {
  userId: string | null;
  channelId?: string | null;
  startDate: string | null;
  endDate: string | null;
}

interface SearchFilterPanelProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  contextType?: 'channel' | 'dm' | 'global';
  channelId?: string;
}

type TimePreset = 'today' | '7days' | '30days' | 'custom' | null;

export default function SearchFilterPanel({
  filters,
  onFiltersChange,
  contextType = 'global',
  channelId
}: SearchFilterPanelProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [expandedSections, setExpandedSections] = useState({
    sender: true,
    time: true
  });
  const [timePreset, setTimePreset] = useState<TimePreset>(null);

  // 加载用户列表（频道中加载频道成员，全局搜索加载所有用户）
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        let url = '/api/users';
        // 如果在频道中，获取该频道的成员列表
        if (channelId) {
          url = `/api/channels/${channelId}/members`;
        }
        const response = await fetch(url, { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          // API返回格式不同，需要适配
          if (channelId) {
            // 频道成员API返回 members 数组
            const members = data.members || data || [];
            setUsers(members.map((m: any) => ({
              id: m.id || m.userId,
              displayName: m.displayName || m.realName || m.name,
              avatarUrl: m.avatarUrl
            })));
          } else {
            setUsers(data.users || []);
          }
        }
      } catch (error) {
        console.error('Failed to fetch users:', error);
      }
    };
    fetchUsers();
  }, [channelId]);

  const toggleSection = (section: 'sender' | 'time') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleUserChange = (userId: string) => {
    onFiltersChange({
      ...filters,
      userId: filters.userId === userId ? null : userId
    });
  };

  const handleTimePresetChange = (preset: TimePreset) => {
    setTimePreset(preset);

    if (preset === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      onFiltersChange({
        ...filters,
        startDate: today.toISOString(),
        endDate: new Date().toISOString()
      });
    } else if (preset === '7days') {
      const date = new Date();
      date.setDate(date.getDate() - 7);
      date.setHours(0, 0, 0, 0);
      onFiltersChange({
        ...filters,
        startDate: date.toISOString(),
        endDate: new Date().toISOString()
      });
    } else if (preset === '30days') {
      const date = new Date();
      date.setDate(date.getDate() - 30);
      date.setHours(0, 0, 0, 0);
      onFiltersChange({
        ...filters,
        startDate: date.toISOString(),
        endDate: new Date().toISOString()
      });
    } else if (preset === 'custom') {
      // 自定义日期范围，不修改日期
    } else {
      // 清除时间过滤
      onFiltersChange({
        ...filters,
        startDate: null,
        endDate: null
      });
    }
  };

  const handleCustomDateChange = (type: 'start' | 'end', value: string) => {
    if (value) {
      const date = new Date(value);
      date.setHours(23, 59, 59, 999);
      onFiltersChange({
        ...filters,
        startDate: type === 'start' ? date.toISOString() : filters.startDate,
        endDate: type === 'end' ? date.toISOString() : filters.endDate
      });
    }
  };

  const clearFilters = () => {
    setTimePreset(null);
    onFiltersChange({
      userId: null,
      channelId: null,
      startDate: null,
      endDate: null
    });
  };

  const hasActiveFilters = filters.userId || filters.channelId || filters.startDate;

  return (
    <div className="w-56 border-r border-gray-200 bg-gray-50 flex flex-col h-full">
      {/* 标题栏 */}
      <div className="p-3 border-b border-gray-200 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Filters</span>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* 发送者过滤 - 在私聊中不显示 */}
        {contextType !== 'dm' && (
          <div className="border-b border-gray-200">
            <button
              onClick={() => toggleSection('sender')}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-100"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <User size={14} />
                <span>Sender</span>
              </div>
              <ChevronDown
                size={14}
                className={`text-gray-400 transition-transform ${expandedSections.sender ? 'rotate-180' : ''}`}
              />
            </button>
            {expandedSections.sender && (
              <div className="px-3 pb-3">
                <UserSelect
                  users={users}
                  selectedUserId={filters.userId}
                  onSelect={(userId) => onFiltersChange({ ...filters, userId })}
                  placeholder="All users"
                />
              </div>
            )}
          </div>
        )}

        {/* 时间过滤 */}
        <div className="border-b border-gray-200">
          <button
            onClick={() => toggleSection('time')}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-100"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Calendar size={14} />
              <span>Time</span>
            </div>
            <ChevronDown
              size={14}
              className={`text-gray-400 transition-transform ${expandedSections.time ? 'rotate-180' : ''}`}
            />
          </button>
          {expandedSections.time && (
            <div className="px-3 pb-3 space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="radio"
                  name="timePreset"
                  checked={timePreset === 'today'}
                  onChange={() => handleTimePresetChange('today')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                Today
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="radio"
                  name="timePreset"
                  checked={timePreset === '7days'}
                  onChange={() => handleTimePresetChange('7days')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                Last 7 days
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="radio"
                  name="timePreset"
                  checked={timePreset === '30days'}
                  onChange={() => handleTimePresetChange('30days')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                Last 30 days
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="radio"
                  name="timePreset"
                  checked={timePreset === 'custom'}
                  onChange={() => handleTimePresetChange('custom')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                Custom range
              </label>
              {timePreset === 'custom' && (
                <div className="mt-2 space-y-2 pl-6">
                  <div>
                    <label className="text-xs text-gray-500">Start date</label>
                    <input
                      type="date"
                      onChange={(e) => handleCustomDateChange('start', e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded px-2 py-1 mt-1 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">End date</label>
                    <input
                      type="date"
                      onChange={(e) => handleCustomDateChange('end', e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded px-2 py-1 mt-1 text-gray-900"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
