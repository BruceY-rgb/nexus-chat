-- =====================================================
-- 完整数据库结构初始化脚本
-- 生产环境数据库修复和补充
-- =====================================================

-- 设置时区
SET timezone = 'UTC';

-- =====================================================
-- 第一部分：创建核心表
-- =====================================================

-- 1. _prisma_migrations 表（Prisma迁移记录）
CREATE TABLE IF NOT EXISTS public._prisma_migrations (
    id character varying(36) NOT NULL PRIMARY KEY,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);

-- 2. users 表（用户主表）
CREATE TABLE IF NOT EXISTS public.users (
    id text NOT NULL PRIMARY KEY,
    email text NOT NULL UNIQUE,
    password_hash text,
    display_name text NOT NULL,
    real_name text,
    avatar_url text,
    status text DEFAULT 'active'::text NOT NULL,
    timezone text DEFAULT 'UTC'::text NOT NULL,
    last_seen_at timestamp(3) without time zone,
    is_online boolean DEFAULT false NOT NULL,
    email_verified_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    email_code_expires_at timestamp(3) without time zone,
    email_verification_code text
);

-- 3. user_sessions 表（用户会话）
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id text NOT NULL PRIMARY KEY,
    user_id text NOT NULL,
    token_hash text NOT NULL,
    ip_address text,
    user_agent text,
    expires_at timestamp(3) without time zone NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_accessed_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT user_sessions_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.users(id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

-- 4. team_members 表（团队成员）
CREATE TABLE IF NOT EXISTS public.team_members (
    id text NOT NULL PRIMARY KEY,
    user_id text NOT NULL UNIQUE,
    role text DEFAULT 'member'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    invited_by text,
    joined_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    CONSTRAINT team_members_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.users(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT team_members_invited_by_fkey
        FOREIGN KEY (invited_by) REFERENCES public.users(id)
        ON UPDATE CASCADE ON DELETE SET NULL
);

-- 5. channels 表（频道）
CREATE TABLE IF NOT EXISTS public.channels (
    id text NOT NULL PRIMARY KEY,
    name text NOT NULL UNIQUE,
    description text,
    is_private boolean DEFAULT false NOT NULL,
    is_archived boolean DEFAULT false NOT NULL,
    created_by text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    CONSTRAINT channels_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES public.users(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- 6. channel_members 表（频道成员）
CREATE TABLE IF NOT EXISTS public.channel_members (
    id text NOT NULL PRIMARY KEY,
    channel_id text NOT NULL,
    user_id text NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    last_read_at timestamp(3) without time zone DEFAULT '1970-01-01 00:00:00'::timestamp without time zone NOT NULL,
    last_read_message_id text,
    unread_count integer DEFAULT 0 NOT NULL,
    joined_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    CONSTRAINT channel_members_channel_id_fkey
        FOREIGN KEY (channel_id) REFERENCES public.channels(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT channel_members_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.users(id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

-- 7. dm_conversations 表（私信对话）
CREATE TABLE IF NOT EXISTS public.dm_conversations (
    id text NOT NULL PRIMARY KEY,
    created_by text NOT NULL,
    last_message_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    CONSTRAINT dm_conversations_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES public.users(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- 8. dm_conversation_members 表（私信成员）
CREATE TABLE IF NOT EXISTS public.dm_conversation_members (
    id text NOT NULL PRIMARY KEY,
    conversation_id text NOT NULL,
    user_id text NOT NULL,
    last_read_at timestamp(3) without time zone DEFAULT '1970-01-01 00:00:00'::timestamp without time zone NOT NULL,
    last_read_message_id text,
    unread_count integer DEFAULT 0 NOT NULL,
    is_starred boolean DEFAULT false NOT NULL,
    joined_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    CONSTRAINT dm_conversation_members_conversation_id_fkey
        FOREIGN KEY (conversation_id) REFERENCES public.dm_conversations(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT dm_conversation_members_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.users(id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

-- 9. messages 表（消息）
CREATE TABLE IF NOT EXISTS public.messages (
    id text NOT NULL PRIMARY KEY,
    content text NOT NULL,
    message_type text DEFAULT 'text'::text NOT NULL,
    channel_id text,
    dm_conversation_id text,
    parent_message_id text,
    user_id text NOT NULL,
    is_edited boolean DEFAULT false NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    CONSTRAINT messages_channel_id_fkey
        FOREIGN KEY (channel_id) REFERENCES public.channels(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT messages_dm_conversation_id_fkey
        FOREIGN KEY (dm_conversation_id) REFERENCES public.dm_conversations(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT messages_parent_message_id_fkey
        FOREIGN KEY (parent_message_id) REFERENCES public.messages(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT messages_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.users(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- 10. message_mentions 表（消息提及）
CREATE TABLE IF NOT EXISTS public.message_mentions (
    id text NOT NULL PRIMARY KEY,
    message_id text NOT NULL,
    mentioned_user_id text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT message_mentions_message_id_fkey
        FOREIGN KEY (message_id) REFERENCES public.messages(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT message_mentions_mentioned_user_id_fkey
        FOREIGN KEY (mentioned_user_id) REFERENCES public.users(id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

-- 11. message_reactions 表（消息反应）⭐ 新功能
CREATE TABLE IF NOT EXISTS public.message_reactions (
    id text NOT NULL PRIMARY KEY,
    message_id text NOT NULL,
    user_id text NOT NULL,
    emoji text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT message_reactions_message_id_fkey
        FOREIGN KEY (message_id) REFERENCES public.messages(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT message_reactions_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.users(id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

-- 12. message_reads 表（消息已读）
CREATE TABLE IF NOT EXISTS public.message_reads (
    id text NOT NULL PRIMARY KEY,
    message_id text NOT NULL,
    user_id text NOT NULL,
    read_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT message_reads_message_id_fkey
        FOREIGN KEY (message_id) REFERENCES public.messages(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT message_reads_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.users(id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

-- 13. attachments 表（附件）
CREATE TABLE IF NOT EXISTS public.attachments (
    id text NOT NULL PRIMARY KEY,
    message_id text NOT NULL,
    file_name text NOT NULL,
    file_path text NOT NULL,
    file_size bigint NOT NULL,
    mime_type text NOT NULL,
    file_type text,
    s3_key text NOT NULL,
    s3_bucket text NOT NULL,
    thumbnail_url text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT attachments_message_id_fkey
        FOREIGN KEY (message_id) REFERENCES public.messages(id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

-- 14. notifications 表（通知）
CREATE TABLE IF NOT EXISTS public.notifications (
    id text NOT NULL PRIMARY KEY,
    user_id text NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    content text,
    related_message_id text,
    related_channel_id text,
    related_dm_conversation_id text,
    is_read boolean DEFAULT false NOT NULL,
    read_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT notifications_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.users(id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

-- 15. notification_settings 表（通知设置）
CREATE TABLE IF NOT EXISTS public.notification_settings (
    id text NOT NULL PRIMARY KEY,
    user_id text NOT NULL UNIQUE,
    mention_in_channel boolean DEFAULT true NOT NULL,
    mention_in_dm boolean DEFAULT true NOT NULL,
    channel_invite boolean DEFAULT true NOT NULL,
    browser_push boolean DEFAULT true NOT NULL,
    email_enabled boolean DEFAULT false NOT NULL,
    quiet_hours_start text,
    quiet_hours_end text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    CONSTRAINT notification_settings_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.users(id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

-- =====================================================
-- 第二部分：创建唯一约束
-- =====================================================

-- channel_members 唯一约束
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'channel_members_channel_id_user_id_key'
        AND conrelid = 'channel_members'::regclass
    ) THEN
        ALTER TABLE public.channel_members
        ADD CONSTRAINT channel_members_channel_id_user_id_key
        UNIQUE (channel_id, user_id);
    END IF;
END $$;

-- dm_conversation_members 唯一约束
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'dm_conversation_members_conversation_id_user_id_key'
        AND conrelid = 'dm_conversation_members'::regclass
    ) THEN
        ALTER TABLE public.dm_conversation_members
        ADD CONSTRAINT dm_conversation_members_conversation_id_user_id_key
        UNIQUE (conversation_id, user_id);
    END IF;
END $$;

-- message_mentions 唯一约束
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'message_mentions_message_id_mentioned_user_id_key'
        AND conrelid = 'message_mentions'::regclass
    ) THEN
        ALTER TABLE public.message_mentions
        ADD CONSTRAINT message_mentions_message_id_mentioned_user_id_key
        UNIQUE (message_id, mentioned_user_id);
    END IF;
END $$;

-- message_reactions 唯一约束
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'message_reactions_message_id_user_id_emoji_key'
        AND conrelid = 'message_reactions'::regclass
    ) THEN
        ALTER TABLE public.message_reactions
        ADD CONSTRAINT message_reactions_message_id_user_id_emoji_key
        UNIQUE (message_id, user_id, emoji);
    END IF;
END $$;

-- message_reads 唯一约束
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'message_reads_message_id_user_id_key'
        AND conrelid = 'message_reads'::regclass
    ) THEN
        ALTER TABLE public.message_reads
        ADD CONSTRAINT message_reads_message_id_user_id_key
        UNIQUE (message_id, user_id);
    END IF;
END $$;

-- =====================================================
-- 第三部分：创建索引
-- =====================================================

-- users 表索引
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at);

-- channels 表索引
CREATE INDEX IF NOT EXISTS idx_channels_name ON public.channels(name);
CREATE INDEX IF NOT EXISTS idx_channels_created_by ON public.channels(created_by);
CREATE INDEX IF NOT EXISTS idx_channels_is_archived ON public.channels(is_archived);

-- messages 表索引
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON public.messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_dm_conversation_id ON public.messages(dm_conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_parent_message_id ON public.messages(parent_message_id);

-- message_reactions 表索引（重点优化新功能）
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON public.message_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_emoji ON public.message_reactions(emoji);
CREATE INDEX IF NOT EXISTS idx_message_reactions_created_at ON public.message_reactions(created_at);

-- channel_members 表索引
CREATE INDEX IF NOT EXISTS idx_channel_members_channel_id ON public.channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_user_id ON public.channel_members(user_id);

-- dm_conversation_members 表索引
CREATE INDEX IF NOT EXISTS idx_dm_conversation_members_conversation_id ON public.dm_conversation_members(conversation_id);
CREATE INDEX IF NOT EXISTS idx_dm_conversation_members_user_id ON public.dm_conversation_members(user_id);

-- message_mentions 表索引
CREATE INDEX IF NOT EXISTS idx_message_mentions_message_id ON public.message_mentions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_mentions_mentioned_user_id ON public.message_mentions(mentioned_user_id);

-- notifications 表索引
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);

-- user_sessions 表索引
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON public.user_sessions(expires_at);

-- =====================================================
-- 第四部分：添加表和列注释
-- =====================================================

-- 表注释
COMMENT ON TABLE public.message_reactions IS '消息表情反应表 - 存储用户对消息的表情反应（如👍❤️😂等）';
COMMENT ON TABLE public.users IS '用户主表 - 存储所有用户基本信息';
COMMENT ON TABLE public.messages IS '消息主表 - 存储所有聊天消息内容';
COMMENT ON TABLE public.channels IS '频道表 - 存储聊天频道信息';
COMMENT ON TABLE public.dm_conversations IS '私信对话表 - 存储用户间私信对话';

-- 列注释
COMMENT ON COLUMN public.message_reactions.emoji IS '表情符号，如👍❤️😂等';
COMMENT ON COLUMN public.users.display_name IS '用户显示名称';
COMMENT ON COLUMN public.users.email_verification_code IS '邮箱验证码（临时存储）';
COMMENT ON COLUMN public.messages.is_edited IS '消息是否被编辑过';
COMMENT ON COLUMN public.messages.is_deleted IS '消息是否被删除（软删除）';

-- =====================================================
-- 第五部分：验证和统计
-- =====================================================

DO $$
DECLARE
    table_count integer;
    expected_tables text[] := ARRAY[
        'users', 'user_sessions', 'team_members', 'channels', 'channel_members',
        'dm_conversations', 'dm_conversation_members', 'messages', 'message_mentions',
        'message_reactions', 'message_reads', 'attachments', 'notifications',
        'notification_settings', '_prisma_migrations'
    ];
    missing_table text;
    table_exists boolean;
BEGIN
    RAISE NOTICE '=== 数据库表结构验证开始 ===';

    -- 检查每个表是否存在
    FOREACH missing_table IN ARRAY expected_tables
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = missing_table
        ) INTO table_exists;

        IF table_exists THEN
            RAISE NOTICE '✅ 表存在: %', missing_table;
        ELSE
            RAISE NOTICE '❌ 表缺失: %', missing_table;
        END IF;
    END LOOP;

    -- 统计总表数
    SELECT count(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE';

    RAISE NOTICE '=== 验证完成: 共 % 个表 ===', table_count;

    IF table_count >= 14 THEN
        RAISE NOTICE '✅ 数据库结构完整';
    ELSE
        RAISE NOTICE '⚠️  数据库结构不完整，请检查缺失的表';
    END IF;
END $$;

-- 显示各表数据统计
SELECT 'users' as table_name, count(*) as record_count FROM users
UNION ALL
SELECT 'channels', count(*) FROM channels
UNION ALL
SELECT 'messages', count(*) FROM messages
UNION ALL
SELECT 'team_members', count(*) FROM team_members
UNION ALL
SELECT 'channel_members', count(*) FROM channel_members
UNION ALL
SELECT 'dm_conversations', count(*) FROM dm_conversations
UNION ALL
SELECT 'dm_conversation_members', count(*) FROM dm_conversation_members
UNION ALL
SELECT 'message_mentions', count(*) FROM message_mentions
UNION ALL
SELECT 'message_reactions', count(*) FROM message_reactions
UNION ALL
SELECT 'message_reads', count(*) FROM message_reads
UNION ALL
SELECT 'attachments', count(*) FROM attachments
UNION ALL
SELECT 'notifications', count(*) FROM notifications
UNION ALL
SELECT 'notification_settings', count(*) FROM notification_settings
UNION ALL
SELECT 'user_sessions', count(*) FROM user_sessions
ORDER BY table_name;