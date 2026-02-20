// =====================================================
// User Registration API
// POST /api/auth/register
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, generateToken, createUserSession } from "@/lib/auth";
import { validateInput, registerSchema } from "@/lib/validation";
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = validateInput(registerSchema, body);
    if (!validation.success) {
      return NextResponse.json(validationErrorResponse(validation.errors), {
        status: 400,
      });
    }

    const { email, password, displayName, realName } = validation.data;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        errorResponse("This email is already registered", "EMAIL_EXISTS"),
        { status: 409 },
      );
    }

    // Create user
    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName,
        realName,
        emailVerifiedAt: new Date(),
      },
    });

    // Add to team members
    await prisma.teamMember.create({
      data: {
        userId: user.id,
        role: "member",
      },
    });

    // Create default notification settings
    await prisma.notificationSettings.create({
      data: {
        userId: user.id,
      },
    });

    // Generate token and session
    const token = generateToken(user.id);
    const userAgent = request.headers.get("user-agent") || undefined;
    const ipAddress =
      request.ip || request.headers.get("x-forwarded-for") || undefined;

    await createUserSession(user.id, token, ipAddress, userAgent);

    // Set cookie
    const response = NextResponse.json(
      successResponse(
        {
          user: {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            realName: user.realName,
            avatarUrl: user.avatarUrl,
          },
        },
        "Registration successful",
      ),
      { status: 201 },
    );

    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      errorResponse("Registration failed, please try again later"),
      { status: 500 },
    );
  }
}
