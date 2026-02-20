import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api-response";

// User search API

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
      return NextResponse.json(unauthorizedResponse("invalid token"), {
        status: 401,
      });
    }

    const currentUserId = decoded.userId;
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query || query.trim() === "") {
      return NextResponse.json(
        { error: "Search query is required" },
        { status: 400 },
      );
    }

    const searchTerm = query.trim();

    // Search users (email, displayName, realName)
    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: currentUserId } }, // Exclude current user
          {
            OR: [
              {
                email: {
                  contains: searchTerm,
                  mode: "insensitive",
                },
              },
              {
                displayName: {
                  contains: searchTerm,
                  mode: "insensitive",
                },
              },
              {
                realName: {
                  contains: searchTerm,
                  mode: "insensitive",
                },
              },
            ],
          },
        ],
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        realName: true,
        avatarUrl: true,
        isOnline: true,
        lastSeenAt: true,
      },
      orderBy: [
        { isOnline: "desc" }, // Online users first
        { displayName: "asc" },
      ],
      take: 100, // Increase fetch count to ensure enough candidates for sorting
    });

    // Sort search results by match quality
    const sortedUsers = users.sort((a, b) => {
      // Prioritize exact matches
      const aExactMatch =
        a.email.toLowerCase() === searchTerm.toLowerCase() ||
        a.displayName.toLowerCase() === searchTerm.toLowerCase() ||
        (a.realName && a.realName.toLowerCase() === searchTerm.toLowerCase());

      const bExactMatch =
        b.email.toLowerCase() === searchTerm.toLowerCase() ||
        b.displayName.toLowerCase() === searchTerm.toLowerCase() ||
        (b.realName && b.realName.toLowerCase() === searchTerm.toLowerCase());

      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;

      // Then sort by match quality (prefix match first)
      const aStartsWith =
        a.email.toLowerCase().startsWith(searchTerm.toLowerCase()) ||
        a.displayName.toLowerCase().startsWith(searchTerm.toLowerCase()) ||
        (a.realName &&
          a.realName.toLowerCase().startsWith(searchTerm.toLowerCase()));

      const bStartsWith =
        b.email.toLowerCase().startsWith(searchTerm.toLowerCase()) ||
        b.displayName.toLowerCase().startsWith(searchTerm.toLowerCase()) ||
        (b.realName &&
          b.realName.toLowerCase().startsWith(searchTerm.toLowerCase()));

      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;

      return 0;
    });

    return NextResponse.json({
      users: sortedUsers,
      query: searchTerm,
      count: sortedUsers.length,
    });
  } catch (error) {
    console.error("Error searching users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
