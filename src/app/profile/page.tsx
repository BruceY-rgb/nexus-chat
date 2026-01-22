'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Button, Input, Card, Avatar } from '@/components/ui';
import { User, Mail, Clock, Camera, Save, LogOut, ArrowLeft } from 'lucide-react';

interface ProfileData {
  displayName: string;
  realName: string;
  avatarUrl: string;
  timezone: string;
}

export default function ProfilePage() {
  const { user, updateUser, logout } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState<ProfileData>({
    displayName: '',
    realName: '',
    avatarUrl: '',
    timezone: 'UTC',
  });

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    fetchProfile();
  }, [user, router]);

  const fetchProfile = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/profile', {
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '获取用户资料失败');
      }

      setFormData({
        displayName: data.data.user.displayName || '',
        realName: data.data.user.realName || '',
        avatarUrl: data.data.user.avatarUrl || '',
        timezone: data.data.user.timezone || 'UTC',
      });
    } catch (err: any) {
      setError(err.message || '获取用户资料失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '更新失败');
      }

      // 更新本地用户状态
      updateUser(data.data.user);
      setSuccess('资料更新成功');
    } catch (err: any) {
      setError(err.message || '更新用户资料失败');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (err) {
      console.error('登出失败:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-text-secondary">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 hover:bg-background-elevated"
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </Button>
          <div className="text-center">
            <h1 className="text-heading-2">用户资料</h1>
            <p className="text-body-secondary mt-1">管理您的个人信息和偏好设置</p>
          </div>
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            登出
          </Button>
        </div>

        <Card className="space-y-6">
          {/* 头像区域 */}
          <div className="flex flex-col items-center space-y-4 pb-6 border-b border-border">
            <div className="relative">
              <Avatar
                src={formData.avatarUrl || undefined}
                alt={formData.displayName}
                size="xl"
                fallback={formData.displayName}
              />
              <button
                className="absolute bottom-0 right-0 p-2 bg-primary rounded-lg hover:bg-primary/90 transition-colors"
                onClick={() => {
                  // TODO: 实现头像上传功能
                  console.log('上传头像功能待实现');
                }}
              >
                <Camera className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-text-primary">{formData.displayName}</h2>
              <p className="text-sm text-text-secondary flex items-center justify-center gap-1 mt-1">
                <Mail className="w-4 h-4" />
                {user?.email}
              </p>
              {user?.isOnline ? (
                <div className="flex items-center gap-1 mt-2">
                  <div className="w-2 h-2 bg-success rounded-full"></div>
                  <span className="text-xs text-success">在线</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 mt-2">
                  <div className="w-2 h-2 bg-text-tertiary rounded-full"></div>
                  <span className="text-xs text-text-tertiary">离线</span>
                </div>
              )}
            </div>
          </div>

          {/* 表单区域 */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-error/10 border border-error/20 rounded-lg text-error text-sm animate-slide-up">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 bg-success/10 border border-success/20 rounded-lg text-success text-sm animate-slide-up">
                {success}
              </div>
            )}

            <Input
              label="昵称"
              placeholder="请输入您的昵称"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              leftIcon={<User className="w-4 h-4" />}
              required
            />

            <Input
              label="真实姓名"
              placeholder="请输入您的真实姓名（可选）"
              value={formData.realName}
              onChange={(e) => setFormData({ ...formData, realName: e.target.value })}
              leftIcon={<User className="w-4 h-4" />}
            />

            <Input
              label="头像链接"
              placeholder="请输入头像图片URL（可选）"
              value={formData.avatarUrl}
              onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
              leftIcon={<Camera className="w-4 h-4" />}
              hint="支持 JPG、PNG 格式的图片链接"
            />

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                <Clock className="w-4 h-4 inline mr-1" />
                时区
              </label>
              <select
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                className="input"
              >
                <option value="UTC">UTC (协调世界时)</option>
                <option value="Asia/Shanghai">Asia/Shanghai (中国标准时间)</option>
                <option value="America/New_York">America/New_York (东部时间)</option>
                <option value="Europe/London">Europe/London (格林威治时间)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (日本标准时间)</option>
                <option value="Australia/Sydney">Australia/Sydney (澳大利亚东部时间)</option>
              </select>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                variant="primary"
                loading={saving}
                disabled={saving}
                leftIcon={<Save className="w-4 h-4" />}
                className="flex-1"
              >
                {saving ? '保存中...' : '保存更改'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={fetchProfile}
                disabled={saving}
                className="flex-1"
              >
                重置
              </Button>
            </div>
          </form>
        </Card>

        {/* 账户信息 */}
        <Card>
          <h3 className="text-lg font-semibold text-text-primary mb-4">账户信息</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-text-secondary">账户状态</span>
              <span className="text-sm text-text-primary font-medium capitalize">{user?.status}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-text-secondary">角色</span>
              <span className="text-sm text-text-primary font-medium capitalize">{user?.role}</span>
            </div>
            {user?.lastSeenAt && (
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-text-secondary">最后活跃</span>
                <span className="text-sm text-text-primary">
                  {new Date(user.lastSeenAt).toLocaleString('zh-CN')}
                </span>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
