// =====================================================
// User Profile Management API
// GET /api/auth/profile - Get current user profile
// PUT /api/auth/profile - Update user profile
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { validateInput, updateProfileSchema } from "@/lib/validation";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "@/lib/api-response";

// Force dynamic rendering - because this API uses cookies
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value;

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
    console.error("Error getting user profile:", error);
    return NextResponse.json(errorResponse("Failed to get user profile"), {
      status: 500,
    });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value;

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

    const body = await request.json();

    // Validate input
    const validation = validateInput(updateProfileSchema, body);
    if (!validation.success) {
      return NextResponse.json(validationErrorResponse(validation.errors), {
        status: 400,
      });
    }

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: decoded.userId },
      data: {
        displayName: validation.data.displayName,
        realName: validation.data.realName || null,
        avatarUrl: validation.data.avatarUrl || null,
        timezone: validation.data.timezone || "UTC",
      },
      include: {
        teamMemberships: true,
        notificationSettings: true,
      },
    });

    return NextResponse.json(
      successResponse(
        {
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            displayName: updatedUser.displayName,
            realName: updatedUser.realName,
            avatarUrl: updatedUser.avatarUrl,
            status: updatedUser.status,
            role: updatedUser.teamMemberships?.role || "member",
            isOnline: updatedUser.isOnline,
            lastSeenAt: updatedUser.lastSeenAt,
            timezone: updatedUser.timezone,
            notificationSettings: updatedUser.notificationSettings,
          },
        },
        "Profile updated successfully",
      ),
    );
  } catch (error) {
    console.error("Error updating user profile:", error);
    return NextResponse.json(errorResponse("Failed to update user profile"), {
      status: 500,
    });
  }
}
