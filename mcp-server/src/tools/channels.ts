/**
 * Channel Tools - 频道管理工具
 */

import { z } from "zod";
import { apiExecutor } from "../executor.js";
import { config } from "../config.js";
import type {
  ToolDefinition,
  ExecutionContext,
  Channel,
  ToolResult,
} from "../types.js";

// Input schemas
const listChannelsSchema = z.object({
  type: z.enum(["all", "joined", "public", "private"]).optional(),
  search: z.string().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
  userToken: z.string(),
});

const getChannelSchema = z.object({
  channelId: z.string(),
  userToken: z.string(),
});

const createChannelSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().optional(),
  isPrivate: z.boolean().optional(),
  userToken: z.string(),
});

const updateChannelSchema = z.object({
  channelId: z.string(),
  name: z.string().min(1).max(80).optional(),
  description: z.string().optional(),
  userToken: z.string(),
});

const deleteChannelSchema = z.object({
  channelId: z.string(),
  userToken: z.string(),
});

const joinChannelSchema = z.object({
  channelId: z.string(),
  userToken: z.string(),
});

const leaveChannelSchema = z.object({
  channelId: z.string(),
  userToken: z.string(),
});

const listChannelMembersSchema = z.object({
  channelId: z.string(),
  userToken: z.string(),
});

const inviteChannelMemberSchema = z.object({
  channelId: z.string(),
  userId: z.string(),
  userToken: z.string(),
});

const joinAllChannelMembersSchema = z.object({
  channelId: z.string(),
  userToken: z.string(),
});

const removeChannelMemberSchema = z.object({
  channelId: z.string(),
  userId: z.string(),
  userToken: z.string(),
});

const getChannelPermissionsSchema = z.object({
  channelId: z.string(),
  userToken: z.string(),
});

export const channelTools: ToolDefinition[] = [
  {
    name: "list_channels",
    description:
      "获取频道列表，支持过滤已加入的频道、公开频道、私有频道，支持搜索和分页",
    parameters: listChannelsSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = listChannelsSchema.parse(args);
        const result = await apiExecutor.get<Channel[]>(
          "/api/channels",
          validatedArgs.userToken,
          {
            type: validatedArgs.type || "all",
            search: validatedArgs.search || "",
            page: String(validatedArgs.page || 1),
            limit: String(validatedArgs.limit || 50),
          },
        );

        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            { type: "text", text: JSON.stringify({ error: errorMessage }) },
          ],
          isError: true,
        };
      }
    },
  },
  {
    name: "get_channel",
    description: "获取指定频道的详细信息",
    parameters: getChannelSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = getChannelSchema.parse(args);
        const result = await apiExecutor.get<Channel>(
          `/api/channels/${validatedArgs.channelId}`,
          validatedArgs.userToken,
        );

        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            { type: "text", text: JSON.stringify({ error: errorMessage }) },
          ],
          isError: true,
        };
      }
    },
  },
  {
    name: "create_channel",
    description: "创建一个新的频道",
    parameters: createChannelSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = createChannelSchema.parse(args);
        const result = await apiExecutor.post<Channel>(
          "/api/channels",
          validatedArgs.userToken,
          {
            name: validatedArgs.name,
            description: validatedArgs.description,
            isPrivate: validatedArgs.isPrivate,
          },
        );

        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            { type: "text", text: JSON.stringify({ error: errorMessage }) },
          ],
          isError: true,
        };
      }
    },
  },
  {
    name: "update_channel",
    description: "更新频道信息",
    parameters: updateChannelSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = updateChannelSchema.parse(args);
        const result = await apiExecutor.patch<Channel>(
          `/api/channels/${validatedArgs.channelId}`,
          validatedArgs.userToken,
          {
            name: validatedArgs.name,
            description: validatedArgs.description,
          },
        );

        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            { type: "text", text: JSON.stringify({ error: errorMessage }) },
          ],
          isError: true,
        };
      }
    },
  },
  {
    name: "delete_channel",
    description: "删除一个频道",
    parameters: deleteChannelSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = deleteChannelSchema.parse(args);
        await apiExecutor.delete(
          `/api/channels/${validatedArgs.channelId}`,
          validatedArgs.userToken,
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "Channel deleted",
              }),
            },
          ],
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            { type: "text", text: JSON.stringify({ error: errorMessage }) },
          ],
          isError: true,
        };
      }
    },
  },
  {
    name: "join_channel",
    description: "加入一个频道",
    parameters: joinChannelSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = joinChannelSchema.parse(args);
        await apiExecutor.post(
          `/api/channels/${validatedArgs.channelId}/join`,
          validatedArgs.userToken,
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "Joined channel",
              }),
            },
          ],
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            { type: "text", text: JSON.stringify({ error: errorMessage }) },
          ],
          isError: true,
        };
      }
    },
  },
  {
    name: "leave_channel",
    description: "离开一个频道",
    parameters: leaveChannelSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = leaveChannelSchema.parse(args);
        await apiExecutor.post(
          `/api/channels/${validatedArgs.channelId}/leave`,
          validatedArgs.userToken,
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: true, message: "Left channel" }),
            },
          ],
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            { type: "text", text: JSON.stringify({ error: errorMessage }) },
          ],
          isError: true,
        };
      }
    },
  },
  {
    name: "list_channel_members",
    description: "获取频道成员列表",
    parameters: listChannelMembersSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = listChannelMembersSchema.parse(args);
        const result = await apiExecutor.get(
          `/api/channels/${validatedArgs.channelId}/members`,
          validatedArgs.userToken,
        );

        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            { type: "text", text: JSON.stringify({ error: errorMessage }) },
          ],
          isError: true,
        };
      }
    },
  },
  {
    name: "invite_channel_member",
    description: "邀请用户加入频道",
    parameters: inviteChannelMemberSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = inviteChannelMemberSchema.parse(args);
        await apiExecutor.post(
          `/api/channels/${validatedArgs.channelId}/invite`,
          validatedArgs.userToken,
          { userIds: [validatedArgs.userId] },
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: true, message: "User invited" }),
            },
          ],
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            { type: "text", text: JSON.stringify({ error: errorMessage }) },
          ],
          isError: true,
        };
      }
    },
  },
  {
    name: "join_all_channel_members",
    description: "将所有用户加入指定频道",
    parameters: joinAllChannelMembersSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = joinAllChannelMembersSchema.parse(args);
        const result = await apiExecutor.post(
          `/api/channels/${validatedArgs.channelId}/join-all`,
          validatedArgs.userToken,
        );

        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            { type: "text", text: JSON.stringify({ error: errorMessage }) },
          ],
          isError: true,
        };
      }
    },
  },
  {
    name: "remove_channel_member",
    description: "从频道中移除指定用户",
    parameters: removeChannelMemberSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = removeChannelMemberSchema.parse(args);
        const url = `${config.INTERNAL_API_URL}/api/channels/${validatedArgs.channelId}/members/remove`;
        const response = await fetch(url, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Cookie: `auth_token=${validatedArgs.userToken}`,
          },
          body: JSON.stringify({ userId: validatedArgs.userId }),
        });

        if (!response.ok) {
          let errorMessage = `API error: ${response.status}`;
          try {
            const errorData = (await response.json()) as {
              message?: string;
              error?: string;
            };
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch {
            // Ignore parse errors
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();
        return {
          content: [{ type: "text", text: JSON.stringify(data) }],
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            { type: "text", text: JSON.stringify({ error: errorMessage }) },
          ],
          isError: true,
        };
      }
    },
  },
  {
    name: "get_channel_permissions",
    description: "获取当前用户在频道中的角色和权限",
    parameters: getChannelPermissionsSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = getChannelPermissionsSchema.parse(args);

        // Get channel details with members
        const channel = await apiExecutor.get<{
          id: string;
          name: string;
          isPrivate: boolean;
          members: Array<{
            role: string;
            user: {
              id: string;
              displayName: string;
              avatarUrl?: string;
              realName?: string;
              isOnline: boolean;
            };
          }>;
        }>(`/api/channels/${validatedArgs.channelId}`, validatedArgs.userToken);

        // Get current user info
        const currentUserResp = await apiExecutor.get<{ user: { id: string } }>(
          "/api/auth/me",
          validatedArgs.userToken,
        );
        const currentUserId = currentUserResp.user.id;

        // Find current user's role in the channel
        const currentMember = channel.members.find(
          (m) => m.user.id === currentUserId,
        );

        if (!currentMember) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  isMember: false,
                  role: null,
                  permissions: {
                    canEdit: false,
                    canDelete: false,
                    canInvite: false,
                    canRemove: false,
                    canManageSettings: false,
                    canSendMessages: false,
                    canAddReactions: false,
                  },
                }),
              },
            ],
          };
        }

        const role = currentMember.role;
        const isOwner = role === "owner";
        const isAdmin = role === "admin";

        // Permission calculations
        const permissions = {
          canEdit: isOwner || isAdmin,
          canDelete: isOwner,
          canInvite: isOwner || isAdmin,
          canRemove: isOwner || isAdmin,
          canManageSettings: isOwner,
          canSendMessages: true,
          canAddReactions: true,
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                isMember: true,
                role: role,
                channelId: channel.id,
                channelName: channel.name,
                isPrivate: channel.isPrivate,
                permissions: permissions,
              }),
            },
          ],
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            { type: "text", text: JSON.stringify({ error: errorMessage }) },
          ],
          isError: true,
        };
      }
    },
  },
];
