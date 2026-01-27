'use client';

// =====================================================
// 认证上下文
// =====================================================

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@prisma/client';

interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  realName?: string;
  avatarUrl?: string;
  status: string;
  role: string;
  isOnline: boolean;
  lastSeenAt?: Date;
  timezone?: string;
  notificationSettings?: {
    mentionInChannel: boolean;
    mentionInDm: boolean;
    browserPush: boolean;
    emailEnabled: boolean;
  };
}

interface LoginData {
  email: string;
  password?: string;
  code?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (data: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<AuthUser>) => void;
}

interface RegisterData {
  email: string;
  password: string;
  displayName: string;
  realName?: string;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // 获取当前用户信息
  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      console.log('🔵 [AUTH] 获取当前用户信息...');

      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      console.log('🟡 [AUTH] me 响应状态:', response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        console.log('🟢 [AUTH] 获取用户信息成功:', data);
        setUser(data.data.user);
      } else {
        console.log('🟡 [AUTH] 未登录或会话已过期');
        setUser(null);
      }
    } catch (error) {
      console.error('🔴 [AUTH] Failed to get user information:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (loginData: LoginData) => {
    try {
      console.log('🔵 [AUTH] 尝试登录:', { email: loginData.email, mode: loginData.code ? 'verification' : 'password' });

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(loginData),
      });

      console.log('🟡 [AUTH] 响应状态:', response.status, response.statusText);

      // 首先检查响应是否为 ok
      if (!response.ok) {
        // 如果不是 ok，尝试获取错误文本
        const errorText = await response.text();
        console.error('🔴 [AUTH] 响应错误:', errorText);

        try {
          // 尝试解析为 JSON
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.message || `登录失败 (${response.status})`);
        } catch (parseError) {
          // 如果解析失败，说明返回的不是 JSON
          console.error('🔴 [AUTH] 响应不是 JSON 格式:', parseError);
          throw new Error(`服务器返回了非 JSON 响应 (${response.status}): ${errorText.substring(0, 200)}`);
        }
      }

      // 响应 ok，解析 JSON
      console.log('🟢 [AUTH] 响应成功，解析 JSON...');
      const data = await response.json();
      console.log('🟢 [AUTH] 用户数据:', data);

      if (!data.data || !data.data.user) {
        console.error('🔴 [AUTH] Response format error:', data);
        throw new Error('Response format error');
      }

      setUser(data.data.user);
      console.log('🟢 [AUTH] 登录成功');
    } catch (error: any) {
      console.error('🔴 [AUTH] 登录过程出错:', error);
      throw error;
    }
  };

  const register = async (registerData: RegisterData) => {
    try {
      console.log('🔵 [AUTH] 尝试注册:', { email: registerData.email, displayName: registerData.displayName });

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(registerData),
      });

      console.log('🟡 [AUTH] 注册响应状态:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔴 [AUTH] 注册响应错误:', errorText);

        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.message || `注册失败 (${response.status})`);
        } catch (parseError) {
          console.error('🔴 [AUTH] 注册响应不是 JSON 格式:', parseError);
          throw new Error(`服务器返回了非 JSON 响应 (${response.status}): ${errorText.substring(0, 200)}`);
        }
      }

      const data = await response.json();
      console.log('🟢 [AUTH] 注册成功:', data);

      if (!data.data || !data.data.user) {
        console.error('🔴 [AUTH] 注册Response format error:', data);
        throw new Error('Response format error');
      }

      setUser(data.data.user);
      console.log('🟢 [AUTH] 用户已设置');
    } catch (error: any) {
      console.error('🔴 [AUTH] 注册过程出错:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const updateUser = (userData: Partial<AuthUser>) => {
    if (user) {
      setUser({ ...user, ...userData });
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}