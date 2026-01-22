-- =====================================================
-- Slack-like 聊天工具数据库初始化脚本
-- PostgreSQL 13+
-- =====================================================

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- =====================================================
-- 1. 用户相关表
-- =====================================================

-- 用户表
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    display_name VARCHAR(100) NOT NULL,
    real_name VARCHAR(100),
    avatar_url TEXT,
    status VARCHAR(20) DEFAULT 'active', -- active, inactive, suspended
    timezone VARCHAR(50) DEFAULT 'UTC',
    last_seen_at TIMESTAMPTZ,
    is_online BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 用户会话表
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 团队成员关系表
CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member', -- owner, admin, member
    status VARCHAR(20) DEFAULT 'active', -- active, inactive, pending
    invited_by UUID REFERENCES users(id),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- =====================================================
-- 2. 频道相关表
-- =====================================================

-- 频道表
CREATE TABLE channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_private BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(name)
);

-- 频道成员关系表
CREATE TABLE channel_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member', -- owner, admin, member
    last_read_at TIMESTAMPTZ DEFAULT '1970-01-01',
    unread_count INTEGER DEFAULT 0,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(channel_id, user_id)
);

-- =====================================================
-- 3. 私聊相关表
-- =====================================================

-- DM 对话表
CREATE TABLE dm_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_by UUID NOT NULL REFERENCES users(id),
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- DM 成员关系表
CREATE TABLE dm_conversation_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ DEFAULT '1970-01-01',
    unread_count INTEGER DEFAULT 0,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(conversation_id, user_id)
);

-- =====================================================
-- 4. 消息相关表
-- =====================================================

-- 消息表
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    content_search TSVECTOR,
    message_type VARCHAR(20) DEFAULT 'text', -- text, image, file, system
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    dm_conversation_id UUID REFERENCES dm_conversations(id) ON DELETE CASCADE,
    parent_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT messages_channel_or_dm CHECK (
        (channel_id IS NOT NULL AND dm_conversation_id IS NULL) OR
        (channel_id IS NULL AND dm_conversation_id IS NOT NULL)
    )
);

-- @ 提及表
CREATE TABLE message_mentions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    mentioned_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, mentioned_user_id)
);

-- 消息阅读状态表
CREATE TABLE message_reads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

-- =====================================================
-- 5. 文件相关表
-- =====================================================

-- 附件表
CREATE TABLE attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_type VARCHAR(50), -- image, document, video, audio, other
    s3_key TEXT NOT NULL,
    s3_bucket VARCHAR(255) NOT NULL,
    thumbnail_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 6. 通知相关表
-- =====================================================

-- 通知表
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- mention, dm, channel_invite, etc.
    title VARCHAR(255) NOT NULL,
    content TEXT,
    related_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    related_channel_id UUID REFERENCES channels(id) ON DELETE SET NULL,
    related_dm_conversation_id UUID REFERENCES dm_conversations(id) ON DELETE SET NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 通知偏好设置表
CREATE TABLE notification_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    mention_in_channel BOOLEAN DEFAULT TRUE,
    mention_in_dm BOOLEAN DEFAULT TRUE,
    channel_invite BOOLEAN DEFAULT TRUE,
    browser_push BOOLEAN DEFAULT TRUE,
    email_enabled BOOLEAN DEFAULT FALSE,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 7. 索引创建
-- =====================================================

-- 用户表索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_is_online ON users(is_online);
CREATE INDEX idx_users_last_seen ON users(last_seen_at DESC);

-- 用户会话表索引
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(token_hash);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

-- 团队成员表索引
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_role ON team_members(role);

-- 频道表索引
CREATE INDEX idx_channels_is_archived ON channels(is_archived);
CREATE INDEX idx_channels_is_private ON channels(is_private);
CREATE INDEX idx_channels_created_by ON channels(created_by);

-- 频道成员表索引
CREATE INDEX idx_channel_members_channel_id ON channel_members(channel_id);
CREATE INDEX idx_channel_members_user_id ON channel_members(user_id);
CREATE INDEX idx_channel_members_unread_count ON channel_members(unread_count DESC);
CREATE INDEX idx_channel_members_last_read ON channel_members(last_read_at);

-- DM 对话表索引
CREATE INDEX idx_dm_conversations_created_by ON dm_conversations(created_by);
CREATE INDEX idx_dm_conversations_last_message ON dm_conversations(last_message_at DESC);

-- DM 成员表索引
CREATE INDEX idx_dm_conversation_members_conversation_id ON dm_conversation_members(conversation_id);
CREATE INDEX idx_dm_conversation_members_user_id ON dm_conversation_members(user_id);
CREATE INDEX idx_dm_conversation_members_unread_count ON dm_conversation_members(unread_count DESC);

-- 消息表索引
CREATE INDEX idx_messages_channel_id ON messages(channel_id) WHERE channel_id IS NOT NULL;
CREATE INDEX idx_messages_dm_conversation_id ON messages(dm_conversation_id) WHERE dm_conversation_id IS NOT NULL;
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_parent_message ON messages(parent_message_id);
CREATE INDEX idx_messages_is_deleted ON messages(is_deleted) WHERE is_deleted = FALSE;
CREATE INDEX idx_messages_message_type ON messages(message_type);

-- 消息全文搜索索引
CREATE INDEX idx_messages_content_search ON messages USING gin(content_search);

-- @ 提及表索引
CREATE INDEX idx_message_mentions_message_id ON message_mentions(message_id);
CREATE INDEX idx_message_mentions_mentioned_user ON message_mentions(mentioned_user_id);

-- 消息阅读状态索引
CREATE INDEX idx_message_reads_message_id ON message_reads(message_id);
CREATE INDEX idx_message_reads_user_id ON message_reads(user_id);

-- 附件表索引
CREATE INDEX idx_attachments_message_id ON attachments(message_id);
CREATE INDEX idx_attachments_file_type ON attachments(file_type);
CREATE INDEX idx_attachments_mime_type ON attachments(mime_type);

-- 通知表索引
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- =====================================================
-- 8. 触发器函数
-- =====================================================

-- 更新 updated_at 字段的通用函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为相关表添加 updated_at 触发器
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_team_members_updated_at BEFORE UPDATE ON team_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON channels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_channel_members_updated_at BEFORE UPDATE ON channel_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dm_conversations_updated_at BEFORE UPDATE ON dm_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dm_conversation_members_updated_at BEFORE UPDATE ON dm_conversation_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_settings_updated_at BEFORE UPDATE ON notification_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 消息全文搜索更新触发器
CREATE OR REPLACE FUNCTION update_message_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.content != OLD.content) THEN
        NEW.content_search = to_tsvector('simple', unaccent(NEW.content));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_messages_search_vector
    BEFORE INSERT OR UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_message_search_vector();

-- 更新未读计数的触发器函数
CREATE OR REPLACE FUNCTION update_unread_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- 更新频道未读计数
        IF NEW.channel_id IS NOT NULL THEN
            UPDATE channel_members
            SET unread_count = unread_count + 1
            WHERE channel_id = NEW.channel_id
            AND user_id != NEW.user_id;
        END IF;

        -- 更新 DM 未读计数
        IF NEW.dm_conversation_id IS NOT NULL THEN
            UPDATE dm_conversation_members
            SET unread_count = unread_count + 1
            WHERE conversation_id = NEW.dm_conversation_id
            AND user_id != NEW.user_id;
        END IF;

        -- 更新最后消息时间
        IF NEW.channel_id IS NOT NULL THEN
            UPDATE channels SET updated_at = NOW() WHERE id = NEW.channel_id;
        END IF;

        IF NEW.dm_conversation_id IS NOT NULL THEN
            UPDATE dm_conversations SET last_message_at = NOW(), updated_at = NOW()
            WHERE id = NEW.dm_conversation_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_unread_count_trigger
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION update_unread_count();

-- 重置未读计数的触发器函数
CREATE OR REPLACE FUNCTION reset_unread_count()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.last_read_at > OLD.last_read_at THEN
        IF TG_TABLE_NAME = 'channel_members' THEN
            -- 重置频道未读计数
            UPDATE channel_members
            SET unread_count = 0
            WHERE channel_id = NEW.channel_id
            AND user_id = NEW.user_id;
        ELSIF TG_TABLE_NAME = 'dm_conversation_members' THEN
            -- 重置 DM 未读计数
            UPDATE dm_conversation_members
            SET unread_count = 0
            WHERE conversation_id = NEW.conversation_id
            AND user_id = NEW.user_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reset_channel_unread_count
    BEFORE UPDATE ON channel_members
    FOR EACH ROW EXECUTE FUNCTION reset_unread_count();

CREATE TRIGGER reset_dm_unread_count
    BEFORE UPDATE ON dm_conversation_members
    FOR EACH ROW EXECUTE FUNCTION reset_unread_count();

-- =====================================================
-- 9. 视图创建
-- =====================================================

-- 频道详细信息视图
CREATE VIEW channel_details AS
SELECT
    c.*,
    u.display_name as creator_name,
    (SELECT COUNT(*) FROM channel_members cm WHERE cm.channel_id = c.id) as member_count
FROM channels c
JOIN users u ON c.created_by = u.id;

-- DM 对话详细信息视图
CREATE VIEW dm_conversation_details AS
SELECT
    dc.*,
    u1.display_name as creator_name,
    STRING_AGG(u.display_name, ', ' ORDER BY u.display_name) as participant_names
FROM dm_conversations dc
JOIN users u1 ON dc.created_by = u1.id
JOIN dm_conversation_members dcm ON dc.id = dcm.conversation_id
JOIN users u ON dcm.user_id = u.id
GROUP BY dc.id, u1.display_name;

-- 消息详细信息视图
CREATE VIEW message_details AS
SELECT
    m.*,
    u.display_name as user_name,
    u.avatar_url as user_avatar,
    c.name as channel_name,
    (SELECT COUNT(*) FROM message_mentions mm WHERE mm.message_id = m.id) as mention_count,
    (SELECT COUNT(*) FROM message_reactions mr WHERE mr.message_id = m.id) as reaction_count
FROM messages m
JOIN users u ON m.user_id = u.id
LEFT JOIN channels c ON m.channel_id = c.id;

-- 用户活动统计视图
CREATE VIEW user_activity_stats AS
SELECT
    u.id,
    u.display_name,
    u.email,
    u.is_online,
    u.last_seen_at,
    COALESCE(msg_stats.message_count, 0) as message_count,
    COALESCE(channel_stats.channel_count, 0) as channel_count
FROM users u
LEFT JOIN (
    SELECT user_id, COUNT(*) as message_count
    FROM messages
    WHERE is_deleted = FALSE
    GROUP BY user_id
) msg_stats ON u.id = msg_stats.user_id
LEFT JOIN (
    SELECT user_id, COUNT(*) as channel_count
    FROM channel_members
    GROUP BY user_id
) channel_stats ON u.id = channel_stats.user_id;

-- =====================================================
-- 10. 初始化数据
-- =====================================================

-- 插入默认管理员用户
INSERT INTO users (id, email, password_hash, display_name, real_name, email_verified_at) VALUES
('00000000-0000-0000-0000-000000000001', 'admin@example.com', crypt('admin123', gen_salt('bf')), 'Admin', 'System Administrator', NOW());

-- 插入示例用户
INSERT INTO users (id, email, password_hash, display_name, real_name, email_verified_at) VALUES
('00000000-0000-0000-0000-000000000002', 'alice@example.com', crypt('password123', gen_salt('bf')), 'Alice', 'Alice Smith', NOW()),
('00000000-0000-0000-0000-000000000003', 'bob@example.com', crypt('password123', gen_salt('bf')), 'Bob', 'Bob Johnson', NOW()),
('00000000-0000-0000-0000-000000000004', 'charlie@example.com', crypt('password123', gen_salt('bf')), 'Charlie', 'Charlie Brown', NOW());

-- 将所有用户添加为团队成员
INSERT INTO team_members (user_id, role) VALUES
('00000000-0000-0000-0000-000000000001', 'owner'),
('00000000-0000-0000-0000-000000000002', 'member'),
('00000000-0000-0000-0000-000000000003', 'member'),
('00000000-0000-0000-0000-000000000004', 'member');

-- 创建默认频道
INSERT INTO channels (id, name, description, created_by) VALUES
('10000000-0000-0000-0000-000000000001', 'general', 'General discussion', '00000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000002', 'random', 'Random topics', '00000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000003', 'announcements', 'Team announcements', '00000000-0000-0000-0000-000000000001');

-- 将所有用户添加到默认频道
INSERT INTO channel_members (channel_id, user_id) VALUES
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'),
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003'),
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004'),
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002'),
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003'),
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004'),
('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002'),
('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003'),
('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004');

-- 创建示例 DM 对话
INSERT INTO dm_conversations (id, created_by) VALUES
('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');

-- 添加 DM 成员
INSERT INTO dm_conversation_members (conversation_id, user_id) VALUES
('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'),
('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003');

-- 插入示例消息
INSERT INTO messages (content, message_type, channel_id, user_id) VALUES
('Welcome to our Slack-like chat tool! 🎉', 'system', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'),
('Hello everyone! Excited to be here.', 'text', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'),
('Great to have you @Alice!', 'text', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003'),
('Let''s start building something amazing!', 'text', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'),
('Hey @Bob, have you seen the new design?', 'text', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');

-- 插入 @ 提及
INSERT INTO message_mentions (message_id, mentioned_user_id)
SELECT m.id, '00000000-0000-0000-0000-000000000002'
FROM messages m
WHERE m.content LIKE '%@Alice%';

INSERT INTO message_mentions (message_id, mentioned_user_id)
SELECT m.id, '00000000-0000-0000-0000-000000000003'
FROM messages m
WHERE m.content LIKE '%@Bob%';

-- 设置默认通知偏好
INSERT INTO notification_settings (user_id) VALUES
('00000000-0000-0000-0000-000000000001'),
('00000000-0000-0000-0000-000000000002'),
('00000000-0000-0000-0000-000000000003'),
('00000000-0000-0000-0000-000000000004');

-- 插入示例通知
INSERT INTO notifications (user_id, type, title, content, related_message_id)
SELECT
    mm.mentioned_user_id,
    'mention',
    'You were mentioned',
    'You were mentioned in a message',
    mm.message_id
FROM message_mentions mm;

-- =====================================================
-- 完成
-- =====================================================

-- 输出完成信息
SELECT 'Database initialization completed successfully!' as status;