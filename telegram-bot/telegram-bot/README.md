# 资源百宝库 Telegram Bot

一个很小的 Telegram 机器人：搜你自己的资源库。纯 Node.js，**没有任何第三方依赖**，一个 `index.js` 就是全部。

## 它能做什么

| 命令 | 说明 |
|---|---|
| `/start`、`/help` | 使用说明 |
| `/search <关键词>` | 按名字/标签搜库里的资源，最多返回 10 条 |
| `/list [分类]` | 最近 10 条，分类：`galgame`、`anime`、`news` |
| `/news` | 公开 RSS 的最新头条（取不到就明确报错，不编新闻） |
| `/add <分类> <标题> \| <链接>` | 管理员添加资源 |
| `/del <编号>` | 管理员删除资源 |

## 重要规则

- **库里只存你自己加的链接。** 机器人不从任何平台抓资源、不提供任何平台的搜索。
- **没有成人内容。** 只有三个分类：`galgame`（Galgame）、`anime`（二次元）、`news`（新闻资讯）。不要往库里加成人内容链接。
- 内置的 3 条种子数据只是示例（CLANNAD 官网、哔哩哔哩、人民网），`/del` 掉再加自己的就行。

## 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `BOT_TOKEN` | 是 | @BotFather 给的 token，**不要写进代码、不要发给别人** |
| `ADMIN_ID` | 是 | 管理员的 Telegram 数字 id（给 @userinfobot 发消息就能看到），只有这个人能 `/add`、`/del` |
| `PORT` | 否 | HTTP 端口，默认 3000；Cloady 会自己注入 `$PORT` |
| `WEBHOOK_URL` | Webhook 模式必填 | 你的 Cloady 应用域名，如 `https://xxx.cloady.io`（不带末尾斜杠） |
| `WEBHOOK_SECRET` | 否 | 可选，设置后 Telegram 发来的请求必须带上这个 secret 才受理 |
| `POLLING` | 否 | 设为 `true` 时用长轮询（本地测试用），默认走 Webhook |
| `NEWS_RSS` | 否 | 新闻 RSS 地址，默认 Google 新闻中文版 RSS |

## 本地运行

```bash
# 1. 先在 Telegram 里找 @BotFather，/newbot 建一个机器人，拿到 token
# 2. 给 @userinfobot 发任意消息，拿到你的数字 id（ADMIN_ID）

BOT_TOKEN=你的token ADMIN_ID=你的数字id POLLING=true node index.js
```

然后在 Telegram 里给你的机器人发 `/search 哔哩`，应该能搜到种子数据。

健康检查：

```bash
curl http://localhost:3000/health
# {"status":"ok","entries":3,"mode":"polling"}
```

## Docker 运行

```bash
docker build -t resource-bot .
docker run -d --name resource-bot \
  -e BOT_TOKEN=你的token \
  -e ADMIN_ID=你的数字id \
  -e WEBHOOK_URL=https://你的域名 \
  -p 3000:3000 \
  resource-bot
```

数据存在容器内的 `data/library.json`。想长期保存，挂一个 volume：

```bash
docker run -d --name resource-bot -v resource-data:/app/data \
  -e BOT_TOKEN=... -e ADMIN_ID=... -e WEBHOOK_URL=... resource-bot
```

## 文件结构

```
telegram-bot/
├── index.js            # 机器人全部代码（无依赖）
├── package.json
├── Dockerfile          # node:20-alpine 极简镜像
├── .dockerignore
├── data/library.json   # 资源库（种子示例数据）
├── README.md           # 本文件
└── cloady-deploy.md    # Cloady 部署步骤
```
