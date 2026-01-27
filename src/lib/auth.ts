// =====================================================
// 认证工具函数
// =====================================================

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';
import { User } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const SALT_ROUNDS = 10;

/**
 * Hash password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify password
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * 生成 JWT token
 */
export function generateToken(userId: string): string {
  return jwt.sign(
    { userId },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  );
}

/**
 * 验证 JWT token
 */
export function verifyToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Create user session
 */
export async function createUserSession(
  userId: string,
  token: string,
  ipAddress?: string,
  userAgent?: string
) {
  const tokenHash = await bcrypt.hash(token, SALT_ROUNDS);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7天后过期

  return prisma.userSession.create({
    data: {
      userId,
      tokenHash,
      ipAddress,
      userAgent,
      expiresAt,
    },
  });
}

/**
 * 验证用户会话
 */
export async function verifyUserSession(token: string, ipAddress?: string) {
  const sessions = await prisma.userSession.findMany({
    where: {
      expiresAt: {
        gt: new Date(),
      },
    },
  });

  // 验证 token 是否匹配任意会话
  for (const session of sessions) {
    if (await bcrypt.compare(token, session.tokenHash)) {
      // 更新最后访问时间
      await prisma.userSession.update({
        where: { id: session.id },
        data: { lastAccessedAt: new Date() },
      });

      // Return user information
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        include: {
          teamMemberships: true,
        },
      });

      return user;
    }
  }

  return null;
}

/**
 * Delete user session
 */
export async function deleteUserSession(token: string) {
  const sessions = await prisma.userSession.findMany({
    where: {
      expiresAt: {
        gt: new Date(),
      },
    },
  });

  for (const session of sessions) {
    if (await bcrypt.compare(token, session.tokenHash)) {
      await prisma.userSession.delete({
        where: { id: session.id },
      });
    }
  }
}

/**
 * Delete all user sessions
 */
export async function deleteAllUserSessions(userId: string) {
  await prisma.userSession.deleteMany({
    where: { userId },
  });
}

/**
 * 清理过期会话
 */
export async function cleanupExpiredSessions() {
  await prisma.userSession.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });
}