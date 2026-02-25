/**
 * MCP Server Authentication Module
 * Reuses the main application's authentication logic
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const SALT_ROUNDS = 10;

/**
 * Verify password
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT token
 */
export function generateToken(userId: string): string {
  return jwt.sign(
    { userId },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  );
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return decoded;
  } catch {
    return null;
  }
}

/**
 * User login
 */
export async function login(email: string, password: string): Promise<{
  success: boolean;
  token?: string;
  user?: {
    id: string;
    email: string;
    displayName: string;
  };
  error?: string;
}> {
  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return { success: false, error: 'Invalid email or password' };
    }

    // Check user status
    if (user.status !== 'active') {
      return { success: false, error: 'Account has been disabled' };
    }

    // Verify password
    if (!user.passwordHash) {
      return { success: false, error: 'Invalid email or password' };
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return { success: false, error: 'Invalid email or password' };
    }

    // Generate token
    const token = generateToken(user.id);

    return {
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
    };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Login failed' };
  }
}

/**
 * Get user information from token
 */
export async function getUserFromToken(token: string): Promise<{
  id: string;
  email: string;
  displayName: string;
} | null> {
  const decoded = verifyToken(token);
  if (!decoded) {
    return null;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        status: true,
      },
    });

    if (!user || user.status !== 'active') {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    };
  } catch {
    return null;
  }
}

export { prisma };
