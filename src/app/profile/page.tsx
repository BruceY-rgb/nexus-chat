'use client';

// 强制动态渲染 - 因为这个页面使用了客户端状态管理
export const dynamic = 'force-dynamic';

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
        throw new Error(data.message || 'Failed to get user profile');
      }

      setFormData({
        displayName: data.data.user.displayName || '',
        realName: data.data.user.realName || '',
        avatarUrl: data.data.user.avatarUrl || '',
        timezone: data.data.user.timezone || 'UTC',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to get user profile');
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
        throw new Error(data.message || 'Update failed');
      }

      // Update local user state
      updateUser(data.data.user);
      setSuccess('Profile updated successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to update user profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-text-secondary">Loading...</div>
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
            Back
          </Button>
          <div className="text-center">
            <h1 className="text-heading-2">User Profile</h1>
            <p className="text-body-secondary mt-1">Manage your personal information and preferences</p>
          </div>
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        <Card className="space-y-6">
          {/* Avatar area */}
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
                  // TODO: Implement avatar upload feature
                  console.log('Avatar upload feature to be implemented');
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
                  <span className="text-xs text-success">Online</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 mt-2">
                  <div className="w-2 h-2 bg-text-tertiary rounded-full"></div>
                  <span className="text-xs text-text-tertiary">Offline</span>
                </div>
              )}
            </div>
          </div>

          {/* Form area */}
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
              label="Display name"
              placeholder="Enter your display name"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              leftIcon={<User className="w-4 h-4" />}
              required
            />

            <Input
              label="Real name"
              placeholder="Enter your real name (optional)"
              value={formData.realName}
              onChange={(e) => setFormData({ ...formData, realName: e.target.value })}
              leftIcon={<User className="w-4 h-4" />}
            />

            <Input
              label="Avatar URL"
              placeholder="Enter avatar image URL (optional)"
              value={formData.avatarUrl}
              onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
              leftIcon={<Camera className="w-4 h-4" />}
              hint="Supports JPG, PNG format image links"
            />

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                <Clock className="w-4 h-4 inline mr-1" />
                Timezone
              </label>
              <select
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                className="w-full px-3 py-2 bg-[#222529] border border-[#3E4144] rounded-lg text-[#FFFFFF] focus:outline-none focus:ring-2 focus:ring-[#1264A3]/50 focus:border-[#1264A3] transition-all duration-200"
              >
                <option value="UTC">UTC (Coordinated Universal Time)</option>
                <option value="Asia/Shanghai">Asia/Shanghai (China Standard Time)</option>
                <option value="America/New_York">America/New_York (Eastern Time)</option>
                <option value="Europe/London">Europe/London (Greenwich Mean Time)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (Japan Standard Time)</option>
                <option value="Australia/Sydney">Australia/Sydney (Australian Eastern Time)</option>
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
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={fetchProfile}
                disabled={saving}
                className="flex-1"
              >
                Reset
              </Button>
            </div>
          </form>
        </Card>

        {/* Account information */}
        <Card>
          <h3 className="text-lg font-semibold text-text-primary mb-4">Account Information</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-text-secondary">Account Status</span>
              <span className="text-sm text-text-primary font-medium capitalize">{user?.status}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-text-secondary">Role</span>
              <span className="text-sm text-text-primary font-medium capitalize">{user?.role}</span>
            </div>
            {user?.lastSeenAt && (
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-text-secondary">Last Active</span>
                <span className="text-sm text-text-primary">
                  {new Date(user.lastSeenAt).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
