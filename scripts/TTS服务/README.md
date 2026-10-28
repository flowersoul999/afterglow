# TTS服务（edge-tts 朗读代理）

博客文章页「朗读」功能的服务端，部署在腾讯云服务器（2 核 4G 即可）。

- 一键自测：`bash 自测.sh`（在部署目录执行）
- 完整部署教程：见仓库 `docs/deploy-edge-tts.md`
- 接口：`GET /health`、`GET /voices`、`POST /tts`、`GET /audio/{id}`

变更服务端代码后：改 `server.py` → `docker compose up -d --build` → `bash 自测.sh`。
