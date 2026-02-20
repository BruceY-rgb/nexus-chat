// =====================================================
// User Logout API
// POST /api/auth/logout
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { deleteUserSession } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value;

    if (token) {
      // Delete session
      await deleteUserSession(token);
    }

    // Create response
    const response = NextResponse.json(
      successResponse(null, "Logout successful"),
    );

    // Clear cookie
    response.cookies.delete("auth_token");

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(errorResponse("Logout failed"), { status: 500 });
  }
}
