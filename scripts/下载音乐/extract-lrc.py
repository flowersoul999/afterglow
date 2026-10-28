#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从 M4A/AAC/MP4 文件中提取嵌入的歌词，保存为 .lrc 文件

用法:
    python extract-lrc.py <文件或目录>
    python extract-lrc.py . --overwrite

无需 ffmpeg，纯 Python 实现（依赖 mutagen）
"""

import os
import re
import sys

import mutagen
from mutagen import mp4


def extract_lyrics(filepath):
    """返回 (synced_lyrics, unsynced_lyrics)"""
    try:
        audio = mp4.MP4(filepath)
        tags = dict(audio.tags or {})

        # \xa9lyr = Apple 同步歌词, \xa9lyr+时间轴 或纯文本
        synced = None
        unsynced = None

        for key, values in tags.items():
            if not values:
                continue
            val = values[0] if isinstance(values, list) else values
            val = str(val).strip()

            if key == "\xa9lyr":
                # 判断是否已包含时间标签
                if re.search(r"\[\d{1,3}:\d{2}\.\d{2,3}\]", val):
                    synced = val
                else:
                    unsynced = val
            elif key.lower() in ("lyrics", "lyr"):
                synced = val
            elif key.lower() in ("unsynced lyrics", "unsyncedlyrics"):
                unsynced = val

        return synced, unsynced
    except Exception as e:
        print("  [错误] {}: {}".format(os.path.basename(filepath), e))
        return None, None


def text_to_lrc(raw):
    """将原始文本转为 LRC 格式"""
    lines = raw.strip().replace("\r\n", "\n").split("\n")
    has_ts = any(
        re.match(r"^\[\d{1,3}:\d{2}\.\d{2,3}\]", line)
        for line in lines if line.strip()
    )

    if has_ts:
        return raw.strip()

    # 无时间标签：每行间隔 5 秒自动生成时间轴
    out = []
    i = 0
    for line in lines:
        line = line.strip()
        if not line:
            continue
        mm = i * 5 // 60
        ss = i * 5 % 60
        out.append("[{:02d}:{:02d}.00]{}".format(mm, ss, line))
        i += 1
    return "\n".join(out)


def process_file(filepath, overwrite=False):
    """处理单个文件"""
    lrc_path = os.path.splitext(filepath)[0] + ".lrc"
    if os.path.exists(lrc_path) and not overwrite:
        print("  [跳过] {} 已存在".format(os.path.basename(lrc_path)))
        return False

    synced, unsynced = extract_lyrics(filepath)
    raw = synced or unsynced
    if not raw:
        print("  [无歌词] {}".format(os.path.basename(filepath)))
        return False

    lrc_content = text_to_lrc(raw)
    with open(lrc_path, "w", encoding="utf-8") as f:
        f.write(lrc_content)
    tag = "同步" if synced else "非同步"
    print("  [提取] {} -> {} ({}，{} 字符)".format(
        os.path.basename(filepath), os.path.basename(lrc_path), tag, len(lrc_content)))
    return True


def main():
    if len(sys.argv) < 2:
        print(__doc__.strip())
        sys.exit(1)

    target = sys.argv[1]
    overwrite = "--overwrite" in sys.argv

    if not os.path.exists(target):
        print("路径不存在: {}".format(target))
        sys.exit(1)

    exts = {".m4a", ".aac", ".mp4", ".m4b", ".m4p"}
    files = []
    if os.path.isfile(target):
        files = [os.path.abspath(target)]
    else:
        for root, _, filenames in os.walk(target):
            for f in filenames:
                if os.path.splitext(f)[1].lower() in exts:
                    files.append(os.path.abspath(os.path.join(root, f)))

    if not files:
        print("未找到 M4A/AAC/MP4 文件")
        sys.exit(0)

    print("找到 {} 个文件\n".format(len(files)))
    count = 0
    for f in files:
        if process_file(f, overwrite):
            count += 1
    print("\n完成: 从 {}/{} 个文件中提取了歌词".format(count, len(files)))


if __name__ == "__main__":
    main()
