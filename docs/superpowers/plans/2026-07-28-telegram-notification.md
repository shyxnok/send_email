# Telegram 通知功能 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 send_email GitHub Action 增加 Telegram Bot 通知能力，通过 `channel` 参数灵活选择 email/telegram/both。

**Architecture:** index.js 作为入口读取参数并调度，lib/email.js 封装 nodemailer SMTP 逻辑，lib/telegram.js 通过 fetch 调用 Telegram Bot API。channel=both 时使用 Promise.allSettled 并行发送，互不阻断。

**Tech Stack:** Node.js 18+, nodemailer, @actions/core, vitest (dev)

## Global Constraints

- Node.js 版本 >= 18（使用内置 `fetch`）
- `TELEGRAM_BOT_TOKEN` 从 `process.env` 读取，不作为 action input
- channel 有效值: `email` | `telegram` | `both`，默认 `email`
- telegram_parse_mode 有效值: `MarkdownV2` | `HTML` | 空字符串，默认 `MarkdownV2`
- channel=both 时两边独立执行，任一失败最终 core.setFailed
- 保持向后兼容：不传 channel 时行为与原来完全一致（只发邮件）

---

### Task 1: 安装 vitest 并配置测试脚本

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `npm test` 和 `npm run test:watch` 可用

- [ ] **Step 1: 安装 vitest**

```bash
npm install --save-dev vitest
```

- [ ] **Step 2: 更新 package.json scripts**

将 `package.json` 的 scripts 字段改为：

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 3: 验证 vitest 可运行**

```bash
npm test
```

Expected: vitest 运行成功，输出 "No test files found" 或类似信息（因为还没有测试文件）。

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add vitest for testing"
```

---

### Task 2: 创建 lib/email.test.js（先写测试）

**Files:**
- Create: `lib/email.test.js`

**Interfaces:**
- Produces: `sendEmail()` 的测试套件，覆盖成功/端口465 SSL/异常

- [ ] **Step 1: 创建目录并编写测试**

```bash
mkdir -p lib
```

创建 `lib/email.test.js`：

```js
const { describe, it, expect, vi, beforeEach } = require('vitest');

// Mock nodemailer before importing the module under test
const mockSendMail = vi.fn();
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: mockSendMail,
    })),
  },
}));

const { sendEmail } = require('./email');

describe('sendEmail', () => {
  const validParams = {
    serverAddress: 'smtp.example.com',
    serverPort: 587,
    username: 'user@example.com',
    password: 's3cret',
    subject: 'Test Subject',
    body: 'Hello World',
    to: 'to@example.com',
    from: 'from@example.com',
    isHtml: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends a plain text email and returns messageId', async () => {
    mockSendMail.mockResolvedValue({ messageId: '<abc123@example.com>' });

    const result = await sendEmail(validParams);

    expect(result).toEqual({ messageId: '<abc123@example.com>' });
    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'from@example.com',
      to: 'to@example.com',
      subject: 'Test Subject',
      text: 'Hello World',
    });
  });

  it('sends an HTML email when isHtml is true', async () => {
    mockSendMail.mockResolvedValue({ messageId: '<html456@example.com>' });

    const result = await sendEmail({ ...validParams, isHtml: true, body: '<h1>Hi</h1>' });

    expect(result.messageId).toBe('<html456@example.com>');
    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
      html: '<h1>Hi</h1>',
    }));
  });

  it('uses secure: true when port is 465', async () => {
    const nodemailer = require('nodemailer');
    mockSendMail.mockResolvedValue({ messageId: '<ssl@example.com>' });

    await sendEmail({ ...validParams, serverPort: 465 });

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 465,
        secure: true,
      }),
    );
  });

  it('uses secure: false when port is not 465', async () => {
    const nodemailer = require('nodemailer');
    mockSendMail.mockResolvedValue({ messageId: '<nossl@example.com>' });

    await sendEmail(validParams); // port 587

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 587,
        secure: false,
      }),
    );
  });

  it('throws when sendMail fails', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP connection refused'));

    await expect(sendEmail(validParams)).rejects.toThrow('SMTP connection refused');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run lib/email.test.js
```

Expected: FAIL — `Cannot find module './email'`

- [ ] **Step 3: Commit**

```bash
git add lib/email.test.js
git commit -m "test: add email module tests"
```

---

### Task 3: 创建 lib/email.js（提取现有 SMTP 逻辑）

**Files:**
- Create: `lib/email.js`

**Interfaces:**
- Produces: `sendEmail({ serverAddress, serverPort, username, password, subject, body, to, from, isHtml }) → Promise<{ messageId: string }>`
- Consumed by: Task 5 (index.js)

- [ ] **Step 1: 编写 email.js**

创建 `lib/email.js`：

```js
const nodemailer = require('nodemailer');

async function sendEmail({ serverAddress, serverPort, username, password,
                           subject, body, to, from, isHtml }) {
  const transporter = nodemailer.createTransport({
    host: serverAddress,
    port: serverPort,
    secure: serverPort === 465,
    auth: {
      user: username,
      pass: password,
    },
  });

  const mailOptions = {
    from,
    to,
    subject,
    [isHtml ? 'html' : 'text']: body,
  };

  const info = await transporter.sendMail(mailOptions);
  return { messageId: info.messageId };
}

module.exports = { sendEmail };
```

- [ ] **Step 2: 运行测试确认通过**

```bash
npx vitest run lib/email.test.js
```

Expected: 5 tests PASS

- [ ] **Step 3: Commit**

```bash
git add lib/email.js
git commit -m "feat: extract email sending logic to lib/email.js"
```

---

### Task 4: 创建 lib/telegram.test.js（先写测试）

**Files:**
- Create: `lib/telegram.test.js`

**Interfaces:**
- Produces: `sendTelegram()` 的测试套件，覆盖成功/非200/ok:false/parse_mode变体/disablePreview

- [ ] **Step 1: 编写 telegram 测试**

创建 `lib/telegram.test.js`：

```js
const { describe, it, expect, vi, beforeEach } = require('vitest');

// We must mock fetch before importing the module
let mockFetch;
beforeEach(() => {
  mockFetch = vi.fn();
  vi.stubGlobal('fetch', mockFetch);
});

// Dynamic import after fetch is stubbed — but since we use require, stub first
const { sendTelegram } = require('./telegram');

describe('sendTelegram', () => {
  const validParams = {
    botToken: '123456:ABC-DEF',
    chatId: '-1001234567890',
    text: 'Hello from CI',
    parseMode: 'MarkdownV2',
    disablePreview: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends a message and returns messageId + chat', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        result: {
          message_id: 42,
          chat: { id: -1001234567890, type: 'supergroup' },
        },
      }),
    });

    const result = await sendTelegram(validParams);

    expect(result).toEqual({
      messageId: 42,
      chat: { id: -1001234567890, type: 'supergroup' },
    });
  });

  it('calls the correct API endpoint with JSON body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        result: { message_id: 1, chat: { id: 123, type: 'private' } },
      }),
    });

    await sendTelegram(validParams);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bot123456:ABC-DEF/sendMessage',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: '-1001234567890',
          text: 'Hello from CI',
          parse_mode: 'MarkdownV2',
          disable_web_page_preview: false,
        }),
      },
    );
  });

  it('throws when response is not ok (non-200)', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ ok: false, description: 'Unauthorized' }),
    });

    await expect(sendTelegram(validParams)).rejects.toThrow('Telegram API error 401');
  });

  it('throws when response ok but Telegram returns ok: false', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: false, description: 'Bad Request: chat not found' }),
    });

    await expect(sendTelegram(validParams))
      .rejects.toThrow('Bad Request: chat not found');
  });

  it('sends plain text when parseMode is empty string', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        result: { message_id: 3, chat: { id: 123, type: 'private' } },
      }),
    });

    await sendTelegram({ ...validParams, parseMode: '' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.parse_mode).toBeUndefined();
  });

  it('disables link preview when disablePreview is true', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        result: { message_id: 4, chat: { id: 123, type: 'private' } },
      }),
    });

    await sendTelegram({ ...validParams, disablePreview: true });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.disable_web_page_preview).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run lib/telegram.test.js
```

Expected: FAIL — `Cannot find module './telegram'`

- [ ] **Step 3: Commit**

```bash
git add lib/telegram.test.js
git commit -m "test: add telegram module tests"
```

---

### Task 5: 创建 lib/telegram.js（Telegram Bot API 实现）

**Files:**
- Create: `lib/telegram.js`

**Interfaces:**
- Produces: `sendTelegram({ botToken, chatId, text, parseMode, disablePreview }) → Promise<{ messageId: number, chat: { id, type } }>`
- Consumed by: Task 6 (index.js)

- [ ] **Step 1: 编写 telegram.js**

创建 `lib/telegram.js`：

```js
async function sendTelegram({ botToken, chatId, text, parseMode, disablePreview }) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const body = {
    chat_id: chatId,
    text,
  };

  if (parseMode) {
    body.parse_mode = parseMode;
  }

  if (disablePreview) {
    body.disable_web_page_preview = true;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Telegram API error ${response.status}: ${JSON.stringify(data)}`);
  }

  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description}`);
  }

  return {
    messageId: data.result.message_id,
    chat: {
      id: data.result.chat.id,
      type: data.result.chat.type,
    },
  };
}

module.exports = { sendTelegram };
```

- [ ] **Step 2: 运行测试确认通过**

```bash
npx vitest run lib/telegram.test.js
```

Expected: 6 tests PASS

- [ ] **Step 3: Commit**

```bash
git add lib/telegram.js
git commit -m "feat: add Telegram Bot API module"
```

---

### Task 6: 重写 index.js（入口 + 调度 + 参数校验）

**Files:**
- Modify: `index.js`（用调度逻辑替换现有 SMTP 代码）

**Interfaces:**
- Consumes: `lib/email.js` 的 `sendEmail()`、`lib/telegram.js` 的 `sendTelegram()`
- Produces: GitHub Action 入口点

- [ ] **Step 1: 重写 index.js**

用以下内容替换 `index.js`：

```js
const core = require('@actions/core');
const { sendEmail } = require('./lib/email');
const { sendTelegram } = require('./lib/telegram');

const VALID_CHANNELS = ['email', 'telegram', 'both'];

async function run() {
  try {
    const channel = core.getInput('channel') || 'email';

    // Validate channel
    if (!VALID_CHANNELS.includes(channel)) {
      core.setFailed(`Invalid channel "${channel}". Must be one of: ${VALID_CHANNELS.join(', ')}`);
      return;
    }

    const results = [];

    // --- Email ---
    if (channel === 'email' || channel === 'both') {
      results.push(
        sendEmail({
          serverAddress: core.getInput('server_address'),
          serverPort: parseInt(core.getInput('server_port')),
          username: core.getInput('username'),
          password: core.getInput('password'),
          subject: core.getInput('subject'),
          body: core.getInput('body'),
          to: core.getInput('to'),
          from: core.getInput('from'),
          isHtml: core.getInput('html') === 'true',
        }).then(info => {
          core.info(`Email sent: ${info.messageId}`);
          return { type: 'email', ok: true };
        }).catch(err => {
          core.error(`Email failed: ${err.message}`);
          return { type: 'email', ok: false, error: err.message };
        })
      );
    }

    // --- Telegram ---
    if (channel === 'telegram' || channel === 'both') {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        core.setFailed('TELEGRAM_BOT_TOKEN environment variable is required for Telegram');
        return;
      }

      const chatId = core.getInput('telegram_chat_id');
      if (!chatId) {
        core.setFailed('telegram_chat_id input is required for Telegram');
        return;
      }

      results.push(
        sendTelegram({
          botToken,
          chatId,
          text: core.getInput('body'),
          parseMode: core.getInput('telegram_parse_mode') || 'MarkdownV2',
          disablePreview: core.getInput('telegram_disable_preview') === 'true',
        }).then(info => {
          core.info(`Telegram sent: message_id=${info.messageId}, chat_id=${info.chat.id}`);
          return { type: 'telegram', ok: true };
        }).catch(err => {
          core.error(`Telegram failed: ${err.message}`);
          return { type: 'telegram', ok: false, error: err.message };
        })
      );
    }

    // Wait for all sends to complete
    const outcomes = await Promise.all(results);

    // Report failures
    const failures = outcomes.filter(o => !o.ok);
    if (failures.length > 0) {
      core.setFailed(
        failures.map(f => `${f.type}: ${f.error}`).join('; ')
      );
    }
  } catch (error) {
    core.setFailed(`Unexpected error: ${error.message}`);
  }
}

run();
```

- [ ] **Step 2: 验证现有邮件流程不受影响**

运行 email 测试确认模块仍正常：

```bash
npx vitest run lib/email.test.js
```

Expected: 5 tests PASS

- [ ] **Step 3: 确认全部测试通过**

```bash
npx vitest run
```

Expected: 所有测试 PASS（email 5 个 + telegram 6 个 = 11 个）

- [ ] **Step 4: Commit**

```bash
git add index.js
git commit -m "feat: add channel-based routing with email+telegram dispatch"
```

---

### Task 7: 更新 action.yml（新增 Telegram 参数）

**Files:**
- Modify: `action.yml`

**Interfaces:**
- Produces: 新增 `channel`、`telegram_chat_id`、`telegram_parse_mode`、`telegram_disable_preview` inputs

- [ ] **Step 1: 更新 action.yml**

将 `action.yml` 替换为：

```yaml
name: 'Send Notification Action'
description: 'Send notification via Email and/or Telegram'
inputs:
  channel:
    description: 'Notification channel: email, telegram, or both'
    required: false
    default: 'email'
  server_address:
    description: 'SMTP server address'
    required: false
  server_port:
    description: 'SMTP server port'
    required: false
  username:
    description: 'Email account username'
    required: false
  password:
    description: 'Email account password'
    required: false
  subject:
    description: 'Email subject'
    required: false
  body:
    description: 'Notification message body'
    required: true
  to:
    description: 'Recipient email address'
    required: false
  from:
    description: 'Sender email address'
    required: false
  html:
    description: 'Whether the email body is HTML'
    required: false
    default: 'false'
  telegram_chat_id:
    description: 'Telegram chat ID (required for telegram/both)'
    required: false
  telegram_parse_mode:
    description: 'Telegram parse mode: MarkdownV2, HTML, or leave empty for plain text'
    required: false
    default: 'MarkdownV2'
  telegram_disable_preview:
    description: 'Disable link preview in Telegram messages'
    required: false
    default: 'false'
runs:
  using: 'node16'
  main: 'index.js'
```

- [ ] **Step 2: Commit**

```bash
git add action.yml
git commit -m "feat: add Telegram inputs to action.yml"
```

---

### Task 8: 最终验证

**Files:**
- 验证所有文件存在且测试通过

- [ ] **Step 1: 运行全部测试**

```bash
npm test
```

Expected: 所有 11 个测试 PASS

- [ ] **Step 2: 确认文件结构**

```bash
ls -R lib/
```

Expected 输出：
```
email.js  email.test.js  telegram.js  telegram.test.js
```

- [ ] **Step 3: 确认 .gitignore 包含 node_modules**

```bash
cat .gitignore
```

Expected: `node_modules/`

- [ ] **Step 4: 最终 Commit**

```bash
git add -A
git status
```

确认没有遗漏的文件，如有遗漏则 commit。
