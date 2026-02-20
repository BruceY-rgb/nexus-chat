// =====================================================
// Send Email Verification Code API
// POST /api/auth/send-verification
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateInput, sendVerificationSchema } from "@/lib/validation";
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from "@/lib/api-response";
import {
  sendVerificationEmail,
  isEmailServiceReady,
} from "@/lib/email-service";
import {
  checkEmailRateLimit,
  checkIPRateLimit,
  getEmailSendStatus,
} from "@/lib/rate-limiter";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = validateInput(sendVerificationSchema, body);
    if (!validation.success) {
      return NextResponse.json(validationErrorResponse(validation.errors), {
        status: 400,
      });
    }

    const { email } = validation.data;

    // Get client IP
    const clientIP =
      request.ip || request.headers.get("x-forwarded-for") || "unknown";

    // Check IP rate limit
    const ipLimitResult = checkIPRateLimit(clientIP);
    if (!ipLimitResult.allowed) {
      console.warn(`IP rate limit triggered: ${clientIP}`);
      return NextResponse.json(
        errorResponse(
          "Request too frequent, please try again later",
          "IP_RATE_LIMIT_EXCEEDED",
        ),
        { status: 429 },
      );
    }

    // Check email rate limit
    const emailLimitResult = checkEmailRateLimit(email);
    if (!emailLimitResult.allowed) {
      console.warn(`Email rate limit triggered: ${email}`);
      return NextResponse.json(
        errorResponse(
          "Sending verification code too frequent, please try again later",
          "EMAIL_RATE_LIMIT_EXCEEDED",
        ),
        { status: 429 },
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
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

    // Generate 6-digit verification code
    const verificationCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // Expires in 5 minutes

    // Update user's verification code
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationCode: verificationCode,
        emailCodeExpiresAt: expiresAt,
      },
    });

    // Check if email service is configured
    if (!isEmailServiceReady()) {
      console.error("Email service not configured");
      return NextResponse.json(
        errorResponse(
          "Email service not configured, please contact administrator",
          "EMAIL_SERVICE_NOT_CONFIGURED",
        ),
        { status: 500 },
      );
    }

    // Send verification email
    console.log(`Sending verification code to ${email}: ${verificationCode}`);

    const emailResult = await sendVerificationEmail({
      to: email,
      email,
      code: verificationCode,
    });

    if (!emailResult.success) {
      console.error("Email sending failed:", emailResult.error);
      return NextResponse.json(
        errorResponse(
          "Failed to send verification code, please try again later",
          "EMAIL_SEND_FAILED",
        ),
        { status: 500 },
      );
    }

    console.log("Verification email sent successfully:", emailResult.messageId);

    // In development environment, return verification code for testing
    if (process.env.NODE_ENV === "development") {
      console.log(`Development mode: verification code is ${verificationCode}`);
    }

    const responseData: any = {
      email,
      message: "Verification code sent",
    };

    // Return verification code in development for testing
    if (process.env.NODE_ENV === "development") {
      responseData.code = verificationCode;
    }

    return NextResponse.json(
      successResponse(responseData, "Verification code sent"),
    );
  } catch (error) {
    console.error("Error sending verification code:", error);
    return NextResponse.json(
      errorResponse("Failed to send verification code, please try again later"),
      { status: 500 },
    );
  }
}
