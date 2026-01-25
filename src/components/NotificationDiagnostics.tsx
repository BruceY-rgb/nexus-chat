'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';

export function NotificationDiagnostics() {
  const [diagnostics, setDiagnostics] = useState<string[]>([]);

  const runDiagnostics = () => {
    const results: string[] = [];

    // 1. 检查浏览器支持
    const isSupported = typeof window !== 'undefined' && 'Notification' in window;
    results.push(`1. 浏览器通知支持: ${isSupported ? '✅ 支持' : '❌ 不支持'}`);

    // 2. 检查当前权限状态
    if (isSupported) {
      const permission = Notification.permission;
      results.push(`2. 当前权限状态: ${permission === 'granted' ? '✅ 已授权' : permission === 'denied' ? '❌ 已拒绝' : '⚠️ 未决定（需要手动授权）'}`);

      // 3. 检查页面可见性状态
      const visibilityState = document.visibilityState;
      results.push(`3. 页面可见性状态: ${visibilityState} (hidden=隐藏, visible=可见)`);

      // 4. 检查 Notification API
      const apiInfo = Notification.permission;
      results.push(`4. Notification.permission: ${apiInfo}`);

      // 5. 显示通知权限请求URL（如果是file://协议）
      if (location.protocol === 'file:') {
        results.push('⚠️ 检测到本地文件协议，某些浏览器可能不支持通知功能');
      }

      // 6. 检查 HTTPS
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        results.push('⚠️ 非 HTTPS 协议，浏览器通知可能受限');
      }
    }

    setDiagnostics(results);
  };

  const requestPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      alert(`权限请求结果: ${permission}`);
      runDiagnostics(); // 重新检查
    } else {
      alert('此浏览器不支持通知功能');
    }
  };

  const testNotification = () => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification('测试通知', {
        body: '这是一条测试通知',
        icon: '/favicon.ico',
        tag: 'test-notification'
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      alert('✅ 测试通知已发送！如果看不到通知，请检查浏览器通知设置');
    } else {
      alert('❌ 通知权限未授权，请先点击"请求通知权限"');
    }
  };

  return (
    <div className="p-4 bg-gray-800 rounded-lg text-white">
      <h3 className="text-lg font-bold mb-4">🔍 浏览器通知诊断工具</h3>

      <div className="space-y-2 mb-4">
        <Button onClick={runDiagnostics} className="w-full bg-blue-600 hover:bg-blue-700">
          运行诊断
        </Button>

        <Button onClick={requestPermission} className="w-full bg-green-600 hover:bg-green-700">
          请求通知权限
        </Button>

        <Button onClick={testNotification} className="w-full bg-purple-600 hover:bg-purple-700">
          发送测试通知
        </Button>
      </div>

      {diagnostics.length > 0 && (
        <div className="mt-4 p-3 bg-gray-900 rounded">
          <h4 className="font-bold mb-2">诊断结果:</h4>
          <div className="space-y-1 text-sm font-mono">
            {diagnostics.map((result, index) => (
              <div key={index}>{result}</div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 p-3 bg-yellow-900 rounded text-sm">
        <h4 className="font-bold mb-2">🔧 故障排除建议:</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>如果权限显示"未决定"，请点击"请求通知权限"</li>
          <li>如果权限显示"已拒绝"，请在浏览器设置中手动允许通知</li>
          <li>确保页面处于隐藏状态（切换到其他标签页）才能触发通知</li>
          <li>检查浏览器通知中心是否被阻止</li>
          <li>确保网站通过 HTTPS 访问（本地开发除外）</li>
        </ul>
      </div>
    </div>
  );
}
