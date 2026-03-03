#!/usr/bin/env python3
"""
生成缺失的 SQL 数据并追加到 slack-init.sql

支持两种模式:
1. 默认模式: 直接使用 Slack URL (需要登录 Slack 才能访问)
2. 下载模式: 下载 Slack 图片并上传到 OSS (需要配置 OSS 和 Slack Token)
"""

import json
import re
import uuid
import os
import sys
from datetime import datetime
from typing import Dict, List, Optional, Tuple

# 检查是否需要下载图片
DOWNLOAD_IMAGES = os.environ.get('DOWNLOAD_SLACK_IMAGES', 'false').lower() == 'true'
SLACK_TOKEN = os.environ.get('SLACK_BOT_TOKEN', '')
OSS_ACCESS_KEY_ID = os.environ.get('OSS_ACCESS_KEY_ID', '')
OSS_ACCESS_KEY_SECRET = os.environ.get('OSS_ACCESS_KEY_SECRET', '')
OSS_BUCKET = os.environ.get('OSS_BUCKET', '')
OSS_ENDPOINT = os.environ.get('OSS_ENDPOINT', '')
OSS_REGION = os.environ.get('OSS_REGION', 'oss-cn-hangzhou')
OSS_CUSTOM_DOMAIN = os.environ.get('OSS_CUSTOM_DOMAIN', '')

# 图片缓存
image_cache: Dict[str, Tuple[str, str, str]] = {}  # slack_url -> (oss_url, s3_key, s3_bucket)


def download_and_upload_to_oss(slack_url: str, file_name: str, mime_type: str) -> Optional[Tuple[str, str, str]]:
    """
    下载 Slack 图片并上传到 OSS
    返回: (oss_url, s3_key, s3_bucket)
    """
    if slack_url in image_cache:
        return image_cache[slack_url]

    try:
        import requests
        import oss2
    except ImportError as e:
        print(f"缺少依赖库: {e}")
        print("请运行: pip install requests oss2")
        return None

    # 下载文件
    headers = {}
    if SLACK_TOKEN:
        headers['Authorization'] = f'Bearer {SLACK_TOKEN}'

    try:
        response = requests.get(slack_url, headers=headers, timeout=60)
        if response.status_code != 200:
            print(f"  下载失败 {slack_url}: HTTP {response.status_code}")
            return None
        content = response.content
    except Exception as e:
        print(f"  下载错误 {slack_url}: {e}")
        return None

    # 确定文件扩展名
    ext = get_extension(mime_type, file_name, slack_url)

    # 生成唯一 key
    timestamp = int(datetime.now().timestamp())
    random_str = uuid.uuid4().hex[:8]
    s3_key = f"slack-migration/{timestamp}-{random_str}.{ext}"

    # 上传到 OSS
    try:
        auth = oss2.Auth(OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET)
        bucket = oss2.Bucket(auth, OSS_ENDPOINT, OSS_BUCKET)
        bucket.put_object(s3_key, content)

        # 生成 URL
        if OSS_CUSTOM_DOMAIN:
            oss_url = f"https://{OSS_CUSTOM_DOMAIN}/{s3_key}"
        else:
            oss_url = f"https://{OSS_BUCKET}.{OSS_REGION}.aliyuncs.com/{s3_key}"

        result = (oss_url, s3_key, OSS_BUCKET)
        image_cache[slack_url] = result
        print(f"  上传成功: {oss_url[:60]}...")
        return result

    except Exception as e:
        print(f"  OSS 上传错误: {e}")
        return None


def get_extension(mime_type: str, file_name: str, url: str) -> str:
    """获取文件扩展名"""
    # 从 mime type 映射
    mime_map = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'video/mp4': 'mp4',
        'video/quicktime': 'mov',
        'application/pdf': 'pdf',
    }

    ext = mime_map.get(mime_type.lower())
    if ext:
        return ext

    # 从文件名提取
    match = re.search(r'\.([a-zA-Z0-9]+)(?:\?|$)', file_name)
    if match:
        return match.group(1).lower()

    # 从 URL 提取
    match = re.search(r'\.([a-zA-Z0-9]+)(?:\?|$)', url)
    if match:
        return match.group(1).lower()

    return 'bin'

# 加载 JSON 数据
print("加载 JSON 数据...")
with open('/Users/yangsmac/Desktop/Slack/slack-data.json', 'r') as f:
    json_data = json.load(f)

# 加载现有 SQL
print("加载现有 SQL...")
with open('/Users/yangsmac/Desktop/Slack/db/slack-init.sql', 'r') as f:
    sql_content = f.read()

# ============================================
# 1. 建立 Channel 映射 (channel name -> SQL UUID)
# ============================================
print("建立 Channel 映射...")

# 直接从 SQL 文本中提取 channel name -> UUID
channel_name_to_uuid = {}

# 找到 channels INSERT
start = sql_content.find("INSERT INTO channels")
if start != -1:
    end = sql_content.find(';', start)
    channel_text = sql_content[start:end]

    # 使用正则提取
    pattern = r"\('([a-f0-9-]+)', '([^']+)',"
    for match in re.finditer(pattern, channel_text):
        uuid_val = match.group(1)
        name = match.group(2)
        channel_name_to_uuid[name] = uuid_val

print(f"SQL 中 channels: {len(channel_name_to_uuid)}")

# 从 JSON 中提取 channel 信息
json_channels = {ch['id']: ch['name'] for ch in json_data['channels']}
print(f"JSON 中 channels: {len(json_channels)}")

# 完整映射：Slack ID -> UUID
slack_channel_id_to_uuid = {}
for slack_id, name in json_channels.items():
    if name in channel_name_to_uuid:
        slack_channel_id_to_uuid[slack_id] = channel_name_to_uuid[name]
    else:
        print(f"  警告: Channel '{name}' (Slack ID: {slack_id}) 在 SQL 中未找到")

# ============================================
# 2. 建立 User 映射 (email -> SQL UUID)
# ============================================
print("\n建立 User 映射...")

# 直接从 SQL 文本中提取 email -> UUID
email_to_uuid = {}

start = sql_content.find("INSERT INTO users")
if start != -1:
    end = sql_content.find(';', start)
    user_text = sql_content[start:end]

    # 使用正则提取 id 和 email
    pattern = r"\('([a-f0-9-]+)', '([^']+@slack-import\.local)'"
    for match in re.finditer(pattern, user_text):
        uuid_val = match.group(1)
        email = match.group(2)
        email_to_uuid[email] = uuid_val

print(f"SQL 中用户: {len(email_to_uuid)}")

# 从 JSON 中建立 Slack ID -> email 映射
slack_user_to_email = {}
for user in json_data['users']:
    if user['name']:
        slack_user_to_email[user['id']] = f"{user['name']}@slack-import.local"

# 建立 Slack ID -> UUID 映射
slack_user_to_uuid = {}
for slack_id, email in slack_user_to_email.items():
    if email in email_to_uuid:
        slack_user_to_uuid[slack_id] = email_to_uuid[email]

print(f"用户映射建立: {len(slack_user_to_uuid)} 个")

# ============================================
# 3. 提取现有消息的 ID
# ============================================
print("\n提取现有消息 ID...")

# 从 messages 表中提取所有 UUID
msg_start = sql_content.find("INSERT INTO messages")
# 找到所有的 INSERT 语句
existing_msg_ids = set()

# 查找所有消息 INSERT
pattern = r"\('([a-f0-9-]{36})', '"
for match in re.finditer(pattern, sql_content):
    # 检查是否是消息表 (通过上下文判断)
    uuid_val = match.group(1)
    # 检查前后文是否是 messages 表
    start_pos = match.start()
    # 向前查找最近的表名
    before_text = sql_content[max(0, start_pos-100):start_pos]
    if 'INSERT INTO messages' in before_text:
        existing_msg_ids.add(uuid_val)

print(f"现有消息 ID 数量: {len(existing_msg_ids)}")

# ============================================
# 4. 收集需要添加的消息
# ============================================
print("\n收集需要添加的消息...")

messages_to_add = []
files_to_add = []

default_user_uuid = 'c525cccc-8f16-5f43-81dc-42e4a7a3c72b'  # 第一个用户

for channel_id, messages in json_data['messages'].items():
    channel_uuid = slack_channel_id_to_uuid.get(channel_id)
    if not channel_uuid:
        continue

    for msg in messages:
        msg_id = msg.get('ts', '').replace('.', '')
        # 生成一致的 UUID
        msg_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{channel_id}-{msg_id}"))

        # 检查是否已存在
        if msg_uuid in existing_msg_ids:
            continue

        # 获取用户 UUID
        user_slack_id = msg.get('user', '')
        user_uuid = slack_user_to_uuid.get(user_slack_id, default_user_uuid)

        # 转换时间戳
        ts = msg.get('ts', '0.0')
        try:
            timestamp = datetime.fromtimestamp(float(ts))
            created_at = timestamp.strftime('%Y-%m-%d %H:%M:%S+00')
        except:
            created_at = '2023-01-01 00:00:00+00'

        # 处理文本内容
        content = msg.get('text', '')
        # 转义单引号
        content = content.replace("'", "''")
        # 截断过长内容
        if len(content) > 2000:
            content = content[:2000]

        messages_to_add.append({
            'id': msg_uuid,
            'content': content,
            'message_type': 'message',
            'channel_id': channel_uuid,
            'user_id': user_uuid,
            'created_at': created_at,
            'updated_at': created_at,
            'is_thread_root': 'false'
        })

        # 处理文件/附件
        if 'files' in msg:
            for f in msg['files']:
                file_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f.get('id', '')))
                file_name = f.get('name', 'unknown').replace("'", "''")
                slack_url = f.get('url_private', '')
                file_size = f.get('size', 0)
                mime_type = f.get('mimetype', 'application/octet-stream')
                file_type = f.get('filetype', 'other')

                # 确定 file_path
                file_path = slack_url.replace("'", "''")
                s3_key = f"attachments/{file_uuid}/{file_name}"
                s3_bucket = 'q-and-a-chatbot'

                # 如果配置了下载图片，则下载并上传到 OSS
                if DOWNLOAD_IMAGES and slack_url and 'files.slack.com' in slack_url:
                    print(f"处理 Slack 文件: {file_name}")
                    result = download_and_upload_to_oss(slack_url, file_name, mime_type)
                    if result:
                        file_path = result[0].replace("'", "''")
                        s3_key = result[1]
                        s3_bucket = result[2]
                    else:
                        # 下载失败，保留原始 Slack URL
                        print(f"  保留原始 Slack URL")

                files_to_add.append({
                    'id': file_uuid,
                    'message_id': msg_uuid,
                    'file_name': file_name,
                    'file_path': file_path,
                    'file_size': file_size,
                    'mime_type': mime_type,
                    'file_type': file_type,
                    's3_key': s3_key,
                    's3_bucket': s3_bucket,
                    'created_at': created_at
                })

print(f"需要添加的消息: {len(messages_to_add)}")
print(f"需要添加的文件: {len(files_to_add)}")

# ============================================
# 5. 生成 SQL 语句
# ============================================
print("\n生成 SQL 语句...")

sql_statements = []

# 消息 SQL
if messages_to_add:
    sql_statements.append("\n-- =====================================================")
    sql_statements.append("-- Additional Messages Data")
    sql_statements.append("-- =====================================================")

    # 分批插入，每批 100 条
    batch_size = 100
    for i in range(0, len(messages_to_add), batch_size):
        batch = messages_to_add[i:i+batch_size]
        values = []
        for msg in batch:
            values.append(f"('{msg['id']}', '{msg['content']}', '{msg['message_type']}', '{msg['channel_id']}', '{msg['user_id']}', '{msg['created_at']}', '{msg['updated_at']}', {msg['is_thread_root']})")

        sql = "INSERT INTO messages (id, content, message_type, channel_id, user_id, created_at, updated_at, is_thread_root) VALUES\n"
        sql += ",\n".join(values) + ";"
        sql_statements.append(sql)

# 附件 SQL
if files_to_add:
    sql_statements.append("\n-- =====================================================")
    sql_statements.append("-- Additional Attachments Data")
    sql_statements.append("-- =====================================================")

    batch_size = 100
    for i in range(0, len(files_to_add), batch_size):
        batch = files_to_add[i:i+batch_size]
        values = []
        for f in batch:
            values.append(f"('{f['id']}', '{f['message_id']}', '{f['file_name']}', '{f['file_path']}', {f['file_size']}, '{f['mime_type']}', '{f['file_type']}', '{f['s3_key']}', '{f['s3_bucket']}', '{f['created_at']}')")

        sql = "INSERT INTO attachments (id, message_id, file_name, file_path, file_size, mime_type, file_type, s3_key, s3_bucket, created_at) VALUES\n"
        sql += ",\n".join(values) + ";"
        sql_statements.append(sql)

# 输出 SQL
output_sql = "\n".join(sql_statements)

# 保存到文件
output_file = '/Users/yangsmac/Desktop/Slack/db/slack-init-additional.sql'
with open(output_file, 'w') as f:
    f.write(output_sql)

print(f"\nSQL 语句已生成到: {output_file}")
print(f"消息 SQL 批次数: {len([s for s in sql_statements if 'INSERT INTO messages' in s])}")
print(f"附件 SQL 批次数: {len([s for s in sql_statements if 'INSERT INTO attachments' in s])}")

# 统计大小
total_msg_size = sum(len(m['content']) for m in messages_to_add)
total_file_size = sum(f['file_size'] for f in files_to_add)
print(f"\n消息内容总大小: {total_msg_size / 1024:.1f} KB")
print(f"文件总大小: {total_file_size / 1024 / 1024:.1f} MB")
