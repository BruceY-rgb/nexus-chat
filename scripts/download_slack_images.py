#!/usr/bin/env python3
"""
简化的 Slack 图片迁移脚本

用法:
    python3 scripts/download_slack_images.py

环境变量 (会自动从 .env 读取):
    - SLACK_BOT_TOKEN 或 SLACK_USER_TOKEN: Slack 令牌
    - OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET, OSS_ENDPOINT
"""

import os
import sys
import re
import uuid
from datetime import datetime

# 加载 .env 文件
def load_env():
    env_path = '/Users/yangsmac/Desktop/Slack/.env'
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip()

load_env()

import requests
import psycopg2
import oss2

# 配置
SLACK_TOKEN = os.environ.get('SLACK_BOT_TOKEN') or os.environ.get('SLACK_USER_TOKEN', '')
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://yangsmac:ysx050223@localhost:5432/slack_chat').split('?')[0]
OSS_ACCESS_KEY_ID = os.environ.get('OSS_ACCESS_KEY_ID', '')
OSS_ACCESS_KEY_SECRET = os.environ.get('OSS_ACCESS_KEY_SECRET', '')
OSS_BUCKET = os.environ.get('OSS_BUCKET', 'q-and-a-chatbot')
OSS_ENDPOINT = os.environ.get('OSS_ENDPOINT', 'https://oss-cn-hangzhou.aliyuncs.com')
OSS_REGION = os.environ.get('OSS_REGION', 'oss-cn-hangzhou')

print("=" * 60)
print("Slack 图片下载工具")
print("=" * 60)

if not SLACK_TOKEN:
    print("错误: 需要设置 SLACK_BOT_TOKEN 或 SLACK_USER_TOKEN")
    sys.exit(1)

if not OSS_ACCESS_KEY_ID:
    print("错误: 需要设置 OSS_ACCESS_KEY_ID")
    sys.exit(1)


def get_db_connection():
    return psycopg2.connect(DATABASE_URL)


def get_oss_bucket():
    auth = oss2.Auth(OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET)
    return oss2.Bucket(auth, OSS_ENDPOINT, OSS_BUCKET)


def is_slack_url(url):
    return url and 'files.slack.com' in url


def get_extension(mime_type, url):
    """获取文件扩展名"""
    mime_map = {
        'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
        'image/webp': 'webp', 'video/mp4': 'mp4', 'video/quicktime': 'mov',
        'application/pdf': 'pdf',
    }
    ext = mime_map.get(mime_type.lower())
    if ext:
        return ext
    match = re.search(r'\.([a-zA-Z0-9]+)(?:\?|$)', url)
    return match.group(1).lower() if match else 'bin'


def download_file(url):
    """下载文件"""
    headers = {'Authorization': f'Bearer {SLACK_TOKEN}'}
    try:
        resp = requests.get(url, headers=headers, timeout=60)
        if resp.status_code == 200:
            return resp.content
        print(f"  下载失败: HTTP {resp.status_code}")
    except Exception as e:
        print(f"  下载错误: {e}")
    return None


def upload_to_oss(data, file_name, mime_type, url):
    """上传到 OSS"""
    bucket = get_oss_bucket()
    ext = get_extension(mime_type, url)
    timestamp = int(datetime.now().timestamp())
    random_str = uuid.uuid4().hex[:8]
    key = f"slack-migration/{timestamp}-{random_str}.{ext}"

    try:
        bucket.put_object(key, data)
        oss_url = f"https://{OSS_BUCKET}.{OSS_REGION}.aliyuncs.com/{key}"
        return oss_url, key, OSS_BUCKET
    except Exception as e:
        print(f"  OSS 上传错误: {e}")
    return None, None, None


def get_slack_attachments():
    """获取所有 Slack URL 的附件"""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, file_name, file_path, mime_type
            FROM attachments
            WHERE file_path LIKE '%%files.slack.com%%'
        """)
        return cur.fetchall()
    finally:
        conn.close()


def update_attachment(attachment_id, new_url, s3_key, s3_bucket):
    """更新数据库"""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE attachments
            SET file_path = %s, s3_key = %s, s3_bucket = %s, thumbnail_url = %s
            WHERE id = %s
        """, (new_url, s3_key, s3_bucket, new_url, attachment_id))
        conn.commit()
    finally:
        conn.close()


def main():
    # 1. 获取所有 Slack URL 的附件
    print("\n[1/3] 扫描数据库中的 Slack 图片...")
    attachments = get_slack_attachments()
    print(f"找到 {len(attachments)} 个 Slack 图片")

    if not attachments:
        print("没有找到 Slack 图片，退出")
        return

    # 2. 下载并上传
    print(f"\n[2/3] 开始下载和上传 (共 {len(attachments)} 个)...")
    success = 0
    failed = 0
    skipped = 0

    for i, (attachment_id, file_name, file_path, mime_type) in enumerate(attachments):
        print(f"\n[{i+1}/{len(attachments)}] {file_name}")

        if not is_slack_url(file_path):
            skipped += 1
            continue

        # 下载
        content = download_file(file_path)
        if not content:
            failed += 1
            continue

        # 上传
        oss_url, s3_key, s3_bucket = upload_to_oss(content, file_name, mime_type, file_path)
        if not oss_url:
            failed += 1
            continue

        # 更新数据库
        update_attachment(attachment_id, oss_url, s3_key, s3_bucket)
        success += 1
        print(f"  -> {oss_url[:50]}...")

    # 3. 统计
    print("\n" + "=" * 60)
    print("完成!")
    print("=" * 60)
    print(f"成功: {success}")
    print(f"失败: {failed}")
    print(f"跳过: {skipped}")

    if success > 0:
        print(f"\n已更新 {success} 条记录到 OSS URL")
        print("客户重新导入数据库后即可看到图片")


if __name__ == '__main__':
    main()
