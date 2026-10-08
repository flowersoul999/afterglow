# 笔记同步方案：Syncthing（服务器中转 + 电脑 + 手机）

> 目标：在**不把博客仓库其它文件牵扯进来**的前提下，让手机和电脑共享同一份笔记。
> 同步范围只有三个目录，其余（代码、配置、`.obsidian`、散落文件）一律不参与同步。

- 起草：2026-10-08
- 结论：用 **Syncthing**（非 Obsidian 插件型方案）。理由：**没有任何第三方额度/请求频率限制**；手机端能在 Obsidian 关闭时后台同步；**「非笔记文件」问题从根上不存在**——只把三个目录作为 Syncthing 文件夹共享，别的根本不进同步范围。

## 一、同步范围与体量（实测）

| 目录 | 内容 | 体量 |
|---|---|---|
| `src/content` | 博客内容（15 个集合，posts/life/moments/bangumi/bills/changelog/daohang/friends/album/schedules…） | 42.4MB（笔记类 1115 个 / 7.7MB，图片 546 个 / 34.7MB） |
| `src/notes` | 私人笔记（不发布，已在 `.gitignore`） | 33 个 md，体量可忽略 |
| `src/临时收集` | 微信文章收件箱（wechat-inbox-sync 的 inboxDir） | 9 个文件 |

**合计 42.5MB**，其中笔记类文件共 1157 个。体积不大，首次全量连图片一起同步即可。

**不在同步范围的**（这就是「非笔记文件」的解法）：`components/ layouts/ pages/ styles/ config/ utils/ i18n/ types/ constants/ plugins/`、`src/assets/`、`content.config.ts`、`orphaned files output.md`、`.obsidian/`、`.trash/`、`.agents/`、`.claude/`、`.claudian/`、`.copilot/`、`.opencode/`。

## 二、架构

```
手机（Syncthing-Fork） ⇄ 服务器（Syncthing，7×24） ⇄ 电脑（Syncthing，开机自启）
```

- 三台都装 Syncthing（**同一个软件的不同平台版本**，手机端是社区维护的 Syncthing-Fork）。
- 服务器节点的作用：**中转**（任何一端单独上线都能拿到最新内容）+ **备份**（开 Staggered 版本保留）。
- **电脑不需要一直开着**：关机期间手机上改的内容在服务器上等着，电脑下次开机自动追平。

## 三、服务器（Linux / Docker）

```yaml
services:
  syncthing:
    image: syncthing/syncthing:latest
    environment: [PUID=1000, PGID=1000]
    volumes: ["./syncthing-data:/var/syncthing"]
    ports: ["8384:8384", "22000:22000/tcp", "22000:22000/udp"]
    restart: unless-stopped
```

1. 防火墙放行 **22000 TCP + UDP**（同步端口）；`8384` 管理界面只在内网/反代之后访问，并设 GUI 账号密码。
2. 建三个文件夹，路径用容器内持久化路径：
   `/var/syncthing/vault/content`、`/var/syncthing/vault/notes`、`/var/syncthing/vault/临时收集`
3. 每个文件夹：类型 **发送与接收**、**文件版本保留 = Staggered（错峰版本）**（这是兜底备份，务必开）。
4. 记下设备 ID（操作 → 显示 ID），两端配对要用。

## 四、电脑（Windows）

1. 装 Syncthing（Windows 版；配 Syncthing Tray 更省心），**设成开机自启**——不是要电脑一直开，是让你一开机它就自动把错过的内容同步补上。
2. 添加三个文件夹，指向：
   - `E:\GithubProgect\MyRunProject\dumplingandcakeblog\src\content`
   - `…\src\notes`
   - `…\src\临时收集`
   类型 **发送与接收**；版本保留也开 **Staggered**。
3. 添加服务器设备（填它的设备 ID）→ 接受服务器共享的三个文件夹。
4. ⚠️ **不要把 `src\` 整个共享出去**——那样代码目录会被一起同步，正是要避免的。

## 五、手机（Android）

1. 装 **Syncthing-Fork**（官方 Android 版已停止维护）：权限给全、**关闭电池优化/加入后台白名单**（它会挂一个常驻通知，这正是它能在 Obsidian 关闭时继续同步的原因）。
2. 添加服务器设备 ID → 接受三个文件夹，接收路径分别设为：
   - `content` → `<库目录>/content`
   - `notes` → `<库目录>/notes`
   - `临时收集` → `<库目录>/临时收集`
   （`<库目录>` 例如手机存储里的 `Blog`，先建好空目录）
3. Obsidian 里**新建库指向 `<库目录>`**（不要选已有的别的库）——笔记里的相对路径才能和电脑一致。
4. 手机端手工配插件（`.obsidian` 不同步，必须重配）：
   - `obsidian-custom-attachment-location`：附件目录 `assets/${noteFileName}` —— **必须和电脑完全一致**，否则粘贴图的相对路径会岔
   - 图床上传插件：填 token
   - `category-autofill`、`notebook-navigator`（按需）

### 文件夹映射对照

| 设备 | content | notes | 临时收集 |
|---|---|---|---|
| 服务器 | `/var/syncthing/vault/content` | `…/vault/notes` | `…/vault/临时收集` |
| 电脑 | `…\dumplingandcakeblog\src\content` | `…\src\notes` | `…\src\临时收集` |
| 手机 | `<库目录>/content` | `<库目录>/notes` | `<库目录>/临时收集` |

## 六、验证清单（逐条过）

1. **手机 `<库目录>` 顶层只有 `content`、`notes`、`临时收集` 三个目录**（出现 `components`、`pages`、`.obsidian` 就是配错了）。
2. 电脑改一篇 → 手机几秒～一分钟内看到。
3. 手机改一篇（**Obsidian 关着也试一次**，验证后台同步）→ 电脑看到。
4. **中转验证**：电脑关机状态下用手机改一篇 → 再开机 → 电脑自动追平（证明服务器中转生效）。
5. 服务器上确认版本保留目录里出现历史副本（证明兜底可用）。

## 七、常见坑

- **两个同步方案绝不能并存**：启用 Syncthing 前，**禁用 `nutstore-sync`**（以及保持禁用 `obsidian-git`）；否则两边互相打架、可能丢改动。
- 手机端 Syncthing-Fork 的**常驻通知**是正常现象（前台服务），删掉通知 = 停掉同步。
- 手机端**不加电池白名单**会被系统杀掉，表现为「手机改了电脑长时间看不到」。
- Windows 端**不设开机自启**的话，每次开机都要手动启动 Syncthing，否则电脑这边的改动传不出去。
- 手机 Obsidian 若装了 `advanced-exclude`：它只影响 Obsidian 界面（把被排除文件当不存在），**不影响 Syncthing**；但注意别把三个笔记目录本身排除掉，否则 Obsidian 里看不到笔记。
- 服务器/中转上的内容是**明文**（和 git 仓库一样）；设备间传输有加密。
- 冲突（同一篇在两端各改了一次且期间没同步）：同目录会出现 `xxx.sync-conflict-日期时间-设备ID.md`，两边内容都在，合完删副本即可；Staggered 版本保留还能找回旧版。**按「同一时间只在一端改某一篇」的用法，基本不会遇到。**

## 八、回退

三台各自停用 Syncthing 即可。方案是纯增量的：**桌面端不会删除任何原有文件**，仓库代码与 `.obsidian` 全程没被碰过。坚果云那边旧的远端目录可以留着当额外备份，也可直接清掉。

## 九、明确不做

- 不装新插件、不写自研插件、不改博客站点代码。
- 发布链路不变：`git commit + push` 仍由站长手动执行（EdgeOne Pages 随 main 自动构建）。
