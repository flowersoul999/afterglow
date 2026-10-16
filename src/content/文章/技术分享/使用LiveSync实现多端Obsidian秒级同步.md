---
title: 使用 LiveSync 实现多端 Obsidian 秒级同步
published: 2026-10-17
tags:
  - Obsidian
  - CouchDB
  - 宝塔面板
  - Docker
image: ""
description: 在宝塔面板上用 Docker 部署 CouchDB，配合 Obsidian 插件 Self-hosted LiveSync 实现电脑、手机多端笔记实时同步的完整教程。
---

> [!note] Note
> 本文基于宝塔面板 11 + Docker 部署 CouchDB 3.5.3，配合 Obsidian 插件 Self-hosted LiveSync，实现多端笔记秒级实时同步。全程亲测可用。

## 方案介绍

Obsidian 官方同步服务收费不菲，而 **Self-hosted LiveSync** 是一个开源社区插件，它把笔记切分成分片（chunk），通过 CouchDB 数据库做中转存储，实现：

- **真正的实时同步**：与 CouchDB 保持长连接，改动毫秒级推送/拉取
- **多端支持**：Windows、Mac、Android、iOS 全平台
- **数据完全自控**：笔记存在自己的服务器上，支持端到端加密（E2EE）
- **免费**：只有一台服务器的成本

整体架构：

```
电脑 Obsidian ⇄ HTTPS 反代 ⇄ CouchDB (Docker) ⇄ HTTPS 反代 ⇄ 手机 Obsidian
```

## 第一步：宝塔面板部署 CouchDB

### 1.1 安装 Docker

宝塔面板 → 软件商店 → 搜索安装 **Docker** 应用。

### 1.2 创建容器

Docker → 容器 → 创建容器，填写：

| 参数 | 值 |
| --- | --- |
| 容器名称 | `couchdb` |
| 镜像 | `couchdb:latest`（生产环境建议固定版本号） |
| 端口映射 | 本地 `5984` → 容器 `5984`，TCP，对外暴露开启 |
| 重启规则 | 停止后马上重启 |
| 环境变量 | `COUCHDB_USER=你的管理员账号`<br>`COUCHDB_PASSWORD=你的强密码` |
| 挂载 1 | `/www/dockers/couchdb/data` → `/opt/couchdb/data` |
| 挂载 2 | `/www/dockers/couchdb/etc` → `/opt/couchdb/etc/local.d` |

> [!warning] 两个坑
> 1. **挂载权限必须选「读写」**，宝塔默认是「只读」，不改会导致容器启动失败或数据无法持久化。
> 2. **必须设置管理员账号密码**，否则 CouchDB 处于 Admin Party 模式，任何人都是管理员，公网暴露极其危险。

### 1.3 放行端口

- 宝塔「安全」放行 **5984**
- 云服务商安全组（腾讯云/阿里云控制台）放行 **5984**

验证：浏览器访问 `http://服务器IP:5984`，返回 `{"couchdb":"Welcome",...}` 即成功。

### 1.4 域名反代 + HTTPS

宝塔新建站点（如 `couchdb.example.com`），申请 Let's Encrypt 免费证书并开启强制 HTTPS，然后添加反向代理：

- 目标 URL：`http://127.0.0.1:5984`

之后用 `https://couchdb.example.com` 访问即可。**强烈建议上 HTTPS**，否则账号密码明文裸奔。

### 1.5 单节点配置

登录 Fauxton 管理界面（`https://你的域名/_utils`），点左侧扳手图标（Setup）→ **Configure a Single Node**：

| 字段 | 值 |
| --- | --- |
| Username / Password | 你的管理员账号密码 |
| Bind address | `0.0.0.0` |
| Port | `5984` |

点 Configure Node，完成后会自动创建 `_users`、`_replicator` 系统数据库。

## 第二步：CouchDB 适配 LiveSync 的配置

### 2.1 开启 CORS

Fauxton → Config → 左侧 **CORS**：

- Enable CORS → 开启
- Origin Domains → 选 **All domains (*)**（稳定后可收紧为 `app://obsidian.md` 等）

### 2.2 添加配置项

Config → Main config → 右上角 **Add Option**，逐条添加：

| Section | Name | Value |
| --- | --- | --- |
| `cors` | `credentials` | `true` |
| `chttpd` | `max_http_request_size` | `4294967296` |
| `couchdb` | `max_document_size` | `50000000` |

后两条是加大请求和文档体积限制，避免同步大附件时报错。

## 第三步：Obsidian 配置 LiveSync

### 3.1 安装插件

设置 → 第三方插件 → 关闭安全模式 → 社区插件市场搜 **Self-hosted LiveSync** → 安装并启用。

### 3.2 添加连接

插件设置 → 远程配置 → Saved connections 旁的 ➕：

| 字段 | 值 |
| --- | --- |
| URL | `https://couchdb.example.com`（不带结尾斜杠） |
| 用户名 | CouchDB 管理员账号 |
| 密码 | CouchDB 管理员密码 |
| 数据库名称 | 自定义全小写库名，如 `obsidian-notes`（自动创建） |

点 **检查服务器要求**，日志会检测配置。若有红色问题项（如 `require_valid_user`、`WWW-Authenticate`、`enable_cors`），逐个点旁边的 **修复** 按钮，插件会自动写入正确配置。全部打勾后点 **测试连接并保存**。

### 3.3 启用实时同步

回到主设置页点 **启用 LiveSync**。然后在「同步设置」中：

- **同步模式 → LiveSync 同步**（长连接实时双向，多设备必选）
- **Keep replication active in the background → 打开**（窗口失焦也继续同步）

状态栏出现 `↑0 ↓0 (LIVE)` 即表示实时同步已生效。

## 第四步：手机端配置

不用手动重填，用 **Setup URI** 一键迁移：

1. 电脑端插件设置 → 设置其他设备 → **将当前设置复制为设置 URI**
2. 选择有效期类型：
   - **Time-bound**：7 天内有效，过期作废，更安全（需手机端插件为新版）
   - **Compatible**：永不过期，兼容旧版本
3. 设置一个加密密码（passphrase），URI 复制到剪贴板
4. 把 URI 发到手机（微信文件传输助手等），或直接生成二维码扫码
5. 手机 Obsidian：同名 vault → 装 LiveSync 插件 → 「使用设置 URI 连接」→ 粘贴 URI → 输入加密密码 → 启用 LiveSync

手机端建议保持 LiveSync 同步模式，但**不要开**后台保持（省电）。App 被杀后台后重进会自动恢复同步。

## 加密说明

| 层级 | 状态 | 说明 |
| --- | --- | --- |
| 传输加密（HTTPS/TLS） | ✅ 已有 | 网络传输全程密文 |
| 端到端加密（E2EE） | 可选 | 服务器上存密文，连自己服务器管理员都读不到 |

开启 E2EE：远程配置 → 配置 E2EE，设一个强密码。**所有设备必须用同一密码，忘记密码数据无法恢复**，普通笔记可不开。

## 维护与注意事项

1. **定期 Compact**：LiveSync 会产生大量历史版本导致 CouchDB 膨胀，每隔几个月在 Fauxton 里对数据库点 Compact。
2. **服务器备份**：宝塔定时任务备份 `/www/dockers/couchdb/data` 目录。
3. **冲突处理**：两端同时改同一文件会产生冲突副本，手动合并删除即可。
4. **CORS 收紧**：稳定运行后把 `*` 改为 `app://obsidian.md`、`capacitor://localhost`、`http://localhost`。
5. **密码安全**：管理员密码不要出现在任何截图、文章里。

## 总结

整套方案成本只有一台轻量服务器，换来的是完全自主可控、秒级响应的多端同步体验。从部署 CouchDB 到手机端跑通，熟练后半小时即可搞定。相比官方同步，LiveSync 的分片增量机制在大库上表现也不错，值得折腾。
