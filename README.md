# Send Notification Action

GitHub Actions 通知 Action，支持 Email 和 Telegram 双通道。Telegram 支持文本、图片、文件、多图组和内联键盘。

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
| **Telegram 基础** | | | |
| `telegram_chat_id` | 条件必填 | — | 目标 Chat ID（channel=telegram/both 时必填） |
| `telegram_method` | 否 | `sendMessage` | 消息类型：`sendMessage` / `sendPhoto` / `sendDocument` / `sendMediaGroup` |
| `telegram_parse_mode` | 否 | `MarkdownV2` | 消息格式：`HTML` / `MarkdownV2` / 空（纯文本） |
| `telegram_disable_preview` | 否 | `false` | 禁用链接预览 |
| `telegram_escape_markdown` | 否 | `false` | 自动转义 MarkdownV2 特殊字符 |
| `telegram_reply_markup` | 否 | — | JSON 字符串，内联键盘或自定义回复标记 |
| **sendPhoto** | | | |
| `telegram_photo` | sendPhoto 必填 | — | 图片 URL 或本地文件路径 |
| `telegram_photo_caption` | 否 | — | 图片附文（支持 HTML/MarkdownV2） |
| **sendDocument** | | | |
| `telegram_document` | sendDocument 必填 | — | 文件 URL 或本地文件路径 |
| `telegram_document_caption` | 否 | — | 文件附文 |
| **sendMediaGroup** | | | |
| `telegram_media` | 条件必填 | — | 逗号分隔的图片 URL 列表（简单模式，最多 10 张） |
| `telegram_media_group` | 条件必填 | — | JSON 数组 `[{"type":"photo","media":"url","caption":"..."}]`（完整模式） |
| **模板** | | | |
| `telegram_template` | 否 | — | JSON 模板文件路径，支持 `{{VAR}}` 占位符 |
| `telegram_template_vars` | 否 | — | JSON 键值对，模板变量替换值（优先级高于环境变量） |

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

### 发文本（HTML 模式，推荐）

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

### CI 成功/失败（单 step，用 job.status）

```yaml
- name: Notify
  if: always()
  uses: shyxnok/send_email@v1.0.0
  with:
    channel: telegram
    body: |
      ${{ job.status == 'success' && '✅' || '❌' }} <b>CI ${{ job.status }}</b>
      Repo: ${{ github.repository }}
      Branch: ${{ github.ref_name }}
    telegram_chat_id: "${{ secrets.TELEGRAM_CHAT_ID }}"
    telegram_parse_mode: HTML
  env:
    TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
```

### 发图片（sendPhoto）

```yaml
- uses: shyxnok/send_email@v1.0.0
  with:
    channel: telegram
    telegram_method: sendPhoto
    telegram_photo: 'https://picsum.photos/600/400'
    telegram_photo_caption: '<b>📸 构建产物截图</b>'
    telegram_parse_mode: HTML
    telegram_chat_id: "${{ secrets.TELEGRAM_CHAT_ID }}"
  env:
    TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
```

本地文件也支持：

```yaml
    telegram_photo: './artifacts/screenshot.png'
```

### 发文件（sendDocument）

```yaml
- uses: shyxnok/send_email@v1.0.0
  with:
    channel: telegram
    telegram_method: sendDocument
    telegram_document: './build/report.pdf'
    telegram_document_caption: '<b>📄 构建报告</b>'
    telegram_parse_mode: HTML
    telegram_chat_id: "${{ secrets.TELEGRAM_CHAT_ID }}"
  env:
    TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
```

### 发多图（sendMediaGroup，简单模式）

```yaml
- uses: shyxnok/send_email@v1.0.0
  with:
    channel: telegram
    telegram_method: sendMediaGroup
    telegram_media: 'https://example.com/img1.png,https://example.com/img2.png'
    telegram_chat_id: "${{ secrets.TELEGRAM_CHAT_ID }}"
  env:
    TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
```

### 发多图（sendMediaGroup，完整模式，每张独立 caption）

```yaml
- uses: shyxnok/send_email@v1.0.0
  with:
    channel: telegram
    telegram_method: sendMediaGroup
    telegram_media_group: |
      [
        {"type":"photo","media":"https://example.com/img1.png","caption":"首页截图"},
        {"type":"photo","media":"https://example.com/img2.png","caption":"数据面板"}
      ]
    telegram_chat_id: "${{ secrets.TELEGRAM_CHAT_ID }}"
  env:
    TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
```

### 内联键盘（reply_markup）

```yaml
- uses: shyxnok/send_email@v1.0.0
  with:
    channel: telegram
    telegram_method: sendPhoto
    telegram_photo: 'https://picsum.photos/600/400'
    telegram_photo_caption: '<b>📡 服务器状态</b>'
    telegram_parse_mode: HTML
    telegram_reply_markup: |
      {
        "inline_keyboard": [
          [{"text":"🔗 监控面板","url":"https://grafana.example.com"}],
          [{"text":"🔄 重载","callback_data":"reload"},{"text":"🛑 静默","callback_data":"silence"}]
        ]
      }
    telegram_chat_id: "${{ secrets.TELEGRAM_CHAT_ID }}"
  env:
    TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
```

### 模板文件（telegram_template）

模板文件 `templates/alert.json`：

```json
{
  "parse_mode": "HTML",
  "caption": "<b>📡 服务器状态</b>\n🕒 {{TIME}}\n🟢 {{STATUS}}\nCPU：{{CPU}}%",
  "reply_markup": {
    "inline_keyboard": [
      [{"text": "🔗 监控", "url": "{{DASHBOARD}}"}]
    ]
  }
}
```

Workflow 引用：

```yaml
- uses: shyxnok/send_email@v1.0.0
  with:
    channel: telegram
    telegram_method: sendPhoto
    telegram_photo: 'https://example.com/chart.png'
    telegram_template: './templates/alert.json'
    telegram_template_vars: '{"TIME":"2026-07-30 15:30","STATUS":"正常","CPU":"76"}'
    telegram_chat_id: "${{ secrets.TELEGRAM_CHAT_ID }}"
  env:
    TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
    DASHBOARD: 'https://grafana.example.com'
```

> `{{VAR}}` 先查 `telegram_template_vars`，再查环境变量，都找不到保留原文。模板中可用字段：`text`、`caption`、`parse_mode`、`reply_markup`、`disable_web_page_preview`。

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

## Telegram HTML 格式对照

| HTML | 效果 |
|---|---|
| `<b>bold</b>` | **bold** |
| `<i>italic</i>` | *italic* |
| `<u>underline</u>` | <u>underline</u> |
| `<a href="url">text</a>` | 链接 |
| `<code>code</code>` | 行内代码 |
| `<pre>code block</pre>` | 代码块 |
| `<blockquote>quote</blockquote>` | 引用 |
| `<blockquote expandable>...</blockquote>` | 可折叠引用 |
| `<tg-spoiler>hidden</tg-spoiler>` | 剧透遮罩 |
