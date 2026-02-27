#!/usr/bin/env python3
"""
统计 slack-init.sql 消息中文件类型链接的数量和大小
"""

import re
import os

def extract_file_types(content):
    """从消息内容中提取文件类型链接"""

    # 文件扩展名模式（按优先级排序）
    file_extensions = [
        # 代码类型
        ('py', 'code'), ('js', 'code'), ('ts', 'code'), ('jsx', 'code'), ('tsx', 'code'),
        ('java', 'code'), ('c', 'code'), ('cpp', 'code'), ('h', 'code'), ('hpp', 'code'),
        ('go', 'code'), ('rs', 'code'), ('rb', 'code'), ('php', 'code'), ('swift', 'code'),
        ('kt', 'code'), ('kts', 'code'), ('scala', 'code'), ('sh', 'code'), ('sql', 'code'),
        ('r', 'code'), ('lua', 'code'), ('cs', 'code'),
        # 文档类型
        ('pdf', 'document'), ('doc', 'document'), ('docx', 'document'),
        ('xls', 'document'), ('xlsx', 'document'), ('xlsm', 'document'),
        ('ppt', 'document'), ('pptx', 'document'), ('pptm', 'document'),
        ('txt', 'document'), ('rtf', 'document'),
        # 数据类型
        ('json', 'data'), ('yaml', 'data'), ('yml', 'data'), ('xml', 'data'),
        ('csv', 'data'), ('tsv', 'data'), ('parquet', 'data'), ('arrow', 'data'),
        # 媒体类型
        ('jpg', 'image'), ('jpeg', 'image'), ('png', 'image'), ('gif', 'image'),
        ('bmp', 'image'), ('svg', 'image'), ('webp', 'image'), ('ico', 'image'),
        ('mp4', 'video'), ('mov', 'video'), ('avi', 'video'), ('mkv', 'video'), ('webm', 'video'),
        ('mp3', 'audio'), ('wav', 'audio'), ('flac', 'audio'), ('ogg', 'audio'), ('m4a', 'audio'),
        # 归档类型
        ('zip', 'archive'), ('tar', 'archive'), ('gz', 'archive'),
        ('bz2', 'archive'), ('xz', 'archive'), ('rar', 'archive'), ('7z', 'archive'),
        # 模型/权重
        ('pth', 'model'), ('pt', 'model'), ('ckpt', 'model'),
        ('safetensors', 'model'), ('onnx', 'model'), ('pb', 'model'),
        # Notebook
        ('ipynb', 'notebook'),
        # 网站
        ('html', 'web'), ('htm', 'web'), ('css', 'web'),
    ]

    # 统计结果
    stats = {}

    # 提取所有 URL（改进的正则表达式）
    # 匹配各种 URL 模式
    url_patterns = [
        r'https?://[^\s<>\"{}|\\^`\[\]]+\.([a-zA-Z0-9]+)(?:\b|[?#])',  # 带扩展名的 URL
    ]

    # 排除的头像/头像URL模式
    avatar_patterns = [
        r'avatars\.slack-edge\.com',
        r'secure\.gravatar\.com',
        r'avatars\.slack\.com',
    ]

    for pattern in url_patterns:
        matches = re.finditer(pattern, content)
        for match in matches:
            url = match.group(0)
            ext = match.group(1).lower()

            # 排除头像URL
            is_avatar = False
            for avatar_pattern in avatar_patterns:
                if re.search(avatar_pattern, url):
                    is_avatar = True
                    break

            if is_avatar:
                continue

            # 检查是否是已知扩展名
            for ext_name, category in file_extensions:
                if ext == ext_name:
                    if category not in stats:
                        stats[category] = {
                            'count': 0,
                            'extensions': {}
                        }
                    stats[category]['count'] += 1

                    if ext not in stats[category]['extensions']:
                        stats[category]['extensions'][ext] = {'count': 0, 'sample_url': ''}
                    stats[category]['extensions'][ext]['count'] += 1
                    if not stats[category]['extensions'][ext]['sample_url']:
                        # 保存示例 URL
                        stats[category]['extensions'][ext]['sample_url'] = url[:80]
                    break

    # 估算大小（基于文件类型的平均大小）
    size_estimates = {
        'document': 500000,      # 500KB
        'code': 10000,           # 10KB
        'data': 1000000,         # 1MB
        'image': 500000,         # 500KB
        'video': 50000000,       # 50MB
        'audio': 5000000,        # 5MB
        'archive': 10000000,     # 10MB
        'model': 100000000,      # 100MB
        'notebook': 500000,      # 500KB
        'web': 50000,            # 50KB
        'other': 100000          # 100KB
    }

    # 计算总大小
    for category, data in stats.items():
        data['total_size'] = data['count'] * size_estimates.get(category, 100000)

    return stats

def analyze_sql_file(file_path):
    """分析 SQL 文件中的文件类型"""

    if not os.path.exists(file_path):
        print(f"文件不存在: {file_path}")
        return

    file_size = os.path.getsize(file_path)
    print(f"SQL 文件大小: {file_size:,} bytes ({file_size / 1024 / 1024:.2f} MB)")
    print("=" * 70)

    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    # 提取文件类型统计
    stats = extract_file_types(content)

    # 输出结果
    print(f"{'文件类型':<20} {'数量':<10} {'估算大小':<15}")
    print("-" * 50)

    total_count = 0
    total_size = 0

    # 按数量排序
    sorted_stats = sorted(stats.items(), key=lambda x: x[1]['count'], reverse=True)

    for category, data in sorted_stats:
        count = data['count']
        size = data['total_size']
        total_count += count
        total_size += size

        size_str = format_size(size)
        print(f"{category:<20} {count:<10} {size_str:<15}")

    print("-" * 50)
    print(f"{'总计':<20} {total_count:<10} {format_size(total_size):<15}")
    print("=" * 70)

    # 详细统计 - 按扩展名
    print("\n详细文件扩展名统计:")
    print("-" * 60)

    # 收集所有扩展名
    all_exts = {}
    for category, data in stats.items():
        for ext, ext_data in data['extensions'].items():
            if ext not in all_exts:
                all_exts[ext] = {'count': 0, 'category': '', 'sample_url': ''}
            all_exts[ext]['count'] += ext_data['count']
            all_exts[ext]['category'] = category
            if not all_exts[ext]['sample_url'] and ext_data['sample_url']:
                all_exts[ext]['sample_url'] = ext_data['sample_url']

    # 按数量排序
    sorted_exts = sorted(all_exts.items(), key=lambda x: x[1]['count'], reverse=True)

    for ext, data in sorted_exts:
        print(f".{ext:<12} {data['count']:<8} [{data['category']:<10}] 示例: {data['sample_url'][:40]}...")

    return stats

def format_size(size_bytes):
    """格式化字节大小"""
    if size_bytes >= 1024 * 1024 * 1024:
        return f"{size_bytes / 1024 / 1024 / 1024:.2f} GB"
    elif size_bytes >= 1024 * 1024:
        return f"{size_bytes / 1024 / 1024:.2f} MB"
    elif size_bytes >= 1024:
        return f"{size_bytes / 1024:.2f} KB"
    else:
        return f"{size_bytes} bytes"

if __name__ == '__main__':
    file_path = '/Users/yangsmac/Desktop/Slack/db/slack-init.sql'
    analyze_sql_file(file_path)
