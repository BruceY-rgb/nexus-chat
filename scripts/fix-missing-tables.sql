-- =====================================================
-- Production environment database table supplement script
-- Used to add tables that exist in local development but are missing in production
-- =====================================================

-- 1. Create _prisma_migrations table (Prisma migration records)
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

-- 2. Create users table (users master table)
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

-- 3. Create message_reactions table (message reactions table) - New feature
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

-- 4. Create unique constraint
DO $$
BEGIN
    -- Unique constraint for message_reactions table
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

-- 5. Create indexes to optimize query performance
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON public.message_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_emoji ON public.message_reactions(emoji);
CREATE INDEX IF NOT EXISTS idx_message_reactions_created_at ON public.message_reactions(created_at);

-- 6. Create related indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at);

-- 7. Add missing foreign key constraints to existing tables (if not exists)

-- 8. Add comments
COMMENT ON TABLE public.message_reactions IS 'Message emoji reaction table - Stores user emoji reactions to messages';
COMMENT ON COLUMN public.message_reactions.emoji IS 'Emoji symbols such as 👍❤️😂 etc';
COMMENT ON COLUMN public.message_reactions.created_at IS 'Reaction creation time';

COMMENT ON TABLE public.users IS 'Users master table - Stores all user information';
COMMENT ON COLUMN public.users.display_name IS 'Display name';
COMMENT ON COLUMN public.users.email_verification_code IS 'Email verification code (temporary)';
COMMENT ON COLUMN public.users.email_code_expires_at IS 'Verification code expiration time';

-- 9. Verify table creation results
DO $$
DECLARE
    table_count integer;
BEGIN
    SELECT count(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('users', 'message_reactions', '_prisma_migrations');

    IF table_count = 3 THEN
        RAISE NOTICE 'Successfully created % missing tables', table_count;
    ELSE
        RAISE NOTICE 'Only % tables created, please check', table_count;
    END IF;
END $$;

-- 10. Show creation results
SELECT 'message_reactions' as table_name, count(*) as count FROM message_reactions
UNION ALL
SELECT 'users', count(*) FROM users
UNION ALL
SELECT '_prisma_migrations', count(*) FROM _prisma_migrations;