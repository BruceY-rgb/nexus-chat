'use client';

import { useState, useEffect } from 'react';
import { NotificationDiagnostics } from '@/components/NotificationDiagnostics';
import { Button } from '@/components/ui';

export default function TestNotificationsPage() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check notification support
    setIsSupported('Notification' in window);
    setPermission(Notification.permission);
  }, []);

  const requestPermission = async () => {
    const result = await Notification.requestPermission();
    setPermission(result);
    alert(`Permission request result: ${result}`);
  };

  const sendTestNotification = (type: 'mention' | 'dm') => {
    if (permission !== 'granted') {
      alert('Notification permission not granted, please click "Request Notification Permission" first');
      return;
    }

    const testNotification = {
      id: `test-${Date.now()}`,
      type,
      title: type === 'mention' ? 'You were mentioned' : 'New message',
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

    // Simulate sending notification (this will trigger logic in useNotifications)
    console.log('🔔 [TEST] Sending test notification:', testNotification);

    // Create browser notification directly (skip page visibility check)
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

    alert('Test notification sent! Please check if you can see the notification');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Browser Notification Test Page</h1>

        <div className="mb-6 p-4 bg-blue-900 rounded-lg">
          <h2 className="text-xl font-bold mb-2">Test Steps</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>Make sure you have granted notification permission</li>
            <li>Open developer tools (F12) to view debug logs</li>
            <li>Switch to another tab or minimize the browser window</li>
            <li>Click the test button below to send notification</li>
            <li>Check if you receive browser notification</li>
          </ol>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-bold mb-3">Current Status</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-800 rounded">
              <p className="text-sm text-gray-400">Browser Support</p>
              <p className="text-lg font-bold">{isSupported ? 'Supported' : 'Not Supported'}</p>
            </div>
            <div className="p-3 bg-gray-800 rounded">
              <p className="text-sm text-gray-400">Notification Permission</p>
              <p className="text-lg font-bold">
                {permission === 'granted' ? 'Granted' : permission === 'denied' ? 'Denied' : 'Not Decided'}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6 space-y-3">
          <Button
            onClick={requestPermission}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3"
          >
            Request Notification Permission
          </Button>

          <Button
            onClick={() => sendTestNotification('mention')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3"
          >
            Test @Mention Notification
          </Button>

          <Button
            onClick={() => sendTestNotification('dm')}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3"
          >
            Test Direct Message Notification
          </Button>
        </div>

        <NotificationDiagnostics />

        <div className="mt-8 p-4 bg-yellow-900 rounded-lg">
          <h3 className="text-lg font-bold mb-2">Important Notes</h3>
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li>Browser notifications only show when the page is <strong>hidden</strong> (switch tabs or minimize window)</li>
            <li>Make sure to allow this website to send notifications in browser settings</li>
            <li>Some browsers may restrict notifications when in background</li>
            <li>Check if browser notification center is blocked</li>
            <li>Recommend using modern browsers like Chrome, Firefox, or Edge</li>
          </ul>
        </div>

        <div className="mt-6 p-4 bg-gray-800 rounded-lg">
          <h3 className="text-lg font-bold mb-2">Debug Info</h3>
          <p className="text-sm mb-2">Open developer tools (F12) to view console logs:</p>
          <ul className="list-disc list-inside space-y-1 text-sm font-mono">
            <li>Search "[DEBUG]" to view notification debug info</li>
            <li>Search "[SUCCESS]" to view successfully sent notifications</li>
            <li>Search "[ERROR]" to view possible errors</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
