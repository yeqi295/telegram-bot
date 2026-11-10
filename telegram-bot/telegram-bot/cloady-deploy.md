# 部署到 Cloady（USW1 免费工作区）

目标：把这个机器人跑在你已经建好的 **USW1 Free Workspace** 里。免费档是 0.5 核 / 1 GB 内存 / 5 GB 磁盘 / 每月 10 GB 流量，这个机器人只有几十 MB 内存占用，完全够用。

> 注意：一个账号只能有一个免费工作区，你的免费名额已经在 USW1 上，不要再建 USE1 或别的免费工作区。

## 准备工作（开始之前）

1. **建机器人拿 token**：Telegram 里找 `@BotFather` → `/newbot` → 按提示起名 → 拿到一串 `123456:ABC-DEF...` 这样的 token，记下来（不要发到群里、不要写进代码）。
2. **拿自己的数字 id**：给 `@userinfobot` 发任意消息，它回你的 id，一串数字，这就是 `ADMIN_ID`。
3. **把代码传上去**：下面两种办法任选其一。
   - 办法 A（推荐）：把 `telegram-bot/` 整个文件夹推到你自己的 GitHub/GitLab 仓库。
   - 办法 B：用 Cloady 控制台的 Docker 镜像方式，先在本地 `docker build` 并推到 Docker Hub，再填镜像名。

## 部署步骤（Git 仓库方式）

1. 打开 Cloady 控制台，进 **USW1 Free Workspace**。
2. 点 **Add application**（新建应用）。
3. 选 **Git repository**，填你的仓库地址和分支（main），构建方式选 **Dockerfile**（仓库根目录就是 `telegram-bot/` 时，Dockerfile 路径填 `Dockerfile`；如果仓库根目录还有别的东西，把 `telegram-bot/` 整个作为应用根目录）。
4. **环境变量**（在应用设置里的 Environment Variables 添加，一个都别写错）：
   | 变量 | 值 |
   |---|---|
   | `BOT_TOKEN` | @BotFather 给的 token |
   | `ADMIN_ID` | 你的 Telegram 数字 id |
   | `WEBHOOK_URL` | 部署完成后 Cloady 给你的应用域名，如 `https://xxx.cloady.io` |
   | `POLLING` | 不要设（默认就是 Webhook 模式） |
   | `PORT` | 不用设，Cloady 会自动注入 |
5. 点 **Deploy**，等构建完成、状态变绿。
6. 部署完成后，Cloady 会给你一个域名（形如 `https://<应用名>.cloady.io`）。**先把这个域名填回第 4 步的 `WEBHOOK_URL`，再重新部署一次**（第一次部署时还不知道域名，Webhook 设不上；第二次机器人启动时会自动把 Webhook 注册到这个域名上）。
7. 验证：浏览器打开 `https://你的域名/health`，看到 `{"status":"ok","entries":3,...}` 就是跑起来了。
8. Telegram 里给机器人发 `/start`，再发 `/search 哔哩`，能回结果就是通了。

## 部署步骤（Docker 镜像方式）

1. 本地构建并推送：
   ```bash
   cd telegram-bot
   docker build -t 你的用户名/resource-bot:latest .
   docker push 你的用户名/resource-bot:latest
   ```
2. Cloady 控制台 → Add application → 选 **Docker image**，填 `你的用户名/resource-bot:latest`。
3. 环境变量同上表，`WEBHOOK_URL` 先空着部署一次，拿到域名后填上再重新部署一次。
4. 其余验证步骤同上。

## 常见问题

- **机器人不回消息**：先看 `/health` 通不通；再检查 `WEBHOOK_URL` 是不是填了部署后的真实域名、末尾有没有多余斜杠；Telegram 里用 `@BotFather` 的 `/setjoingroups` 确认机器人没被禁用。
- **改了 WEBHOOK_URL 没生效**：改完环境变量必须重新部署（Redeploy），机器人启动时才会重新注册 Webhook。
- **7 天没人用会被休眠**：免费档 7 天无流量会暂停应用，访问一次应用域名（或给机器人发条消息）就能唤醒。
- **流量**：每月 10 GB 出站，机器人回文字消息几乎不耗流量，不用担心。
- **资源丢了怎么办**：数据存在容器内的 `data/library.json`。Cloady 免费档没有持久卷保证，重要资源建议定期在 Telegram 里用 `/list` 导出备份（或把 `library.json` 另存一份）。
- **千万别把 BOT_TOKEN 写进代码或公开仓库**：只放在 Cloady 的环境变量里。
