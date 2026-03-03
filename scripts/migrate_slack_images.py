#!/usr/bin/env python3
"""
Slack Image Migration Script

This script downloads images from Slack URLs and uploads them to Aliyun OSS.
It updates the attachments table with the new OSS URLs.

Usage:
    python3 scripts/migrate_slack_images.py --dry-run  # Preview changes
    python3 scripts/migrate_slack_images.py           # Execute migration
"""

import os
import sys
import json
import argparse
import uuid
import re
from datetime import datetime
from typing import List, Dict, Any, Optional
import concurrent.futures
import time

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    import requests
except ImportError:
    print("Please install requests: pip install requests")
    sys.exit(1)

try:
    import psycopg2
except ImportError:
    print("Please install psycopg2: pip install psycopg2-binary")
    sys.exit(1)

try:
    import oss2
except ImportError:
    print("Please install oss2: pip install oss2")
    sys.exit(1)


# Configuration
class Config:
    # Database
    DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/slack')

    # Aliyun OSS
    OSS_ACCESS_KEY_ID = os.environ.get('OSS_ACCESS_KEY_ID', '')
    OSS_ACCESS_KEY_SECRET = os.environ.get('OSS_ACCESS_KEY_SECRET', '')
    OSS_REGION = os.environ.get('OSS_REGION', 'oss-cn-hangzhou')
    OSS_BUCKET = os.environ.get('OSS_BUCKET', '')
    OSS_ENDPOINT = os.environ.get('OSS_ENDPOINT', '')
    OSS_CUSTOM_DOMAIN = os.environ.get('OSS_CUSTOM_DOMAIN', '')

    # Slack (for downloading images)
    SLACK_TOKEN = os.environ.get('SLACK_BOT_TOKEN', '')

    # Batch size
    BATCH_SIZE = 50


def get_db_connection():
    """Get database connection"""
    return psycopg2.connect(Config.DATABASE_URL)


def get_oss_auth():
    """Get OSS auth"""
    return oss2.Auth(Config.OSS_ACCESS_KEY_ID, Config.OSS_ACCESS_KEY_SECRET)


def get_oss_bucket():
    """Get OSS bucket"""
    auth = get_oss_auth()
    return oss2.Bucket(auth, Config.OSS_ENDPOINT, Config.OSS_BUCKET)


def is_slack_url(url: str) -> bool:
    """Check if URL is a Slack URL"""
    return bool(url and 'files.slack.com' in url)


def extract_file_extension(url: str) -> str:
    """Extract file extension from URL"""
    # Try to extract from URL
    match = re.search(r'\.([a-zA-Z0-9]+)(?:\?|$)', url)
    if match:
        ext = match.group(1).lower()
        # Common extensions
        if ext in ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'mp4', 'mov']:
            return ext

    # Default extensions based on common Slack file types
    return 'bin'


def download_file(url: str, slack_token: str) -> Optional[bytes]:
    """Download file from URL"""
    headers = {}
    if slack_token:
        headers['Authorization'] = f'Bearer {slack_token}'

    try:
        response = requests.get(url, headers=headers, timeout=30)
        if response.status_code == 200:
            return response.content
        else:
            print(f"Failed to download {url}: HTTP {response.status_code}")
            return None
    except Exception as e:
        print(f"Error downloading {url}: {e}")
        return None


def upload_to_oss(data: bytes, file_name: str) -> Optional[Dict[str, str]]:
    """Upload file to OSS and return URLs"""
    try:
        bucket = get_oss_bucket()

        # Generate unique key
        timestamp = int(time.time())
        random_str = uuid.uuid4().hex[:8]
        ext = extract_file_extension(file_name)
        key = f"slack-migration/{timestamp}-{random_str}.{ext}"

        # Upload
        bucket.put_object(key, data)

        # Generate URLs
        if Config.OSS_CUSTOM_DOMAIN:
            file_url = f"https://{Config.OSS_CUSTOM_DOMAIN}/{key}"
        else:
            file_url = f"https://{Config.OSS_BUCKET}.{Config.OSS_REGION}.aliyuncs.com/{key}"

        return {
            's3_key': key,
            's3_bucket': Config.OSS_BUCKET,
            'file_url': file_url,
            'thumbnail_url': file_url  # For images, use same URL
        }
    except Exception as e:
        print(f"Error uploading to OSS: {e}")
        return None


def process_attachment(attachment: Dict[str, Any], slack_token: str, dry_run: bool = True) -> Optional[Dict[str, Any]]:
    """Process a single attachment"""
    file_path = attachment.get('file_path', '')

    if not is_slack_url(file_path):
        return None  # Not a Slack URL, skip

    file_name = attachment.get('file_name', 'unknown')
    attachment_id = attachment.get('id')

    print(f"Processing: {file_name} ({attachment_id})")
    print(f"  Original URL: {file_path}")

    if dry_run:
        return {
            'id': attachment_id,
            'old_url': file_path,
            'new_url': '[DRY RUN] Would be uploaded to OSS',
            'status': 'dry_run'
        }

    # Download from Slack
    content = download_file(file_path, slack_token)
    if not content:
        return {
            'id': attachment_id,
            'old_url': file_path,
            'new_url': None,
            'status': 'download_failed'
        }

    # Upload to OSS
    result = upload_to_oss(content, file_name)
    if not result:
        return {
            'id': attachment_id,
            'old_url': file_path,
            'new_url': None,
            'status': 'upload_failed'
        }

    return {
        'id': attachment_id,
        'old_url': file_path,
        'new_url': result['file_url'],
        's3_key': result['s3_key'],
        's3_bucket': result['s3_bucket'],
        'thumbnail_url': result['thumbnail_url'],
        'status': 'success'
    }


def update_attachment_in_db(attachment_id: str, new_url: str, s3_key: str, s3_bucket: str, thumbnail_url: str):
    """Update attachment in database"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE attachments
            SET file_path = %s,
                s3_key = %s,
                s3_bucket = %s,
                thumbnail_url = %s
            WHERE id = %s
        """, (new_url, s3_key, s3_bucket, thumbnail_url, attachment_id))
        conn.commit()
    finally:
        conn.close()


def get_all_slack_attachments() -> List[Dict[str, Any]]:
    """Get all attachments with Slack URLs"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, message_id, file_name, file_path, file_size, mime_type, s3_key, s3_bucket, thumbnail_url
            FROM attachments
            WHERE file_path LIKE '%%files.slack.com%%'
        """)
        columns = [desc[0] for desc in cursor.description]
        results = []
        for row in cursor.fetchall():
            results.append(dict(zip(columns, row)))
        return results
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description='Migrate Slack images to OSS')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes without executing')
    parser.add_argument('--limit', type=int, default=0, help='Limit number of attachments to process')
    args = parser.parse_args()

    print("=" * 60)
    print("Slack Image Migration Tool")
    print("=" * 60)
    print(f"Mode: {'DRY RUN (preview only)' if args.dry_run else 'LIVE EXECUTION'}")
    print()

    # Check configuration
    if not Config.OSS_ACCESS_KEY_ID or not Config.OSS_BUCKET:
        print("ERROR: OSS configuration missing!")
        print("Please set environment variables:")
        print("  OSS_ACCESS_KEY_ID")
        print("  OSS_ACCESS_KEY_SECRET")
        print("  OSS_BUCKET")
        print("  OSS_ENDPOINT")
        sys.exit(1)

    # Get all Slack attachments
    print("Fetching attachments with Slack URLs...")
    attachments = get_all_slack_attachments()
    print(f"Found {len(attachments)} attachments with Slack URLs")

    if args.limit > 0:
        attachments = attachments[:args.limit]
        print(f"Processing limited to {args.limit} attachments")

    if not attachments:
        print("No Slack URLs found. Nothing to migrate.")
        return

    print()

    # Process attachments
    results = []
    for i, attachment in enumerate(attachments):
        print(f"[{i+1}/{len(attachments)}] ", end="")
        result = process_attachment(attachment, Config.SLACK_TOKEN, dry_run=args.dry_run)
        if result:
            results.append(result)
            if result['status'] == 'success':
                print(f"  -> {result['new_url']}")
            elif result['status'] == 'dry_run':
                print(f"  -> {result['new_url']}")
            else:
                print(f"  -> FAILED: {result['status']}")

    print()
    print("=" * 60)
    print("Summary")
    print("=" * 60)

    success = sum(1 for r in results if r['status'] == 'success')
    failed = sum(1 for r in results if r['status'] not in ('success', 'dry_run'))
    dry_run = sum(1 for r in results if r['status'] == 'dry_run')

    print(f"Total processed: {len(results)}")
    if args.dry_run:
        print(f"Would migrate: {dry_run}")
    else:
        print(f"Successfully migrated: {success}")
        print(f"Failed: {failed}")

    # Update database if not dry run
    if not args.dry_run and success > 0:
        print()
        print("Updating database...")
        for result in results:
            if result['status'] == 'success':
                update_attachment_in_db(
                    result['id'],
                    result['new_url'],
                    result['s3_key'],
                    result['s3_bucket'],
                    result['thumbnail_url']
                )
        print("Database updated!")

    print()
    print("Done!")


if __name__ == '__main__':
    main()
