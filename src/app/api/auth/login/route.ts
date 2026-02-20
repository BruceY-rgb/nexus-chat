// =====================================================
// User Login API (supports password or verification code login)
// POST /api/auth/login
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, generateToken, createUserSession } from "@/lib/auth";
import {
  validateInput,
  loginSchema,
  verificationLoginSchema,
} from "@/lib/validation";
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const loginType = body.code ? "verification" : "password";

    let validation;

    // Validate input based on login type
    if (loginType === "password") {
      validation = validateInput(loginSchema, body);
      if (!validation.success) {
        return NextResponse.json(validationErrorResponse(validation.errors), {
          status: 400,
        });
      }
    } else {
      validation = validateInput(verificationLoginSchema, body);
      if (!validation.success) {
        return NextResponse.json(validationErrorResponse(validation.errors), {
          status: 400,
        });
      }
    }

    const { email } = validation.data;
    const passwordOrCode = loginType === "password" ? body.password : body.code;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        teamMemberships: true,
        notificationSettings: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        errorResponse("Invalid email or password", "INVALID_CREDENTIALS"),
        { status: 401 },
      );
    }

    // Check user status
    if (user.status !== "active") {
      return NextResponse.json(
        errorResponse(
          "Account has been disabled, please contact administrator",
          "ACCOUNT_DISABLED",
        ),
        { status: 403 },
      );
    }

    // Verify login credentials
    if (loginType === "password") {
      // Password login
      if (!user.passwordHash) {
        return NextResponse.json(
          errorResponse(
            "This account has no password set, please use verification code to login",
            "NO_PASSWORD",
          ),
          { status: 401 },
        );
      }

      const isValidPassword = await verifyPassword(
        passwordOrCode,
        user.passwordHash,
      );
      if (!isValidPassword) {
        return NextResponse.json(
          errorResponse("Invalid email or password", "INVALID_CREDENTIALS"),
          { status: 401 },
        );
      }
    } else {
      // Verification code login
      if (!user.emailVerificationCode || !user.emailCodeExpiresAt) {
        return NextResponse.json(
          errorResponse(
            "Verification code not sent, please get the code first",
            "NO_VERIFICATION_CODE",
          ),
          { status: 401 },
        );
      }

      if (new Date() > user.emailCodeExpiresAt) {
        return NextResponse.json(
          errorResponse(
            "Verification code has expired, please get it again",
            "CODE_EXPIRED",
          ),
          { status: 401 },
        );
      }

      if (user.emailVerificationCode !== passwordOrCode) {
        return NextResponse.json(
          errorResponse("Invalid verification code", "INVALID_CODE"),
          {
            status: 401,
          },
        );
      }

      // Clear verification code immediately after use
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationCode: null,
          emailCodeExpiresAt: null,
        },
      });
    }

    // Update online status
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isOnline: true,
        lastSeenAt: new Date(),
      },
    });

    // Generate token and session
    const token = generateToken(user.id);
    const userAgent = request.headers.get("user-agent") || undefined;
    const ipAddress =
      request.ip || request.headers.get("x-forwarded-for") || undefined;

    await createUserSession(user.id, token, ipAddress, userAgent);

    // Return user information (password not included)
    const response = NextResponse.json(
      successResponse(
        {
          user: {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            realName: user.realName,
            avatarUrl: user.avatarUrl,
            status: user.status,
            role: user.teamMemberships?.role || "member",
            isOnline: true,
            notificationSettings: user.notificationSettings,
          },
        },
        "Login successful",
      ),
    );

    // Set cookie (httpOnly, for API authentication)
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    // Also set a non-httpOnly token for WebSocket use
    response.cookies.set("ws_token", token, {
      httpOnly: false, // JavaScript can access
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      errorResponse("Login failed, please try again later"),
      { status: 500 },
    );
  }
}
