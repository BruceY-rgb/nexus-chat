'use client';

import { useState, useEffect } from 'react';
import { NotificationDiagnostics } from '@/components/NotificationDiagnostics';
import { Button } from '@/components/ui';

export default function TestNotificationsPage() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // 检查通知支持
    setIsSupported('Notification' in window);
    setPermission(Notification.permission);
  }, []);

  const requestPermission = async () => {
    const result = await Notification.requestPermission();
    setPermission(result);
    alert(`权限请求结果: ${result}`);
  };

  const sendTestNotification = (type: 'mention' | 'dm') => {
    if (permission !== 'granted') {
      alert('❌ 通知权限未授权，请先点击"请求通知权限"');
      return;
    }

    const testNotification = {
      id: `test-${Date.now()}`,
      type,
      title: type === 'mention' ? '有人提到了你' : '新消息',
      content: type === 'mention' ? 'Hey, have you seen this message?' : 'Check out what just happened!',
      relatedMessageId: undefined,
      relatedChannelId: type === 'mention' ? 'test-channel-123' : undefined,
      relatedDmConversationId: type === 'dm' ? 'test-dm-456' : undefined,
      isRead: false,
      createdAt: new Date().toISOString(),
      user: {
        id: 'test-user',
        displayName: 'Test User',
        avatarUrl: '/favicon.ico'
      }
    };

    // 模拟发送通知（这将触发 useNotifications 中的逻辑）
    console.log('🔔 [TEST] Sending test notification:', testNotification);

    // 直接创建浏览器通知（跳过页面可见性检查）
    const notification = new Notification(testNotification.title, {
      body: testNotification.content,
      icon: testNotification.user.avatarUrl,
      tag: type === 'mention' ? 'test-channel' : 'test-dm',
      badge: '/favicon.ico'
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    alert('✅ 测试通知已发送！请检查是否能看到通知');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">🔔 浏览器通知测试页面</h1>

        <div className="mb-6 p-4 bg-blue-900 rounded-lg">
          <h2 className="text-xl font-bold mb-2">📋 测试步骤</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>确保您已授权通知权限</li>
            <li>打开开发者工具（F12）查看调试日志</li>
            <li>切换到其他标签页或最小化浏览器窗口</li>
            <li>点击下方的测试按钮发送通知</li>
            <li>检查是否收到浏览器通知</li>
          </ol>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-bold mb-3">⚙️ 当前状态</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-800 rounded">
              <p className="text-sm text-gray-400">浏览器支持</p>
              <p className="text-lg font-bold">{isSupported ? '✅ 支持' : '❌ 不支持'}</p>
            </div>
            <div className="p-3 bg-gray-800 rounded">
              <p className="text-sm text-gray-400">通知权限</p>
              <p className="text-lg font-bold">
                {permission === 'granted' ? '✅ 已授权' : permission === 'denied' ? '❌ 已拒绝' : '⚠️ 未决定'}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6 space-y-3">
          <Button
            onClick={requestPermission}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3"
          >
            请求通知权限
          </Button>

          <Button
            onClick={() => sendTestNotification('mention')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3"
          >
            测试 @提及 通知
          </Button>

          <Button
            onClick={() => sendTestNotification('dm')}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3"
          >
            测试 私信 通知
          </Button>
        </div>

        <NotificationDiagnostics />

        <div className="mt-8 p-4 bg-yellow-900 rounded-lg">
          <h3 className="text-lg font-bold mb-2">💡 重要提示</h3>
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li>浏览器通知仅在页面<strong>隐藏</strong>时显示（切换标签页或最小化窗口）</li>
            <li>确保在浏览器设置中允许此网站发送通知</li>
            <li>某些浏览器可能在后台时限制通知显示</li>
            <li>检查浏览器的通知中心是否被阻止</li>
            <li>建议使用 Chrome、Firefox 或 Edge 等现代浏览器</li>
          </ul>
        </div>

        <div className="mt-6 p-4 bg-gray-800 rounded-lg">
          <h3 className="text-lg font-bold mb-2">🔍 调试信息</h3>
          <p className="text-sm mb-2">请打开开发者工具（F12）查看控制台日志：</p>
          <ul className="list-disc list-inside space-y-1 text-sm font-mono">
            <li>搜索 "[DEBUG]" 查看通知调试信息</li>
            <li>搜索 "[SUCCESS]" 查看成功发送的通知</li>
            <li>搜索 "[ERROR]" 查看可能的错误</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
