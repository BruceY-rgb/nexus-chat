// =====================================================
// Get Current User Info API
// GET /api/auth/me
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from "@/lib/api-response";

// Force dynamic rendering - because this API uses cookies
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Prefer httpOnly token, fallback to ws_token
    const token =
      request.cookies.get("auth_token")?.value ||
      request.cookies.get("ws_token")?.value;

    if (!token) {
      return NextResponse.json(unauthorizedResponse(), { status: 401 });
    }

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(unauthorizedResponse("Invalid token"), {
        status: 401,
      });
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        teamMemberships: true,
        notificationSettings: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        errorResponse("User not found", "USER_NOT_FOUND"),
        {
          status: 404,
        },
      );
    }

    if (user.status !== "active") {
      return NextResponse.json(
        errorResponse("Account has been disabled", "ACCOUNT_DISABLED"),
        { status: 403 },
      );
    }

    // Update online status
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isOnline: true,
        lastSeenAt: new Date(),
      },
    });

    return NextResponse.json(
      successResponse({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          realName: user.realName,
          avatarUrl: user.avatarUrl,
          status: user.status,
          role: user.teamMemberships?.role || "member",
          isOnline: user.isOnline,
          lastSeenAt: user.lastSeenAt,
          timezone: user.timezone,
          notificationSettings: user.notificationSettings,
        },
      }),
    );
  } catch (error) {
    console.error("Error getting user info:", error);
    return NextResponse.json(errorResponse("Failed to get user information"), {
      status: 500,
    });
  }
}
