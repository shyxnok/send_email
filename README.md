# Send Notification Action

GitHub Actions 通知 Action，支持 Email 和 Telegram 双通道。

## 参数

| 参数 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `channel` | 否 | `email` | 通知渠道：`email` / `telegram` / `both` |
| `body` | 是 | — | 消息正文 |
| **Email** | | | |
| `server_address` | 条件必填 | — | SMTP 服务器地址（channel=email/both 时必填） |
| `server_port` | 条件必填 | — | SMTP 端口 |
| `username` | 条件必填 | — | 邮箱账号 |
| `password` | 条件必填 | — | 邮箱密码 |
| `subject` | 条件必填 | — | 邮件主题 |
| `to` | 条件必填 | — | 收件人 |
| `from` | 条件必填 | — | 发件人 |
| `html` | 否 | `false` | 邮件正文是否为 HTML |
| **Telegram** | | | |
| `telegram_chat_id` | 条件必填 | — | 目标 Chat ID（channel=telegram/both 时必填） |
| `telegram_parse_mode` | 否 | `MarkdownV2` | 消息格式：`HTML` / `MarkdownV2` / 空（纯文本） |
| `telegram_disable_preview` | 否 | `false` | 禁用链接预览 |
| `telegram_escape_markdown` | 否 | `false` | 自动转义 MarkdownV2 特殊字符（`_` `*` 等） |

### 环境变量

| 变量 | 说明 |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token，channel 为 telegram/both 时必填 |

## 示例

### 仅邮件

```yaml
- uses: shyxnok/send_email@v1.0.0
  with:
    server_address: ${{ secrets.SMTP_SERVER }}
    server_port: ${{ secrets.SMTP_PORT }}
    username: ${{ secrets.SMTP_USER }}
    password: ${{ secrets.SMTP_PASS }}
    subject: "Build Result"
    body: "CI build passed ✅"
    to: team@example.com
    from: ci@example.com
```

### 仅 Telegram（推荐 HTML 模式）

消息中包含仓库名、分支名等动态内容时，推荐使用 `HTML` 模式，避免 `_` 等字符触发 MarkdownV2 解析错误。

```yaml
- uses: shyxnok/send_email@v1.0.0
  with:
    channel: telegram
    body: |
      <b>✅ Build Passed</b>
      Repo: ${{ github.repository }}
      Branch: ${{ github.ref_name }}
    telegram_chat_id: "${{ secrets.TELEGRAM_CHAT_ID }}"
    telegram_parse_mode: HTML
  env:
    TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
```

### CI 成功/失败双通知

```yaml
- name: Notify Success
  if: success()
  uses: shyxnok/send_email@v1.0.0
  with:
    channel: telegram
    body: |
      <b>✅ Build Passed</b>
      Repo: ${{ github.repository }}
      Branch: ${{ github.ref_name }}
    telegram_chat_id: "${{ secrets.TELEGRAM_CHAT_ID }}"
    telegram_parse_mode: HTML
  env:
    TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}

- name: Notify Failure
  if: failure()
  uses: shyxnok/send_email@v1.0.0
  with:
    channel: telegram
    body: |
      <b>❌ Build Failed</b>
      Repo: ${{ github.repository }}
      Branch: ${{ github.ref_name }}
      <a href="${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}">View logs</a>
    telegram_chat_id: "${{ secrets.TELEGRAM_CHAT_ID }}"
    telegram_parse_mode: HTML
  env:
    TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
```

### 双通道并行（Email + Telegram）

```yaml
- uses: shyxnok/send_email@v1.0.0
  with:
    channel: both
    body: "Deploy to production completed"
    # Email
    server_address: ${{ secrets.SMTP_SERVER }}
    server_port: ${{ secrets.SMTP_PORT }}
    username: ${{ secrets.SMTP_USER }}
    password: ${{ secrets.SMTP_PASS }}
    subject: "Deploy Result"
    to: team@example.com
    from: ci@example.com
    # Telegram
    telegram_chat_id: "${{ secrets.TELEGRAM_CHAT_ID }}"
    telegram_parse_mode: HTML
  env:
    TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
```

## Telegram 格式对照

| MarkdownV2 | HTML | 纯文本 |
|---|---|---|
| `*bold*` | `<b>bold</b>` | bold |
| `_italic_` | `<i>italic</i>` | italic |
| `[text](url)` | `<a href="url">text</a>` | url |
| `` `code` `` | `<code>code</code>` | code |

> **建议**：消息中包含仓库名、分支名等 GitHub 动态内容时优先用 `HTML` 模式，因为这些值可能包含 `_`、`*` 等 MarkdownV2 特殊字符，容易触发 400 错误。如果必须用 MarkdownV2，可开启 `telegram_escape_markdown: true` 自动转义（会失去内联格式）。
