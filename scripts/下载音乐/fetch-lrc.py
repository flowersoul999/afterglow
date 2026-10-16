#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
M4A 封面/歌词提取 + Meting API 音乐下载 + 自动生成博客 md

自动多平台 fallback：当指定平台返回 30 秒试听片段时，自动尝试
tencent → kugou → netease 等平台，直到获取完整版音频。

用法:
    # 本地文件模式：处理 M4A 文件
    python fetch-lrc.py <文件或目录>                              # 提取封面和歌词
    python fetch-lrc.py <文件或目录> --md                          # 同时生成 md
    python fetch-lrc.py . --md --server=kugou                     # 换平台

    # 搜索下载模式：直接搜歌名下载（音频+歌词+封面+md）
    python fetch-lrc.py "歌名" ["歌手"] --md                       # 搜索并下载
    python fetch-lrc.py "晴天" "周杰伦" --md                       # 指定歌手
    python fetch-lrc.py "海阔天空" --md --server=kugou --out=./dl  # 换平台+指定目录

    # 诊断模式：测试一首歌在各平台的可用性
    python fetch-lrc.py "知我" "国风堂" --test

    # 自定义 API
    python fetch-lrc.py "晴天" --md --api=https://your-meting-api/
    python fetch-lrc.py "晴天" --md --api=https://api1.com/ --api=https://api2.com/

    # 自定义
    python fetch-lrc.py . --no-md --audio-base=https://xxx/music/ # 自定义 URL

默认输出目录: ./downloads/
默认 md 输出: src/content/影视/music/
默认音频 URL 前缀: https://img.tsh520.cn/file/music/

依赖: 已部署的 Meting API, mutagen
"""

import json
import os
import re
import sys
import unicodedata
import urllib.request
from datetime import date

# Windows 控制台 UTF-8 编码
if sys.platform == "win32":
    os.system("chcp 65001 >nul 2>&1")
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from mutagen import mp4
from mutagen.mp4 import MP4Cover

# ── 多 API 端点（按优先级排列，自动探测可用性） ───────
# 用户自己的实例排第一，后面可自行添加其他实例
API_ENDPOINTS = [
    "https://mu.tsh520.cn/api",                  # 自部署（默认）
    "https://meting.mikus.ink/api",               # 公共实例（search 仅支持 netease）
]

# 仅支持 netease search 的 API（需要先用 netease 搜到 id，再用其他平台取 URL）
NETEASE_SEARCH_ONLY = {"https://meting.mikus.ink/api"}

# 运行时自动探测后写入，按可用性排序
API_BASE = API_ENDPOINTS[0]

BLOG_CONTENT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "src", "content", "影视", "music"))
AUDIO_BASE = "https://img.tsh520.cn/file/music/"
DEFAULT_OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), "downloads"))

# 多平台 fallback 顺序，--server 指定的平台优先
FALLBACK_SERVERS = ["tencent", "kugou", "netease", "xiami", "baidu"]

# 低于此秒数判定为试听片段
MIN_DURATION_SEC = 60


# ── utility ──────────────────────────────────────────

def human_size(n):
    for u in ["B", "KB", "MB", "GB"]:
        if n < 1024:
            return "{:.0f} {}".format(n, u)
        n /= 1024
    return "{:.1f} GB".format(n)


def sanitize_filename(name):
    """只保留各国语言文字和数字，去除所有符号（- . / _ 空格 等）"""
    result = []
    for ch in name:
        cat = unicodedata.category(ch)
        if cat.startswith("L") or cat.startswith("N"):
            result.append(ch)
    return "".join(result)


def download_file(url, filepath, label=""):
    """下载文件带进度条"""
    try:
        with urllib.request.urlopen(url, timeout=120) as resp:
            total = int(resp.headers.get("Content-Length", 0))
            with open(filepath, "wb") as f:
                downloaded = 0
                while True:
                    chunk = resp.read(65536)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total > 0:
                        pct = downloaded * 100 // total
                        bar_len = 25
                        filled = downloaded * bar_len // total
                        bar = "=" * filled + ">" + " " * (bar_len - filled)
                        print("\r  {} [{:3d}%] {} {}/{}".format(
                            label, pct, bar, human_size(downloaded), human_size(total)), end="")
                print()
        return True
    except Exception as e:
        print("\n  下载失败: {}".format(e))
        if os.path.exists(filepath):
            os.remove(filepath)
        return False


# ── API helpers ───────────────────────────────────────

def search_songs(name, artist="", server="netease"):
    """搜索歌曲，返回全部结果（兼容旧调用，内部走多源）"""
    results, _ = search_songs_multi(name, artist, server)
    return results


def search_first(name, artist="", server="netease"):
    """搜索歌曲，返回第一首"""
    results, _ = search_songs_multi(name, artist, server)
    return results[0] if results else None


def fetch_lrc(lyric_id, server="netease"):
    """根据 lyric_id 获取 LRC 歌词（多源）"""
    for api in working_apis:
        url = "{}?server={}&type=song&id={}".format(
            api, server, urllib.request.quote(str(lyric_id)))
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                items = data if isinstance(data, list) else [data]
                if items and items[0].get("lrc"):
                    with urllib.request.urlopen(items[0]["lrc"], timeout=15) as lrc_resp:
                        return lrc_resp.read().decode("utf-8")
        except Exception:
            continue
    return None


def fetch_cover_bytes(pic_url):
    try:
        with urllib.request.urlopen(pic_url, timeout=15) as resp:
            return resp.read()
    except Exception:
        return None


# ── API 探测与多源搜索 ──────────────────────────────

def probe_api(base_url, timeout=8):
    """探测 API 是否可用，返回 True/False"""
    try:
        url = "{}?server=netease&type=search&id=test".format(base_url)
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return isinstance(data, list)
    except Exception:
        return False


def find_working_apis(endpoints):
    """探测所有端点，返回可用列表"""
    working = []
    print("探测 API 可用性...")
    for ep in endpoints:
        ok = probe_api(ep)
        status = "✓" if ok else "✗"
        print("  {} {}".format(status, ep))
        if ok:
            working.append(ep)
    return working


def search_songs_multi(name, artist="", server="netease"):
    """依次尝试多个 API 搜索，返回第一个有结果的
    对于只支持 netease search 的 API，会用 netease 搜索后返回结果（id 可跨平台使用）
    """
    query = "{} {}".format(name, artist).strip()
    for api in working_apis:
        # 如果 API 只支持 netease search 且目标不是 netease，先用 netease 搜
        search_server = server
        if api in NETEASE_SEARCH_ONLY and server != "netease":
            search_server = "netease"

        url = "{}?server={}&type=search&id={}".format(
            api, search_server, urllib.request.quote(query))
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if isinstance(data, list) and len(data) > 0:
                    return data, api
        except Exception:
            continue
    return [], None


def get_song_detail_multi(song_id, server="netease"):
    """依次尝试多个 API 获取歌曲详情"""
    for api in working_apis:
        url = "{}?server={}&type=song&id={}".format(
            api, server, urllib.request.quote(str(song_id)))
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if data:
                    return data[0] if isinstance(data, list) and data else data, api
        except Exception:
            continue
    return None, None


def get_audio_duration(filepath):
    """获取音频文件时长（秒），失败返回 0"""
    try:
        from mutagen.mp4 import MP4
        audio = MP4(filepath)
        return audio.info.length if audio.info else 0
    except Exception:
        pass
    try:
        from mutagen.mp3 import MP3
        audio = MP3(filepath)
        return audio.info.length if audio.info else 0
    except Exception:
        pass
    try:
        from mutagen.flac import FLAC
        audio = FLAC(filepath)
        return audio.info.length if audio.info else 0
    except Exception:
        pass
    return 0


def get_fallback_servers(user_server):
    """返回以用户指定 server 为首的 fallback 顺序（去重）"""
    servers = [user_server]
    for s in FALLBACK_SERVERS:
        if s not in servers:
            servers.append(s)
    return servers


def search_and_resolve_url(name, artist, server):
    """在指定 server 搜索歌曲并获取音频 URL（多源），返回 (song_info, url) 或 (None, None)
    对于不支持 search 的 API/平台，会先用 netease 搜到 id，再尝试目标平台取 URL
    """
    # 先尝试直接搜索
    song = search_first(name, artist, server)
    if song:
        url = song.get("url")
        if not url:
            sid = song.get("id")
            if sid:
                detail, _ = get_song_detail_multi(sid, server)
                if detail:
                    url = detail.get("url")
        return song, url

    # 直接搜索无结果 → 对于只支持 netease search 的 API，
    # 先用 netease 搜到 id，再用目标平台取 URL（部分 API 支持跨平台同 id）
    if server != "netease":
        song = search_first(name, artist, "netease")
        if song:
            sid = song.get("id")
            if sid:
                detail, _ = get_song_detail_multi(sid, server)
                if detail and detail.get("url"):
                    return song, detail.get("url")

    return None, None


# ── local file helpers ────────────────────────────────

def extract_embedded_cover(filepath):
    try:
        audio = mp4.MP4(filepath)
        covers = audio.tags.get("covr")
        if covers:
            cover = covers[0]
            fmt_map = {MP4Cover.FORMAT_JPEG: "jpg", MP4Cover.FORMAT_PNG: "png"}
            return bytes(cover), fmt_map.get(cover.imageformat, "jpg")
    except Exception:
        pass
    return None, None


def read_audio_tags(filepath):
    try:
        audio = mp4.MP4(filepath)
        tags = dict(audio.tags or {})
        name = str(tags.get("\xa9nam", [""])[0]).strip()
        artist = str(tags.get("\xa9ART", [""])[0]).strip()
        return name, artist
    except Exception:
        return os.path.splitext(os.path.basename(filepath))[0], ""


# ── markdown ──────────────────────────────────────────

def write_markdown(md_path, name, artist, audio_url, lrc_url, cover_url):
    text = """---
title: {name}
category: music
status: 2
image: {cover}
artist: {artist}
audioUrl: {audio}
lrcUrl: {lrc}
score: 0
published: {today}
---

""".format(
        name=name,
        artist=artist,
        cover=cover_url,
        audio=audio_url,
        lrc=lrc_url,
        today=date.today().isoformat(),
    )
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(text)


# ── file mode ─────────────────────────────────────────

def process_file(filepath, server="netease", audio_base=None, md_dir=None):
    """处理本地音频文件：封面 + 歌词 + 可选 md"""
    base = os.path.splitext(filepath)[0]
    basename = os.path.basename(filepath)
    slug = os.path.splitext(basename)[0]
    changed = False

    cover_path = base + ".jpg"
    _, cover_filename = os.path.split(cover_path)

    if os.path.exists(cover_path):
        print("  [跳过] 已有封面 {}".format(cover_filename))
    else:
        img_bytes, fmt = extract_embedded_cover(filepath)
        if img_bytes:
            cover_path = base + "." + fmt
            _, cover_filename = os.path.split(cover_path)
            with open(cover_path, "wb") as f:
                f.write(img_bytes)
            print("  [封面:内嵌] {}".format(cover_filename))
            changed = True

    name, artist = read_audio_tags(filepath)
    if not name:
        return changed

    print("  搜索: {} - {}".format(name, artist or "未知"))
    song = search_first(name, artist, server)
    if not song:
        print("  [未找到] {} - {}".format(name, artist))
        return changed

    if not os.path.exists(cover_path) and song.get("pic"):
        img_bytes = fetch_cover_bytes(song["pic"])
        if img_bytes:
            with open(cover_path, "wb") as f:
                f.write(img_bytes)
            print("  [封面:API] {}".format(cover_filename))
            changed = True

    lrc_path = base + ".lrc"
    _, lrc_filename = os.path.split(lrc_path)
    if os.path.exists(lrc_path):
        print("  [跳过] 已有歌词 {}".format(lrc_filename))
    else:
        lyric_id = song.get("lyric_id") or song.get("id")
        lrc = fetch_lrc(lyric_id, server)
        if not lrc and song.get("lrc"):
            try:
                with urllib.request.urlopen(song["lrc"], timeout=15) as resp:
                    lrc = resp.read().decode("utf-8")
            except Exception:
                pass
        if lrc:
            with open(lrc_path, "w", encoding="utf-8") as f:
                f.write(lrc)
            print("  [歌词] {} ({} 字符)".format(lrc_filename, len(lrc)))
            changed = True
        else:
            print("  [无歌词] {}".format(name))

    if audio_base and md_dir is not None:
        audio_base = audio_base.rstrip("/") + "/"
        audio_url = audio_base + basename
        lrc_url = audio_base + slug + ".lrc"
        cover_url = audio_base + os.path.splitext(cover_filename)[0] + ".jpg"
        md_file = sanitize_filename(name) + ".md"
        md_path = os.path.join(md_dir, md_file)
        if os.path.exists(md_path):
            print("  [跳过] 已有 md: {}".format(md_file))
        else:
            write_markdown(md_path, name, artist, audio_url, lrc_url, cover_url)
            print("  [MD] {}".format(md_file))
            changed = True

    return changed


# ── search mode ───────────────────────────────────────

def process_search(name, artist="", server="netease", audio_base=None, md_dir=None, out_dir=None):
    """搜索并下载：音频 + 封面 + 歌词 + md"""
    if out_dir is None:
        out_dir = DEFAULT_OUT
    os.makedirs(out_dir, exist_ok=True)

    print("搜索: {} - {}".format(name, artist or "任意"))
    results, search_api = search_songs_multi(name, artist, server)
    if not results:
        print("未找到结果")
        return False

    # 显示来源 API（只取域名部分）
    api_host = search_api.replace("https://", "").replace("http://", "").split("/")[0] if search_api else "未知"
    search_server = server
    if search_api in NETEASE_SEARCH_ONLY and server != "netease":
        search_server = "netease(跨平台)"

    print("\n搜索结果 (API: {}, 平台: {}):\n".format(api_host, search_server))
    for i, item in enumerate(results[:10]):
        t = item.get("title") or item.get("name") or "?"
        a = item.get("author") or item.get("artist") or "?"
        sid = item.get("id", "?")
        print("  [{:2d}] {} - {}  (id: {})".format(i + 1, t, a, sid))

    if len(results) == 1:
        pick = 1
    else:
        try:
            choice = input("\n选择序号 (1-{}, 默认 1): ".format(min(10, len(results)))).strip()
            pick = int(choice) if choice else 1
            if pick < 1 or pick > min(10, len(results)):
                print("无效选择")
                return False
        except (ValueError, KeyboardInterrupt, EOFError):
            print()
            print("  非交互模式，自动选择第 1 首")
            pick = 1

    song = results[pick - 1]
    title = song.get("title") or song.get("name") or "unknown"
    author = song.get("author") or song.get("artist") or "unknown"
    sid = song.get("id")

    print("\n选中: {} - {} (id: {})".format(title, author, sid))

    safe_name = sanitize_filename("{}-{}".format(title, author))
    changed = False

    # ── 下载音频（多平台 fallback） ──────────────────
    ext = ".m4a"
    audio_path = os.path.join(out_dir, safe_name + ext)

    if os.path.exists(audio_path):
        dur = get_audio_duration(audio_path)
        if dur > 0:
            print("  [跳过] 已有音频 {} ({:.0f}s)".format(safe_name + ext, dur))
        else:
            print("  [跳过] 已有音频 {}".format(safe_name + ext))
    else:
        servers = get_fallback_servers(server)
        downloaded = False

        for srv in servers:
            # 首次用已选中的 song，后续重新搜索
            if srv == server:
                cur_song, detail_url = song, song.get("url")
                if not detail_url:
                    detail = _get_song_detail(sid, srv)
                    if detail:
                        detail_url = detail.get("url")
            else:
                print("  [fallback] 尝试平台: {}".format(srv))
                cur_song, detail_url = search_and_resolve_url(title, artist, srv)

            if not detail_url:
                if srv != server:
                    print("  [{}] 未找到音频".format(srv))
                continue

            print("  下载音频: {} (平台: {})".format(safe_name + ext, srv))
            tmp_path = audio_path + ".tmp"
            if download_file(detail_url, tmp_path, "音频"):
                dur = get_audio_duration(tmp_path)
                if dur >= MIN_DURATION_SEC or dur <= 0:
                    # 完整版或无法检测时长 → 保留
                    os.rename(tmp_path, audio_path)
                    print("  [音频] {} ({:.0f}s, 平台: {})".format(safe_name + ext, dur, srv))
                    # 如果 fallback 到了其他平台，更新 song 信息供后续使用
                    if srv != server:
                        song = cur_song
                        server = srv
                        sid = cur_song.get("id")
                    downloaded = True
                    changed = True
                    break
                else:
                    # 试听片段 → 删除，继续下一个平台
                    os.remove(tmp_path)
                    print("  [试听 {:.0f}s] 跳过，尝试下一个平台...".format(dur))
            else:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)

        if not downloaded:
            print("  [无完整音频] 所有平台均无完整版")

    # ── 下载封面 ──────────────────────────────────────
    cover_path = os.path.join(out_dir, safe_name + ".jpg")
    if os.path.exists(cover_path):
        print("  [跳过] 已有封面 {}".format(safe_name + ".jpg"))
    else:
        pic_url = None
        if song.get("pic"):
            pic_url = song["pic"]
        else:
            detail = _get_song_detail(sid, server)
            if detail and detail.get("pic"):
                pic_url = detail["pic"]

        if pic_url:
            img = fetch_cover_bytes(pic_url)
            if img:
                with open(cover_path, "wb") as f:
                    f.write(img)
                print("  [封面] {}".format(safe_name + ".jpg"))
                changed = True

    # ── 下载歌词 ──────────────────────────────────────
    lrc_path = os.path.join(out_dir, safe_name + ".lrc")
    if os.path.exists(lrc_path):
        print("  [跳过] 已有歌词 {}".format(safe_name + ".lrc"))
    else:
        lrc = None
        if song.get("lrc"):
            try:
                with urllib.request.urlopen(song["lrc"], timeout=15) as resp:
                    lrc = resp.read().decode("utf-8")
            except Exception:
                pass
        if not lrc:
            lyric_id = song.get("lyric_id") or sid
            if lyric_id:
                lrc = fetch_lrc(lyric_id, server)
        if lrc:
            with open(lrc_path, "w", encoding="utf-8") as f:
                f.write(lrc)
            print("  [歌词] {} ({} 字符)".format(safe_name + ".lrc", len(lrc)))
            changed = True
        else:
            print("  [无歌词]")

    # ── 生成 md ───────────────────────────────────────
    if audio_base and md_dir is not None:
        os.makedirs(md_dir, exist_ok=True)
        audio_base = audio_base.rstrip("/") + "/"
        audio_url = audio_base + safe_name + ext
        lrc_url = audio_base + safe_name + ".lrc"
        cover_url = audio_base + safe_name + ".jpg"
        md_file = sanitize_filename(title) + ".md"
        md_path = os.path.join(md_dir, md_file)
        if os.path.exists(md_path):
            print("  [跳过] 已有 md: {}".format(md_file))
        else:
            write_markdown(md_path, title, author, audio_url, lrc_url, cover_url)
            print("  [MD] {}".format(md_file))
            changed = True

    return changed


def _get_song_detail(song_id, server="netease"):
    """获取歌曲详情（兼容旧调用，内部走多源）"""
    result, _ = get_song_detail_multi(song_id, server)
    return result


# ── 诊断模式 ─────────────────────────────────────────

def test_song_platforms(name, artist=""):
    """测试一首歌在各平台的可用性，报告哪些能拿到完整版"""
    print("\n诊断: {} - {}".format(name, artist or "未知"))
    print("API: {}".format(working_apis[0] if working_apis else "无"))
    print("=" * 60)

    for srv in FALLBACK_SERVERS:
        print("\n[{}]".format(srv))
        # 搜索
        results, api_used = search_songs_multi(name, artist, srv)
        if not results:
            print("  搜索: 无结果")
            continue

        api_host = api_used.replace("https://", "").replace("http://", "").split("/")[0] if api_used else "?"
        actual_srv = "netease→{}".format(srv) if api_used in NETEASE_SEARCH_ONLY and srv != "netease" else srv

        song = results[0]
        title = song.get("title") or song.get("name") or "?"
        author = song.get("author") or song.get("artist") or "?"
        sid = song.get("id")
        print("  搜索: {} - {} (id: {}) [API: {}, 平台: {}]".format(title, author, sid, api_host, actual_srv))

        # 获取 URL
        url = song.get("url")
        if not url and sid:
            detail, _ = get_song_detail_multi(sid, srv)
            if detail:
                url = detail.get("url")

        if not url:
            print("  音频: 无 URL")
            continue

        # 下载一小段检测时长
        import tempfile
        tmp = tempfile.NamedTemporaryFile(suffix=".m4a", delete=False)
        tmp_path = tmp.name
        tmp.close()

        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                # 只读前 1MB 足够判断
                data = resp.read(1024 * 1024)
                with open(tmp_path, "wb") as f:
                    f.write(data)

            dur = get_audio_duration(tmp_path)
            if dur >= MIN_DURATION_SEC:
                print("  音频: ✓ 完整版 ({:.0f}s)".format(dur))
            elif dur > 0:
                print("  音频: ✗ 试听 ({:.0f}s)".format(dur))
            else:
                # 无法检测时长，看文件大小估算
                size = len(data)
                if size > 1024 * 1024 * 0.9:
                    print("  音频: ? 可能完整 ({}, 超过1MB)".format(human_size(size)))
                else:
                    print("  音频: ? 可能试听 ({}, 不足1MB)".format(human_size(size)))
        except Exception as e:
            print("  音频: 下载失败 ({})".format(e))
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    print("\n" + "=" * 60)
    print("诊断完成。如果所有平台都是试听，建议：")
    print("  1. 用 --api= 添加其他 Meting API 实例")
    print("  2. 手动获取完整音频后用本地文件模式处理")


# ── main ──────────────────────────────────────────────

# 全局可用 API 列表，main() 中初始化
working_apis = []


def main():
    global working_apis, API_BASE

    if len(sys.argv) < 2:
        print(__doc__.strip())
        sys.exit(1)

    target = sys.argv[1]
    server = "netease"
    audio_base = AUDIO_BASE
    md_dir = BLOG_CONTENT_DIR
    make_md = False
    out_dir = None
    extra_apis = []
    test_mode = False

    for a in sys.argv[2:]:
        if a.startswith("--server="):
            server = a.split("=", 1)[1]
        elif a.startswith("--api="):
            extra_apis.append(a.split("=", 1)[1].rstrip("/"))
        elif a.startswith("--audio-base="):
            audio_base = a.split("=", 1)[1]
        elif a == "--md":
            make_md = True
        elif a.startswith("--md-dir="):
            md_dir = os.path.abspath(a.split("=", 1)[1])
            make_md = True
        elif a == "--no-md":
            make_md = False
            md_dir = None
        elif a.startswith("--out="):
            out_dir = os.path.abspath(a.split("=", 1)[1])
        elif a == "--test":
            test_mode = True

    # 探测 API 可用性：用户指定的 API 优先，然后探测内置列表
    all_endpoints = extra_apis + [e for e in API_ENDPOINTS if e not in extra_apis]
    working_apis = find_working_apis(all_endpoints)

    if not working_apis:
        print("\n错误: 没有可用的 API 端点")
        print("提示: 用 --api=https://your-meting-api/ 指定自定义 API")
        sys.exit(1)

    API_BASE = working_apis[0]
    print("\n主 API: {} (共 {} 个可用)\n".format(API_BASE, len(working_apis)))

    # ── 诊断模式 ──────────────────────────────────────
    if test_mode:
        name = target
        artist = ""
        for a in sys.argv[2:]:
            if not a.startswith("--"):
                artist = a
                break
        test_song_platforms(name, artist)
        return

    if not make_md:
        md_dir = None

    # ── 判断模式 ──────────────────────────────────────
    # target 是文件或目录 → 本地文件模式
    # target 不是路径 → 搜索下载模式，第二个参数是歌手名

    exts = {".m4a", ".aac", ".mp4", ".m4b", ".m4p", ".mp3", ".flac"}

    if os.path.isdir(target):
        # 目录模式
        files = []
        for root, _, filenames in os.walk(target):
            for f in filenames:
                if os.path.splitext(f)[1].lower() in exts:
                    files.append(os.path.abspath(os.path.join(root, f)))
        if not files:
            print("未找到音频文件")
            sys.exit(0)
        print("找到 {} 个文件\n".format(len(files)))
        ok = 0
        for f in files:
            if process_file(f, server, audio_base, md_dir):
                ok += 1
        print("\n完成: 处理了 {}/{}".format(ok, len(files)))

    elif os.path.isfile(target) and os.path.splitext(target)[1].lower() in exts:
        # 单文件模式
        print("找到 1 个文件\n")
        ok = 1 if process_file(target, server, audio_base, md_dir) else 0
        print("\n完成: 处理了 {}/1".format(ok))

    else:
        # 搜索下载模式
        # sys.argv[1] = 歌名, sys.argv[2] = 歌手（可选，不以 -- 开头）
        name = target
        artist = ""
        for a in sys.argv[2:]:
            if not a.startswith("--"):
                artist = a
                break
        process_search(name, artist, server, audio_base, md_dir, out_dir)
        print("\n完成")


if __name__ == "__main__":
    main()
