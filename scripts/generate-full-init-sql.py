#!/usr/bin/env python3
"""
完整生成 slack-init.sql
根据 slack-data.json 生成所有数据，包括 users, channels, messages, channel_members 等
"""
import json
import uuid
from datetime import datetime, timedelta

print("Loading slack-data.json...")
with open('/Users/yangsmac/Desktop/Slack/slack-data.json', 'r') as f:
    data = json.load(f)

exported_at = data.get('exportedAt', datetime.utcnow().isoformat() + 'Z')

# 生成文件头
sql_content = f"""-- =====================================================
-- Slack 数据初始化 SQL
-- 生成时间: {exported_at}
-- =====================================================

-- 清空现有数据
TRUNCATE TABLE message_reads CASCADE;
TRUNCATE TABLE message_reactions CASCADE;
TRUNCATE TABLE message_mentions CASCADE;
TRUNCATE TABLE attachments CASCADE;
TRUNCATE TABLE notifications CASCADE;
TRUNCATE TABLE dm_conversation_members CASCADE;
TRUNCATE TABLE dm_conversations CASCADE;
TRUNCATE TABLE channel_members CASCADE;
TRUNCATE TABLE messages CASCADE;
TRUNCATE TABLE channels CASCADE;
TRUNCATE TABLE notification_settings CASCADE;
TRUNCATE TABLE team_members CASCADE;
TRUNCATE TABLE users CASCADE;

"""

# 1. Users
print("Generating users...")
sql_content += "-- 用户数据\n"

# 转义单引号的辅助函数
def escape_sql(s):
    if s is None:
        return ''
    return str(s).replace("'", "''")

# 生成用户数据 - 使用批量插入
users_list = []
for u in data['users']:
    slack_id = u['id']
    name = u['name']
    email = f"{name}@slack-import.local"
    real_name = escape_sql(u.get('real_name', name))
    display_name = escape_sql(u.get('profile', {}).get('display_name', name))
    avatar_url = u.get('profile', {}).get('image_72', '')
    is_deleted = u.get('deleted', False)
    is_bot = u.get('is_bot', False)

    # 生成 UUID (基于 Slack ID)
    user_uuid = str(uuid.uuid5(uuid.NAMESPACE_URL, slack_id))

    status = 'inactive' if is_deleted else 'active'

    users_list.append({
        'id': user_uuid,
        'slack_id': slack_id,
        'email': email,
        'name': name,
        'real_name': real_name,
        'display_name': display_name,
        'avatar_url': avatar_url,
        'status': status,
        'is_bot': is_bot
    })

# 批量插入用户（每500条一个INSERT）
batch_size = 500
for i in range(0, len(users_list), batch_size):
    batch = users_list[i:i+batch_size]
    sql_content += "INSERT INTO users (id, email, password_hash, display_name, real_name, avatar_url, created_at, status, email_verified_at, updated_at) VALUES\n"
    values = []
    for u in batch:
        values.append(f"('{u['id']}', '{u['email']}', '$2a$10$nFidPm8fyhwtQ4ni22.q6uwlU9NaB.pZkZeVSMjoX1gVGqThSiGN6', '{u['display_name']}', '{u['real_name']}', '{u['avatar_url']}', NOW(), '{u['status']}', NOW(), NOW())")
    sql_content += ',\n'.join(values) + ';\n\n'

print(f"Generated {len(users_list)} users")

# 2. Channels
print("Generating channels...")
sql_content += "-- 频道数据\n"

channels_list = []
channel_slack_id_to_uuid = {}
for ch in data['channels']:
    slack_id = ch['id']
    name = ch['name']
    description = f"{name} channel"
    is_private = ch.get('is_private', False)
    is_archived = ch.get('is_archived', False)

    # 生成 UUID
    channel_uuid = str(uuid.uuid5(uuid.NAMESPACE_URL, slack_id))
    channel_slack_id_to_uuid[slack_id] = channel_uuid

    # 随机选择一个创建者
    creator_uuid = users_list[0]['id'] if users_list else ''

    channels_list.append({
        'id': channel_uuid,
        'slack_id': slack_id,
        'name': name,
        'description': description,
        'is_private': is_private,
        'is_archived': is_archived,
        'created_by': creator_uuid,
        'num_members': ch.get('num_members', 0)
    })

# 批量插入频道
sql_content += "INSERT INTO channels (id, name, description, is_private, is_archived, created_by, created_at, updated_at) VALUES\n"
channel_values = []
for ch in channels_list:
    channel_values.append(f"('{ch['id']}', '{ch['name']}', '{ch['description']}', {'true' if ch['is_private'] else 'false'}, {'true' if ch['is_archived'] else 'false'}, '{ch['created_by']}', NOW(), NOW())")
sql_content += ',\n'.join(channel_values) + ';\n\n'

print(f"Generated {len(channels_list)} channels")

# 3. Messages
print("Generating messages...")
sql_content += "-- 消息数据\n"

# 收集所有消息
all_messages = []
for channel_id, msgs in data['messages'].items():
    if channel_id not in channel_slack_id_to_uuid:
        continue

    channel_uuid = channel_slack_id_to_uuid[channel_id]

    for msg in msgs:
        msg_type = msg.get('type', 'message')
        text = escape_sql(msg.get('text', ''))  # 转义单引号并保留实际的换行符
        user_slack_id = msg.get('user', '')

        # 找到对应的用户 UUID
        user_uuid = None
        for u in users_list:
            if u['slack_id'] == user_slack_id:
                user_uuid = u['id']
                break

        if not user_uuid:
            continue

        # 生成消息 UUID
        msg_uuid = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{channel_id}-{msg.get('ts', '')}"))

        all_messages.append({
            'id': msg_uuid,
            'channel_id': channel_uuid,
            'user_id': user_uuid,
            'content': text,
            'message_type': msg_type
        })

# 批量插入消息
batch_size = 500
for i in range(0, len(all_messages), batch_size):
    batch = all_messages[i:i+batch_size]
    sql_content += "INSERT INTO messages (id, content, message_type, channel_id, user_id, created_at, updated_at, is_thread_root) VALUES\n"
    values = []
    for m in batch:
        values.append(f"('{m['id']}', '{m['content']}', '{m['message_type']}', '{m['channel_id']}', '{m['user_id']}', NOW(), NOW(), false)")
    sql_content += ',\n'.join(values) + ';\n\n'

print(f"Generated {len(all_messages)} messages")

# 4. Channel Members
print("Generating channel members...")
sql_content += "-- 频道成员数据\n"

# 为每个频道生成成员
channel_member_count = 0
for ch in channels_list:
    channel_uuid = ch['id']
    num_members = ch['num_members']

    # 获取该频道的消息发送者作为成员
    channel_messages = [m for m in all_messages if m['channel_id'] == channel_uuid]
    member_user_ids = set(m['user_id'] for m in channel_messages)

    # 添加更多随机成员（如果需要）
    if len(member_user_ids) < num_members:
        # 从所有用户中随机添加
        import random
        all_user_ids = [u['id'] for u in users_list]
        additional_members = random.sample(all_user_ids, min(num_members - len(member_user_ids), len(all_user_ids)))
        member_user_ids.update(additional_members)

    # 生成 member_id
    member_ids = list(member_user_ids)[:num_members]  # 限制数量

    # 批量插入
    batch_size = 500
    for i in range(0, len(member_ids), batch_size):
        batch = member_ids[i:i+batch_size]
        sql_content += "INSERT INTO channel_members (id, channel_id, user_id, role, notification_level, created_at, updated_at) VALUES\n"
        values = []
        for j, user_uuid in enumerate(batch):
            role = 'admin' if j == 0 else 'member'
            values.append(f"('{str(uuid.uuid4())}', '{channel_uuid}', '{user_uuid}', '{role}', 'all', NOW(), NOW())")
        sql_content += ',\n'.join(values) + ';\n'
        channel_member_count += len(batch)

sql_content += '\n'
print(f"Generated {channel_member_count} channel members")

# 5. DM Conversations
print("Generating DM conversations...")
sql_content += "-- DM 对话数据\n"

# 选择一些活跃用户创建 DM
dm_user_pairs = []
import random
random.seed(42)  # 固定随机种子以便复现

# 随机选择一些用户对创建 DM
selected_users = random.sample(users_list, min(20, len(users_list)))
for i in range(0, len(selected_users) - 1, 2):
    dm_user_pairs.append((selected_users[i], selected_users[i+1]))

dm_values = []
dm_members_values = []
for i, (user1, user2) in enumerate(dm_user_pairs):
    dm_id = str(uuid.uuid4())
    dm_values.append(f"('{dm_id}', '{user1['id']}', NOW(), NOW())")

    dm_members_values.append(f"('{str(uuid.uuid4())}', '{dm_id}', '{user1['id']}', NOW(), NOW(), NOW())")
    dm_members_values.append(f"('{str(uuid.uuid4())}', '{dm_id}', '{user2['id']}', NOW(), NOW(), NOW())")

if dm_values:
    sql_content += "INSERT INTO dm_conversations (id, created_by, created_at, updated_at) VALUES\n"
    sql_content += ',\n'.join(dm_values) + ';\n\n'

    sql_content += "INSERT INTO dm_conversation_members (id, conversation_id, user_id, joined_at, created_at, updated_at) VALUES\n"
    sql_content += ',\n'.join(dm_members_values) + ';\n\n'

print(f"Generated {len(dm_user_pairs)} DM conversations")

# 6. Message Reactions
print("Generating message reactions...")
sql_content += "-- 消息 Reactions 数据\n"

reactions = ['thumbsup', 'heart', 'thumbsdown', 'celebration', 'rocket', 'eyes', 'brain']
reaction_count = 0

# 为前几百条消息添加 reactions
sample_messages = random.sample(all_messages, min(200, len(all_messages)))
reaction_values = []

for m in sample_messages:
    # 随机选择一些用户添加 reaction
    num_reactions = random.randint(0, 3)
    reacted_users = random.sample(users_list, min(num_reactions, len(users_list)))

    for u in reacted_users:
        emoji = random.choice(reactions)
        reaction_values.append(f"('{str(uuid.uuid4())}', '{m['id']}', '{u['id']}', '{emoji}', NOW())")
        reaction_count += 1

# 批量插入
if reaction_values:
    batch_size = 500
    for i in range(0, len(reaction_values), batch_size):
        batch = reaction_values[i:i+batch_size]
        sql_content += "INSERT INTO message_reactions (id, message_id, user_id, emoji, created_at) VALUES\n"
        sql_content += ',\n'.join(batch) + ';\n'

sql_content += '\n'
print(f"Generated {reaction_count} message reactions")

# 7. Notifications
print("Generating notifications...")
sql_content += "-- 通知数据\n"

notification_types = ['message', 'mention', 'reaction', 'dm']
notification_titles = [
    'New message in channel',
    'You were mentioned in a message',
    'Someone reacted to your message',
    'New direct message'
]

notification_values = []
sample_users = random.sample(users_list, min(50, len(users_list)))

for i, u in enumerate(sample_users):
    notif_type = notification_types[i % len(notification_types)]
    title = notification_titles[i % len(notification_titles)]
    is_read = 'true' if i % 3 == 0 else 'false'

    notification_values.append(f"('{str(uuid.uuid4())}', '{u['id']}', '{notif_type}', '{title}', 'Sample notification content', NULL, NULL, NULL, {is_read}, NULL, NOW())")

if notification_values:
    sql_content += "INSERT INTO notifications (id, user_id, type, title, content, related_message_id, related_thread_id, related_channel_id, is_read, read_at, created_at) VALUES\n"
    sql_content += ',\n'.join(notification_values) + ';\n\n'

print(f"Generated {len(notification_values)} notifications")

# 8. Message Reads
print("Generating message reads...")
sql_content += "-- 消息阅读记录数据\n"

read_values = []
sample_users = random.sample(users_list, min(30, len(users_list)))
sample_channels = random.sample(channels_list, min(20, len(channels_list)))

for i, u in enumerate(sample_users):
    for j, ch in enumerate(sample_channels[:3]):  # 每个用户最多3个频道的阅读记录
        channel_messages = [m for m in all_messages if m['channel_id'] == ch['id']]
        if channel_messages:
            last_read = random.choice(channel_messages)
            read_values.append(f"('{str(uuid.uuid4())}', '{last_read['id']}', '{u['id']}', NOW())")

if read_values:
    sql_content += "INSERT INTO message_reads (id, message_id, user_id, read_at) VALUES\n"
    sql_content += ',\n'.join(read_values) + ';\n\n'

print(f"Generated {len(read_values)} message reads")

# 写入文件
output_file = '/Users/yangsmac/Desktop/Slack/db/slack-init.sql'
with open(output_file, 'w') as f:
    f.write(sql_content)

print(f"\n✅ Complete SQL generated to: {output_file}")
print(f"   - Users: {len(users_list)}")
print(f"   - Channels: {len(channels_list)}")
print(f"   - Messages: {len(all_messages)}")
print(f"   - Channel Members: {channel_member_count}")
print(f"   - DM Conversations: {len(dm_user_pairs)}")
print(f"   - Reactions: {reaction_count}")
print(f"   - Notifications: {len(notification_values)}")
print(f"   - Message Reads: {len(read_values)}")
