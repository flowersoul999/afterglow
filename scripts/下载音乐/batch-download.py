#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
QQ 音乐歌单批量下载工具

从 QQ 音乐客户端复制的歌曲列表文本中提取歌名和歌手，
调用 fetch-lrc.py 逐首搜索下载（音频 + 封面 + 歌词 + 博客 md）。

用法:
    # 从文件读取
    python batch-download.py songs.txt

    # 从剪贴板读取（需要 pyperclip，或手动粘贴后 Ctrl+Z）
    python batch-download.py --clipboard

    # 指定平台和服务
    python batch-download.py songs.txt --server=netease
    python batch-download.py songs.txt --server=tencent

    # 跳过已下载的
    python batch-download.py songs.txt --skip-existing

    # 仅预览不下载
    python batch-download.py songs.txt --dry-run

输入格式（QQ 音乐客户端复制）:
    歌曲名：晴天，歌手名：周杰伦，专辑名：叶惠美
    歌曲名：十年，歌手名：陈奕迅，专辑名：黑白灰

依赖: fetch-lrc.py, mutagen
"""

import os
import re
import subprocess
import sys
import unicodedata
from datetime import date

# Windows 控制台 UTF-8 编码
if sys.platform == "win32":
    os.system("chcp 65001 >nul 2>&1")
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FETCH_LRC = os.path.join(SCRIPT_DIR, "fetch-lrc.py")
DEFAULT_INPUT = os.path.join(SCRIPT_DIR, "playlist.txt")
BLOG_CONTENT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "..", "src", "content", "影视", "music"))
DEFAULT_OUT = os.path.abspath(os.path.join(SCRIPT_DIR, "downloads"))


def sanitize_filename(name):
    """只保留各国语言文字和数字，去除所有符号"""
    result = []
    for ch in name:
        cat = unicodedata.category(ch)
        if cat.startswith("L") or cat.startswith("N"):
            result.append(ch)
    return "".join(result)


def parse_song_list(text):
    """解析 QQ 音乐客户端复制的歌曲列表
    格式: 歌曲名：xxx，歌手名：xxx，专辑名：xxx
    返回 [(title, artist, album), ...]
    """
    songs = []
    # 匹配模式：歌曲名：xxx，歌手名：xxx，专辑名：xxx
    pattern = r"歌曲名[：:]\s*(.+?)，\s*歌手名[：:]\s*(.+?)(?:，\s*专辑名[：:]\s*(.*))?$"

    for line in text.strip().split("\n"):
        line = line.strip()
        if not line:
            continue

        m = re.match(pattern, line)
        if m:
            title = m.group(1).strip()
            artist = m.group(2).strip()
            album = m.group(3).strip() if m.group(3) else ""
            songs.append((title, artist, album))
        elif line.startswith("歌曲名"):
            # 格式不完全匹配但以"歌曲名"开头，尝试宽松解析
            parts = re.split(r"[，,]", line)
            title = ""
            artist = ""
            album = ""
            for p in parts:
                p = p.strip()
                if p.startswith("歌曲名"):
                    title = p.split("：", 1)[-1].strip() if "：" in p else p.split(":", 1)[-1].strip()
                elif p.startswith("歌手名"):
                    artist = p.split("：", 1)[-1].strip() if "：" in p else p.split(":", 1)[-1].strip()
                elif p.startswith("专辑名"):
                    album = p.split("：", 1)[-1].strip() if "：" in p else p.split(":", 1)[-1].strip()
            if title:
                songs.append((title, artist, album))

    return songs


def get_existing_songs(out_dir):
    """扫描已下载目录，返回已存在的歌曲文件名集合"""
    existing = set()
    if not os.path.isdir(out_dir):
        return existing
    for f in os.listdir(out_dir):
        if f.endswith((".m4a", ".mp3", ".flac")):
            existing.add(os.path.splitext(f)[0])
    return existing


def main():
    args = sys.argv[1:]
    server = "netease"
    skip_existing = False
    dry_run = False
    input_file = None
    out_dir = DEFAULT_OUT
    md_dir = BLOG_CONTENT_DIR

    # 解析参数
    positional = []
    for a in args:
        if a.startswith("--server="):
            server = a.split("=", 1)[1]
        elif a == "--skip-existing":
            skip_existing = True
        elif a == "--dry-run":
            dry_run = True
        elif a.startswith("--out="):
            out_dir = os.path.abspath(a.split("=", 1)[1])
        elif a == "--no-md":
            md_dir = None
        elif a == "--help" or a == "-h":
            print(__doc__.strip())
            sys.exit(0)
        elif not a.startswith("--"):
            positional.append(a)

    if positional:
        input_file = positional[0]

    # 读取歌曲列表
    if input_file and os.path.isfile(input_file):
        with open(input_file, "r", encoding="utf-8") as f:
            text = f.read()
    else:
        # 从 stdin 读取
        print("请输入歌曲列表（QQ 音乐复制格式），输入完毕后按 Ctrl+Z (Windows) 或 Ctrl+D (Unix)：\n")
        try:
            text = sys.stdin.read()
        except KeyboardInterrupt:
            print("\n已取消")
            sys.exit(0)

    songs = parse_song_list(text)
    if not songs:
        print("未解析到任何歌曲，请检查输入格式")
        print("格式示例: 歌曲名：晴天，歌手名：周杰伦，专辑名：叶惠美")
        sys.exit(1)

    print("解析到 {} 首歌曲\n".format(len(songs)))

    # 检查已下载
    existing = set()
    if skip_existing:
        existing = get_existing_songs(out_dir)
        print("已下载 {} 首，将跳过\n".format(len(existing)))

    # 预览
    if dry_run:
        print("=== 预览模式 ===\n")
        for i, (title, artist, album) in enumerate(songs, 1):
            safe = sanitize_filename("{}-{}".format(title, artist))
            status = "[已存在]" if safe in existing else "[待下载]"
            print("  {:3d}. {} {} - {} ({})".format(i, status, title, artist or "未知", album or "无专辑"))
        print("\n共 {} 首".format(len(songs)))
        return

    # 逐首下载
    ok = 0
    fail = 0
    skipped = 0

    for i, (title, artist, album) in enumerate(songs, 1):
        safe = sanitize_filename("{}-{}".format(title, artist))
        print("\n[{}/{}] {} - {}".format(i, len(songs), title, artist or "未知"))

        if skip_existing and safe in existing:
            print("  [跳过] 已存在")
            skipped += 1
            continue

        # 调用 fetch-lrc.py
        cmd = [sys.executable, FETCH_LRC, title]
        if artist:
            cmd.append(artist)
        cmd.append("--server=" + server)
        cmd.append("--md")
        cmd.append("--out=" + out_dir)
        if md_dir:
            cmd.append("--md-dir=" + md_dir)

        try:
            result = subprocess.run(cmd, timeout=120)
            if result.returncode == 0:
                ok += 1
            else:
                print("  [失败] 返回码: {}".format(result.returncode))
                fail += 1
        except subprocess.TimeoutExpired:
            print("  [超时] 跳过")
            fail += 1
        except KeyboardInterrupt:
            print("\n\n用户中断，已完成 {}/{}".format(ok + fail + skipped, len(songs)))
            break
        except Exception as e:
            print("  [错误] {}".format(e))
            fail += 1

    print("\n" + "=" * 50)
    print("完成: {} 成功, {} 失败, {} 跳过, 共 {} 首".format(ok, fail, skipped, len(songs)))


if __name__ == "__main__":
    main()
