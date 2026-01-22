// =====================================================
// 首页
// =====================================================

import { redirect } from 'next/navigation';

export default function HomePage() {
  // 重定向到登录页面
  redirect('/login');
}