-- =====================================================
-- 生产环境数据库表结构补充脚本
-- 用于添加本地开发环境存在但生产环境缺失的表
-- =====================================================

-- 1. 创建 _prisma_migrations 表（Prisma迁移记录）
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

-- 2. 创建 users 表（用户主表）
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

-- 3. 创建 message_reactions 表（消息反应表）- 新功能
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

-- 4. 创建 unique 约束
DO $$
BEGIN
    -- message_reactions表的唯一约束
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

-- 5. 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON public.message_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_emoji ON public.message_reactions(emoji);
CREATE INDEX IF NOT EXISTS idx_message_reactions_created_at ON public.message_reactions(created_at);

-- 6. 创建用户表的相关索引
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at);

-- 7. 为现有表添加缺失的外键约束（如果不存在）

-- 8. 添加注释
COMMENT ON TABLE public.message_reactions IS '消息表情反应表 - 存储用户对消息的表情反应';
COMMENT ON COLUMN public.message_reactions.emoji IS '表情符号，如👍❤️😂等';
COMMENT ON COLUMN public.message_reactions.created_at IS '反应创建时间';

COMMENT ON TABLE public.users IS '用户主表 - 存储所有用户信息';
COMMENT ON COLUMN public.users.display_name IS '显示名称';
COMMENT ON COLUMN public.users.email_verification_code IS '邮箱验证码（临时）';
COMMENT ON COLUMN public.users.email_code_expires_at IS '验证码过期时间';

-- 9. 验证表创建结果
DO $$
DECLARE
    table_count integer;
BEGIN
    SELECT count(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('users', 'message_reactions', '_prisma_migrations');

    IF table_count = 3 THEN
        RAISE NOTICE '✅ 成功创建 % 个缺失的表', table_count;
    ELSE
        RAISE NOTICE '⚠️  只创建了 % 个表，请检查', table_count;
    END IF;
END $$;

-- 10. 显示创建结果
SELECT 'message_reactions' as table_name, count(*) as count FROM message_reactions
UNION ALL
SELECT 'users', count(*) FROM users
UNION ALL
SELECT '_prisma_migrations', count(*) FROM _prisma_migrations;