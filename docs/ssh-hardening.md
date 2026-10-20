# 服务器 SSH 安全加固（42.193.100.176 / 腾讯云）

> 目的：把「公网 22 端口 + 密码登录」这个最容易被爆破的入口收紧，且**不影响**服务器上正在跑的任何服务。
> 创建于 2026-10-20。执行前先读「阶段 0」。

## 体检结果（2026-10-20 实测）

| 项目 | 实测值 | 说明 |
|---|---|---|
| SSH 服务版本 | `OpenSSH_9.3` | Ubuntu 23.04 / Debian 12 一代，用 `apt` 管理 |
| 支持认证方式 | `publickey, gssapi-keyex, gssapi-with-mic, password` | ⚠️ **password 开着 = 可被爆破** |
| `root` 账号 | 存在且可达认证阶段 | 爆破机器人默认就冲 root |
| 本机公钥是否已装到服务器 | ❌ **没有**（publickey 认证失败） | 所以第 1 步必须先装密钥，否则关不掉密码登录 |
| 22 / 80 / 443 | 全部开放 | 80/443 是 nginx（`tts.tsh520.cn`、`img.tsh520.cn`） |
| 另一台 47.94.55.218 | 22/80/443 全不通 | 已停机或安全组全封，本次不管 |

## 影响面（先说结论：不会影响已部署的服务）

服务器上的业务全部走 **80/443**：nginx 反代的 edge-tts、CloudFlare-ImgBed 图床、AstrBot、同步服务容器。
本次改动只涉及 **sshd 进程**和**安全组里 22 那一条规则**，两者与业务端口完全隔离。

真正会导致「服务不可用」的只有两种失误，本文每一步都做了防护：

1. 误删安全组里 80/443 的规则 → **本文根本不碰安全组**（除非走到阶段 5 的可选项）
2. sshd 配置写错 → 用 `sshd -t` 先校验、用 `reload` 而非 `restart`、且改完不关旧会话 → 最坏情况是"新连接进不来"，但旧会话还活着，能立刻改回去

> 唯一真正会"丢管理入口"的场景：关掉密码登录后，你手头没有可用的密钥、又没开云控制台的 VNC。所以**阶段 0 必须先做**。

---

## 阶段 0 · 保命检查（必做，2 分钟）

打开腾讯云控制台 → 找到这台 CVM → 「登录」→ 选 **VNC 登录 / 网页终端**，确认能进到命令行。

进不去就先别做后面任何一步。这是万一 sshd 配置写错时的唯一救援通道。

同时在**当前**已登录的 SSH 窗口里不要退出，本文全程都在这个窗口操作，它不受 `reload` 影响。

---

## 阶段 1 · 把本机公钥装到服务器（登录方式升级）

### 1.1 本机（Windows / Git Bash）执行

```bash
# 看一眼现有的公钥（你本机已有一把 id_ed25519 和一把 id_rsa）
cat ~/.ssh/id_ed25519.pub
```

复制输出的整行（`ssh-ed25519 AAAA... 注释`）。

> 想更规范可以给服务器单独生成一把：`ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_tsh -C "tsh-server"`，
> 然后后续命令都用 `_tsh` 这把。用现有那把也完全没问题。

### 1.2 服务器上执行（用密码登录进去的那个窗口）

```bash
# 只允许 root 本人读写，sshd 对权限要求很严，权限不对会静默拒绝
mkdir -p ~/.ssh && chmod 700 ~/.ssh

# 把刚才复制的公钥粘进去（一行一条，粘完按 Ctrl+D 结束）
cat >> ~/.ssh/authorized_keys

chmod 600 ~/.ssh/authorized_keys
```

粘贴时注意：整行一次性粘贴，别让终端折行时插入多余字符。

### 1.3 验证文件长得对

```bash
cat ~/.ssh/authorized_keys      # 应该只有你粘进去的那一行
ls -ld ~/.ssh ~/.ssh/authorized_keys   # 期望 drwx------ 和 -rw-------
```

---

## 阶段 2 · 用密钥登录验证（**必须新开一个窗口**）

本机新开一个终端（不要关掉服务器上那个旧窗口）：

```bash
ssh root@42.193.100.176
```

- 能直接进（不再问密码）→ 阶段 2 通过，继续。
- 还问密码 → 说明 `authorized_keys` 没生效，去服务器上看日志找原因：

```bash
sudo tail -20 /var/log/auth.log | grep -i "publickey\|authorized"
```

常见原因：公钥粘断了、`~/.ssh` 或 `authorized_keys` 权限是 777、SELinux/AppArmor 上下文不对、
粘的是 `.pub` 之外的私钥内容。**这一步不通就停下来，不要往下做**，否则关掉密码登录你会进不去。

---

## 阶段 3 · 装 fail2ban（零风险，立刻止住爆破）

两个窗口都在的情况下，在服务器上执行：

```bash
sudo apt update && sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban

# 确认 sshd 这个 jail 已经激活
sudo fail2ban-client status
sudo fail2ban-client status sshd
```

期望输出里 `Currently banned` 会随着时间慢慢涨 —— 那些就是正在被拦的爆破 IP。

它做了什么：读 `/var/log/auth.log` 里的失败记录，往 iptables 插临时封禁规则。**不碰 sshd 配置、不重启任何服务、随时可卸载**：

```bash
sudo apt remove --purge -y fail2ban   # 反悔就这一条
```

默认策略是 10 分钟内失败 5 次封 10 分钟，够用了，不用改配置。

---

## 阶段 4 · 关闭密码登录（收益最大的一步）

### 4.1 先看"有效配置"，别只看主文件

Ubuntu 云镜像的经典坑：`/etc/ssh/sshd_config` 里写对了，但 `/etc/ssh/sshd_config.d/` 下的文件
（如 `50-cloud-init.conf`）**后加载、会覆盖主文件**，导致改了没生效。

```bash
sudo sshd -T | grep -E "^(passwordauthentication|permitrootlogin|pubkeyauthentication|kbdinteractiveauthentication)"
```

当前应该看到 `passwordauthentication yes`。**改完必须再跑这条确认变成 no**，以它为准，不以文件内容为准。

### 4.2 改配置

```bash
# 先备份
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak.20261020

# 看有没有覆盖文件在捣乱
sudo grep -rn "PasswordAuthentication\|PermitRootLogin" /etc/ssh/sshd_config /etc/ssh/sshd_config.d/ 2>/dev/null
```

如果有输出落在 `sshd_config.d/*.conf` 里，**改那个文件**（把 `yes` 改成 `no`），或直接注释掉那一行。
然后再改主文件：

```bash
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?KbdInteractiveAuthentication.*/KbdInteractiveAuthentication no/' /etc/ssh/sshd_config
```

`PermitRootLogin prohibit-password` 的含义：root 仍可登录，但**只能用密钥**，不接受密码。

### 4.3 校验 + 生效 + 复查

```bash
sudo sshd -t                                  # 语法校验，没输出就是没问题
sudo systemctl reload sshd                    # reload 不是 restart，旧会话不受影响

sudo sshd -T | grep -E "^(passwordauthentication|permitrootlogin)"
# 期望：passwordauthentication no / permitrootlogin without-password
```

### 4.4 验证

本机**再新开一个**终端：

```bash
ssh root@42.193.100.176        # 应该仍然能进（走密钥）
```

然后（可选，确认密码通道确实关了）：

```bash
ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no root@42.193.100.176
# 期望：Permission denied (publickey). —— 不再提示输入密码
```

两个旧窗口都还开着、新窗口能进 = 成功。此时爆破机器人再来就只会撞在 `publickey` 上，`auth.log` 不再暴涨。

---

## 阶段 5 · 可选项（收益递减，做之前想清楚）

### 5.1 改端口（22 → 22022）

**收益**：日志噪音下降。**风险**：顺序错了就把自己关在门外。

正确顺序（一步都不能跳）：

1. 腾讯云控制台 → 安全组 → 添加入站规则：TCP `22022`，源 `0.0.0.0/0`
2. 服务器上 `sudo sed -i 's/^#\?Port .*/Port 22022/' /etc/ssh/sshd_config`（**追加**而不是替换更安全：写两行 `Port 22` + `Port 22022`，让两个端口并存）
3. `sudo sshd -t && sudo systemctl reload sshd`
4. 本机 `ssh -p 22022 root@42.193.100.176` 验证能进
5. 验证成功后，才删掉 `Port 22` 那行 + 安全组里的 22 规则

做完记得更新本机 `~/.ssh/config`：

```
Host tsh
    HostName 42.193.100.176
    Port 22022
    User root
    IdentityFile ~/.ssh/id_ed25519
```

之后 `ssh tsh` 就进去了。

> 阶段 4 做完后，改端口的实际收益已经很小（密码关了，爆破进来也是白撞）。**不急着做。**

### 5.2 限制源 IP

安全组把 22 的源改成家里固定 IP。**不建议**：家宽/校园网 IP 会变，一变自己也进不去，还得去控制台改回来。

### 5.3 新建普通用户 + sudo，禁止 root 登录

最规范，但会改变你所有脚本/工具的登录方式（AstrBot、备份脚本可能都用 root），
且需要配 sudo 免密。**本项目当前不建议做**，收益不如 4 大、维护成本明显更高。

---

## 回滚（任何一步出问题）

旧会话还开着的话，**在旧会话里**执行：

```bash
# 撤销阶段 4
sudo cp /etc/ssh/sshd_config.bak.20261020 /etc/ssh/sshd_config
sudo sshd -t && sudo systemctl reload sshd

# 撤销阶段 3
sudo apt remove --purge -y fail2ban
```

旧会话已经关了、新连接又进不去 → **腾讯云控制台 VNC 登录**进去执行同样的命令。

---

## 完成检查清单

- [ ] 腾讯云控制台 VNC 能登录（救援通道可用）
- [ ] 本机 `~/.ssh/id_ed25519.pub` 已追加到服务器 `~/.ssh/authorized_keys`
- [ ] 新窗口 `ssh root@42.193.100.176` 免密进入
- [ ] `fail2ban-client status sshd` 有输出、banned 计数在涨
- [ ] `sudo sshd -T | grep passwordauthentication` = `no`
- [ ] 断网重连仍能进（模拟一次"新连接"）
- [ ] 顺手确认业务没受影响：`curl -I https://img.tsh520.cn` 和 `curl -I https://tts.tsh520.cn` 返回 200/30x
- [ ] 把新密码/密钥位置记到自己的密码管理器（别只存在脑子里）

## 日常复查（每月一次，30 秒）

```bash
sudo fail2ban-client status sshd              # 看累计封了多少
last -a | head -10                            # 看最近成功登录，有陌生 IP 就要警觉
sudo grep -c "Failed password" /var/log/auth.log  # 失败次数趋势（关掉密码登录后应基本停止增长）
```
