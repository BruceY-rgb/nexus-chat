'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';

export function NotificationDiagnostics() {
  const [diagnostics, setDiagnostics] = useState<string[]>([]);

  const runDiagnostics = () => {
    const results: string[] = [];

    // 1. Check browser support
    const isSupported = typeof window !== 'undefined' && 'Notification' in window;
    results.push(`1. Browser notification support: ${isSupported ? '✅ Supported' : '❌ Not supported'}`);

    // 2. Check current permission status
    if (isSupported) {
      const permission = Notification.permission;
      results.push(`2. Current permission status: ${permission === 'granted' ? '✅ Granted' : permission === 'denied' ? '❌ Denied' : '⚠️ Not decided (requires manual authorization)'}`);

      // 3. Check page visibility state
      const visibilityState = document.visibilityState;
      results.push(`3. Page visibility state: ${visibilityState} (hidden=hidden, visible=visible)`);

      // 4. Check Notification API
      const apiInfo = Notification.permission;
      results.push(`4. Notification.permission: ${apiInfo}`);

      // 5. Show notification permission request URL (if file:// protocol)
      if (location.protocol === 'file:') {
        results.push('⚠️ Local file protocol detected, some browsers may not support notifications');
      }

      // 6. Check HTTPS
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        results.push('⚠️ Non-HTTPS protocol, browser notifications may be restricted');
      }
    }

    setDiagnostics(results);
  };

  const requestPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      alert(`Permission request result: ${permission}`);
      runDiagnostics(); // Re-check
    } else {
      alert('This browser does not support notification functionality');
    }
  };

  const testNotification = () => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification('Test notification', {
        body: 'This is a test notification',
        icon: '/favicon.ico',
        tag: 'test-notification'
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      alert('✅ Test notification sent! If you cannot see the notification, please check browser notification settings');
    } else {
      alert('❌ Notification permission not authorized, please click "Request Notification Permission" first');
    }
  };

  return (
    <div className="p-4 bg-gray-800 rounded-lg text-white">
      <h3 className="text-lg font-bold mb-4">🔍 Browser Notification Diagnostics Tool</h3>

      <div className="space-y-2 mb-4">
        <Button onClick={runDiagnostics} className="w-full bg-blue-600 hover:bg-blue-700">
          Run Diagnostics
        </Button>

        <Button onClick={requestPermission} className="w-full bg-green-600 hover:bg-green-700">
          Request Notification Permission
        </Button>

        <Button onClick={testNotification} className="w-full bg-purple-600 hover:bg-purple-700">
          Send Test Notification
        </Button>
      </div>

      {diagnostics.length > 0 && (
        <div className="mt-4 p-3 bg-gray-900 rounded">
          <h4 className="font-bold mb-2">Diagnostics Results:</h4>
          <div className="space-y-1 text-sm font-mono">
            {diagnostics.map((result, index) => (
              <div key={index}>{result}</div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 p-3 bg-yellow-900 rounded text-sm">
        <h4 className="font-bold mb-2">🔧 Troubleshooting Suggestions:</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>If permission shows "Not decided", please click "Request Notification Permission"</li>
          <li>If permission shows "Denied", please manually allow notifications in browser settings</li>
          <li>Ensure the page is hidden (switch to another tab) to trigger notifications</li>
          <li>Check if the browser notification center is blocked</li>
          <li>Ensure the site is accessed via HTTPS (except for local development)</li>
        </ul>
      </div>
    </div>
  );
}
