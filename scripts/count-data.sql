-- 检查数据插入情况的查询脚本

-- 查看用户表
SELECT 'users' as table_name, count(*) as count FROM users
UNION ALL

-- 查看频道表
SELECT 'channels' as table_name, count(*) as count FROM channels
UNION ALL

-- 查看消息表
SELECT 'messages' as table_name, count(*) as count FROM messages
UNION ALL

-- 查看团队成员表
SELECT 'team_members' as table_name, count(*) as count FROM team_members
UNION ALL

-- 查看频道成员表
SELECT 'channel_members' as table_name, count(*) as count FROM channel_members;