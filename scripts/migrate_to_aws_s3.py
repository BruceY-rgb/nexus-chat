#!/usr/bin/env python3
"""
AWS S3 迁移脚本 - 从 slack-data.json 读取文件并迁移到 AWS S3
"""

import json
import os
import re
import uuid
import uuid as uuid_module
from datetime import datetime

# AWS 配置（从环境变量读取）
AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID', '')
AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY', '')
AWS_BUCKET_NAME = os.environ.get('AWS_BUCKET_NAME', 'molardata-rlenv-greenhouse')
AWS_REGION = os.environ.get('AWS_REGION', 'us-west-1')

# Slack Token（从 .env 读取）
SLACK_TOKEN = ''
env_path = '/Users/yangsmac/Desktop/Slack/.env'
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            if line.strip().startswith('SLACK_USER_TOKEN='):
                SLACK_TOKEN = line.split('=', 1)[1].strip()
                break

print("=" * 60)
print("AWS S3 迁移工具")
print("=" * 60)
print(f"Bucket: {AWS_BUCKET_NAME}")
print(f"Region: {AWS_REGION}")

import boto3
import requests

# 初始化 S3 客户端
s3_client = boto3.client(
    's3',
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_REGION
)


def get_extension(mime_type, url, filename):
    """获取文件扩展名"""
    mime_map = {
        'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
        'image/webp': 'webp', 'video/mp4': 'mp4', 'video/quicktime': 'mov',
        'application/pdf': 'pdf',
    }
    ext = mime_map.get(mime_type.lower())
    if ext:
        return ext

    # 从文件名提取
    match = re.search(r'\.([a-zA-Z0-9]+)(?:\?|$)', filename)
    if match:
        return match.group(1).lower()

    # 从 URL 提取
    match = re.search(r'\.([a-zA-Z0-9]+)(?:\?|$)', url)
    if match:
        return match.group(1).lower()

    return 'bin'


def download_file(url):
    """下载 Slack 文件"""
    headers = {}
    if SLACK_TOKEN:
        headers['Authorization'] = f'Bearer {SLACK_TOKEN}'

    try:
        resp = requests.get(url, headers=headers, timeout=60)
        if resp.status_code == 200:
            return resp.content
        print(f"  下载失败: HTTP {resp.status_code}")
    except Exception as e:
        print(f"  下载错误: {e}")
    return None


def upload_to_s3(data, file_name, mime_type, url):
    """上传到 AWS S3"""
    ext = get_extension(mime_type, url, file_name)
    timestamp = int(datetime.now().timestamp())
    random_str = uuid.uuid4().hex[:8]
    key = f"slack-migration/{timestamp}-{random_str}.{ext}"

    try:
        s3_client.put_object(
            Bucket=AWS_BUCKET_NAME,
            Key=key,
            Body=data,
            ContentType=mime_type
        )

        # 生成 S3 URL
        s3_url = f"https://{AWS_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{key}"
        return s3_url, key
    except Exception as e:
        print(f"  S3 上传错误: {e}")
    return None, None


def main():
    # 1. 读取 slack-data.json
    print("\n[1/3] 读取 slack-data.json...")
    with open('/Users/yangsmac/Desktop/Slack/slack-data.json', 'r') as f:
        data = json.load(f)

    # 收集所有文件
    all_files = []
    for channel_id, messages in data['messages'].items():
        for msg in messages:
            if 'files' in msg:
                for f in msg['files']:
                    all_files.append(f)

    print(f"找到 {len(all_files)} 个文件")

    # 2. 下载并上传
    print(f"\n[2/3] 开始上传到 AWS S3...")
    results = []
    success = 0
    failed = 0

    for i, f in enumerate(all_files):
        file_name = f.get('name', 'unknown')
        slack_url = f.get('url_private', '')
        mime_type = f.get('mimetype', 'application/octet-stream')

        # 生成 UUID
        file_id = str(uuid_module.uuid5(uuid_module.NAMESPACE_DNS, f.get('id', '')))

        print(f"\n[{i+1}/{len(all_files)}] {file_name}")

        # 下载
        content = download_file(slack_url)
        if not content:
            failed += 1
            results.append({
                'id': file_id,
                'file_name': file_name,
                'file_path': slack_url,
                'mime_type': mime_type,
                'status': 'failed'
            })
            continue

        # 上传
        s3_url, s3_key = upload_to_s3(content, file_name, mime_type, slack_url)
        if not s3_url:
            failed += 1
            results.append({
                'id': file_id,
                'file_name': file_name,
                'file_path': slack_url,
                'mime_type': mime_type,
                'status': 'failed'
            })
            continue

        success += 1
        results.append({
            'id': file_id,
            'file_name': file_name,
            'file_path': s3_url,
            'mime_type': mime_type,
            's3_key': s3_key,
            'status': 'success'
        })
        print(f"  -> {s3_url[:60]}...")

    # 3. 生成 SQL
    print(f"\n[3/3] 生成 SQL...")
    with open('/Users/yangsmac/Desktop/Slack/db/attachments_migrated_aws.sql', 'w') as f:
        f.write("-- Migrated attachments with AWS S3 URLs\n")
        f.write("-- Generated at: 2026-03-03\n\n")

        for r in results:
            if r['status'] == 'success':
                file_name = r['file_name'].replace("'", "''")
                file_path = r['file_path'].replace("'", "''")
                s3_key = r['s3_key'].replace("'", "''")

                sql = f"INSERT INTO attachments (id, message_id, file_name, file_path, file_size, mime_type, s3_key, s3_bucket, thumbnail_url, created_at) VALUES ('{r['id']}', '', '{file_name}', '{file_path}', 0, '{r['mime_type']}', '{s3_key}', '{AWS_BUCKET_NAME}', '{file_path}', NOW());\n"
                f.write(sql)

    # 4. 统计
    print("\n" + "=" * 60)
    print(f"成功: {success}")
    print(f"失败: {failed}")
    print(f"\nSQL 已保存到: db/attachments_migrated_aws.sql")


if __name__ == '__main__':
    main()
