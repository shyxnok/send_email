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
| `telegram_parse_mode` | 否 | `MarkdownV2` | 消息格式：`MarkdownV2` / `HTML` / 空（纯文本） |
| `telegram_disable_preview` | 否 | `false` | 禁用链接预览 |

### 环境变量

| 变量 | 说明 |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token，channel 为 telegram/both 时必填 |

## 示例

### 仅邮件（默认，向后兼容）

```yaml
- uses: ./send_email
  with:
    server_address: smtp.example.com
    server_port: 587
    username: ${{ secrets.EMAIL_USER }}
    password: ${{ secrets.EMAIL_PASS }}
    subject: "Build Result"
    body: "CI build passed ✅"
    to: team@example.com
    from: ci@example.com
```

### 仅 Telegram

```yaml
- uses: ./send_email
  with:
    channel: telegram
    body: "*CI Build*: passed ✅\n[View logs](https://github.com/...)"
    telegram_chat_id: "-1001234567890"
    telegram_parse_mode: MarkdownV2
  env:
    TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
```

### 双通道并行

```yaml
- uses: ./send_email
  with:
    channel: both
    body: "Deploy to production completed"
    # Email
    server_address: smtp.example.com
    server_port: 587
    username: ${{ secrets.EMAIL_USER }}
    password: ${{ secrets.EMAIL_PASS }}
    subject: "Deploy Result"
    to: team@example.com
    from: ci@example.com
    # Telegram
    telegram_chat_id: "-1001234567890"
  env:
    TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
```
