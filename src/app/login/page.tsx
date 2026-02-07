'use client';

// 强制动态渲染 - 因为这个页面使用了客户端状态管理
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input, Card } from '@/components/ui';
import { Mail, Lock, Shield } from 'lucide-react';

type LoginMode = 'password' | 'verification';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [mode, setMode] = useState<LoginMode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);

  const handleSendVerification = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setSendingCode(true);
    setError('');

    try {
      const response = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send verification code');
      }

      // Switch to verification code mode
      setMode('verification');
      setVerificationCode('');
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code, please try again');
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const loginData: any = { email };

      if (mode === 'password') {
        loginData.password = password;
      } else {
        loginData.code = verificationCode;
      }

      await login(loginData);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed, please check your information');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-lg mb-4">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <h1 className="text-heading-2">Welcome Back</h1>
          <p className="text-body-secondary mt-2">Log in to your account to continue
</p>
        </div>

        <Card className="animate-fade-in">
          {/* Login method toggle */}
          <div className="flex p-1 bg-background-elevated rounded-lg mb-6">
            <button
              type="button"
              onClick={() => setMode('password')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                mode === 'password'
                  ? 'bg-background-component text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Lock className="w-4 h-4" />
              Password
            </button>
            <button
              type="button"
              onClick={() => setMode('verification')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                mode === 'verification'
                  ? 'bg-background-component text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Shield className="w-4 h-4" />
              Verification code
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {error && (
              <div className="p-3 bg-error/10 border border-error/20 rounded-lg text-error text-sm animate-slide-up">
                {error}
              </div>
            )}

            <Input
              type="email"
              label="email"
              placeholder="please enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
              required
            />

            {mode === 'password' ? (
              <Input
                type="password"
                label="password"
                placeholder="please enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                required
              />
            ) : (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    label="verification code"
                    placeholder="please enter 6-digit verification code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    leftIcon={<Shield className="w-4 h-4" />}
                    maxLength={6}
                    required
                  />
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleSendVerification}
                      disabled={sendingCode || !email}
                      loading={sendingCode}
                      className="whitespace-nowrap"
                    >
                      {sendingCode ? 'sending...' : 'send verification code'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={loading}
              disabled={loading}
              size="lg"
              className="mt-6"
            >
              {loading ? 'logging in...' : 'login'}
            </Button>
          </form>

          <div className="divider"></div>

          <div className="text-center space-y-4">
            <p className="text-body-secondary">
              Don't have an account?{' '}
              <Link href="/register" className="text-primary hover:text-primary/80 font-medium">
                Sign up
              </Link>
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setEmail('admin@chat.com');
                  setPassword('admin123');
                }}
                className="p-2 text-xs text-text-tertiary hover:text-text-secondary border border-border rounded-lg hover:border-border-light transition-all"
              >
                Use Admin Account
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('alice@chat.com');
                  setPassword('password123');
                }}
                className="p-2 text-xs text-text-tertiary hover:text-text-secondary border border-border rounded-lg hover:border-border-light transition-all"
              >
                Use Alice Account
              </button>
            </div>
          </div>
        </Card>

        <div className="text-center mt-6 text-xs text-text-tertiary">
          <p>By logging in, you agree to our Terms of Service and Privacy Policy</p>
        </div>
      </div>
    </div>
  );
}
