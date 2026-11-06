# QQ 对话式说说发布设计

## 背景

微信 ClawBot 扫码授权当前无法完成，因此在保留微信支持的同时，增加普通 QQ 号接入路径。QQ 端使用 NapCat 登录机器人小号，通过 OneBot v11 反向 WebSocket 接入 AstrBot 的 `aiocqhttp` 适配器。

## 目标

- 用户用自己的 QQ 私聊机器人小号，直接发送普通文字开始说说草稿。
- 沿用现有“预览”“重写：内容”“撤销上一条”“发布”“取消”流程。
- 沿用现有图片收集、图床上传、GitHub 提交和 Actions 构建流程。
- 保留微信 ClawBot 和所有显式命令的兼容性。

## 安全边界

- 自动开稿仅接受 `unified_msg_origin` 明确标记为 `aiocqhttp:FriendMessage` 或 `aiocqhttp:PrivateMessage` 的事件。
- QQ 群聊、QQ 官方机器人、未知平台和来源不明事件不得自动创建草稿。
- 继续使用 `allow_users` 白名单；QQ 场景填写用户自己的 QQ 号。
- 只有发送“发布”才写入 GitHub，其他编辑操作只修改内存草稿。

## 实现与验证

- 将自然对话私聊判定从微信专用扩展为微信与 NapCat QQ 共用。
- 新增 QQ 好友私聊开稿测试，并保留微信/QQ 群聊及未知来源不触发的回归测试。
- 完整运行插件 unittest，更新 README、安装说明、工程规范和更新日志。
- 使用 Python `zipfile` 重打插件压缩包，并检查 ZIP 中文文件名和关键源码。
