# Telegram 通知功能 — 设计文档

**日期**: 2026-07-28  
**状态**: 已确认

---

## 概述

为 `send_email` GitHub Actions Action 增加 Telegram Bot 消息发送能力。用户通过 `channel` 参数灵活选择通知渠道：`email`、`telegram` 或 `both`。同时将现有邮件逻辑拆分为独立模块，保持代码结构清晰可扩展。

## 文件结构

```
send_email/
├── action.yml              # 增加 telegram 相关 inputs
├── package.json            # 新增 devDependencies（测试框架）
├── index.js                # 入口：读取参数 → 校验 → 按 channel 调度
└── lib/
    ├── email.js            # 从 index.js 提取 SMTP 发信逻辑
    └── telegram.js         # 调用 Telegram Bot API (sendMessage)
```

## action.yml 变更

### 新增 Inputs

| 参数 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `channel` | 否 | `email` | `email` / `telegram` / `both` |
| `telegram_chat_id` | 条件必填 | — | 当 channel 为 telegram 或 both 时必填 |
| `telegram_parse_mode` | 否 | `MarkdownV2` | `MarkdownV2` / `HTML` / 空字符串（纯文本） |
| `telegram_disable_preview` | 否 | `false` | 是否禁用链接预览 |

### 环境变量

| 变量 | 说明 |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token，通过 `${{ secrets.XXX }}` 传入，由 `index.js` 从 `process.env` 读取 |

### 现有 Inputs（不变）

`server_address`、`server_port`、`username`、`password`、`subject`、`body`、`to`、`from`、`html` — 当 channel 为 `email` 或 `both` 时使用。

## 模块设计

### index.js — 入口与调度

- 读取所有 inputs，校验 channel 参数合法性
- 当 channel 含 `telegram` 时：校验 `TELEGRAM_BOT_TOKEN` 环境变量存在，校验 `telegram_chat_id` 非空
- 当 channel 含 `email` 时：按现有逻辑校验 email 相关必填参数
- 调度：
  - `email` → 调用 `lib/email.js` 的 `sendEmail()`
  - `telegram` → 调用 `lib/telegram.js` 的 `sendTelegram()`
  - `both` → `Promise.allSettled()` 并行调用，各自失败不阻断对方，最终任一失败则 `core.setFailed`

### lib/email.js — SMTP 邮件

从现有 `index.js` 中提取 SMTP 逻辑，封装为独立函数：

```js
async function sendEmail({ serverAddress, serverPort, username, password,
                           subject, body, to, from, isHtml })
// 返回: { messageId: string }
// 异常: throw Error
```

- 内部使用 `nodemailer.createTransport` + `sendMail`
- `secure: serverPort === 465`

### lib/telegram.js — Telegram Bot API

调用 Telegram Bot API 的 `sendMessage` 端点：

```js
async function sendTelegram({ botToken, chatId, text, parseMode, disablePreview })
// 返回: { messageId: number, chat: { id, type } }
// 异常: throw Error
```

- API endpoint: `https://api.telegram.org/bot<token>/sendMessage`
- Request: POST JSON body
- Response 校验：
  - 非 200 → throw Error，附带状态码
  - 200 但 `ok: false` → throw Error，附带 `description`
  - 200 且 `ok: true` → 返回 `result.message_id` 和 `result.chat`

## 数据流

```
                    action.yml inputs
                          │
                          ▼
                      index.js
                    （读取参数、校验）
                     ╱              ╲
            channel=email        channel=telegram
               │                      │
               ▼                      ▼
          lib/email.js           lib/telegram.js
          (nodemailer)          (fetch → Bot API)
               │                      │
               ▼                      ▼
          core.info / core.setFailed
```

## 错误处理

| 场景 | 处理 |
|---|---|
| channel 值非法（非 email/telegram/both） | `core.setFailed` 并终止 |
| channel=telegram 但 TELEGRAM_BOT_TOKEN 未设 | `core.setFailed` 并终止 |
| channel=telegram 但 chat_id 为空 | `core.setFailed` 并终止 |
| Telegram API 返回非 200 | `core.setFailed`，附带 status 和 body |
| Telegram API 返回 ok:false | `core.setFailed`，附带 description |
| channel=both 时一边失败 | 两边独立执行，各自错误上报，最终汇总失败 |
| email 发送失败 | 不变，保持现有 nodemailer 异常处理 |

## 测试

纯单元测试，mock 外部依赖：

- `lib/email.test.js`：mock `nodemailer.createTransport`，验证 transporter 参数和 sendMail 调用
- `lib/telegram.test.js`：mock `global.fetch`，验证请求 URL、body、headers，覆盖成功 / 非 200 / ok:false / parseMode 变体等分支

## 依赖

- 现有：`nodemailer`、`@actions/core`
- 新增（dev）：`vitest`（测试框架）
- Telegram API 调用使用 Node.js 内置 `fetch`（Node 18+），无需额外依赖
