-- Query script to check data insertion status

-- View users table
SELECT 'users' as table_name, count(*) as count FROM users
UNION ALL

-- View channels table
SELECT 'channels' as table_name, count(*) as count FROM channels
UNION ALL

-- View messages table
SELECT 'messages' as table_name, count(*) as count FROM messages
UNION ALL

-- View team_members table
SELECT 'team_members' as table_name, count(*) as count FROM team_members
UNION ALL

-- View channel_members table
SELECT 'channel_members' as table_name, count(*) as count FROM channel_members;