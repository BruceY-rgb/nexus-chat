import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api-response";

// Get Channel List API
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

    const currentUserId = decoded.userId;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "all"; // 'all', 'joined', 'public', 'private'
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    // Build query conditions
    let where: any = {
      deletedAt: null,
    };

    // Filter by type
    if (type === "joined") {
      // Only get joined channels
      where.members = {
        some: {
          userId: currentUserId,
        },
      };
    } else if (type === "public") {
      where.isPrivate = false;
    } else if (type === "private") {
      where.isPrivate = true;
      // Private channels only show joined ones
      where.members = {
        some: {
          userId: currentUserId,
        },
      };
    }

    // Search filter
    if (search) {
      where.AND = where.AND || [];
      where.AND.push({
        OR: [
          {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            description: {
              contains: search,
              mode: "insensitive",
            },
          },
        ],
      });
    }

    // Get channel list
    const [channels, total] = await Promise.all([
      prisma.channel.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          isPrivate: true,
          createdAt: true,
          createdBy: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          _count: {
            select: {
              members: true,
            },
          },
          members: {
            where: {
              userId: currentUserId,
            },
            select: {
              id: true,
              role: true,
              joinedAt: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }],
        skip: offset,
        take: limit,
      }),
      prisma.channel.count({ where }),
    ]);

    // Format return data
    const formattedChannels = channels.map((channel: any) => ({
      ...channel,
      isJoined: channel.members.length > 0,
      memberCount: channel._count.members,
      members: undefined, // Remove members field to avoid redundancy
    }));

    return NextResponse.json({
      channels: formattedChannels,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrevious: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching channels:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Create Channel API
export async function POST(request: NextRequest) {
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

    const currentUserId = decoded.userId;
    const body = await request.json();
    const { name, description, isPrivate } = body;

    // Validate input
    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "Channel name is required" },
        { status: 400 },
      );
    }

    // Check if channel name already exists
    const existingChannel = await prisma.channel.findUnique({
      where: { name: name.trim() },
    });

    if (existingChannel) {
      return NextResponse.json(
        { error: "Channel name already exists" },
        { status: 400 },
      );
    }

    // Create channel and member relationship (using transaction to ensure atomicity)
    const channel = await prisma.$transaction(async (tx) => {
      // Create channel
      const newChannel = await tx.channel.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          isPrivate: isPrivate || false,
          createdById: currentUserId,
        },
        select: {
          id: true,
          name: true,
          description: true,
          isPrivate: true,
          createdAt: true,
          createdBy: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      });

      // Automatically add creator as channel member
      await tx.channelMember.create({
        data: {
          channelId: newChannel.id,
          userId: currentUserId,
          role: "owner",
        },
      });

      return newChannel;
    });

    return NextResponse.json(
      {
        channel: {
          ...channel,
          isJoined: true,
          memberCount: 1,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating channel:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
