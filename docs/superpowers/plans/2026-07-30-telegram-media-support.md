# Telegram Media Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add sendPhoto, sendDocument, and sendMediaGroup methods to the Telegram module.

**Architecture:** Extend `sendTelegram()` with a `method` parameter that dispatches to internal sub-functions. URL vs local file auto-detection via `http(s)://` prefix check. Zero new npm dependencies — Node 20 native `fetch`, `FormData`, `fs`.

**Tech Stack:** Node.js 20+, no new packages

## Global Constraints

- Zero new npm dependencies
- Single export `sendTelegram` from `lib/telegram.js` — no new exports
- Same error pattern as existing `sendMessage`: HTTP errors and Telegram `ok: false` both throw
- HTML mode: no auto-escaping — user provides valid HTML

---

### Task 1: Extend lib/telegram.js with sendPhoto, sendDocument, sendMediaGroup

**Files:**
- Modify: `lib/telegram.js` (entire file)

**Interfaces:**
- Consumes: existing `sendTelegram({ botToken, chatId, text, parseMode, disablePreview, escapeMd })` signature
- Produces: `sendTelegram({ method, botToken, chatId, text, parseMode, disablePreview, escapeMd, photo, photoCaption, document, documentCaption, media, mediaGroup })` — returns `{ messageId, chat: { id, type } }` on success, throws on failure

**Implementation:**

Replace entire file content:

- [ ] **Step 1: Write the updated telegram module**

```javascript
const fs = require('fs');
const path = require('path');

// Escape MarkdownV2 special characters: _ * [ ] ( ) ~ ` > # + - = | { } . !
function escapeMarkdownV2(text) {
  return text.replace(/[_*[\]()~`>#+=|{}.!\\-]/g, '\\$&');
}

function isUrl(str) {
  return /^https?:\/\//.test(str);
}

function resolveFilePath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(process.env.GITHUB_WORKSPACE || process.cwd(), filePath);
}

// ── sendMessage (existing logic) ──────────────────────────────────────────
async function sendTelegramMessage({ botToken, chatId, text, parseMode, disablePreview, escapeMd }) {
  if (parseMode === 'MarkdownV2' && escapeMd) {
    text = escapeMarkdownV2(text);
  }
  const body = { chat_id: chatId, text };

  if (parseMode) body.parse_mode = parseMode;
  if (disablePreview) body.disable_web_page_preview = true;

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
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
    chat: { id: data.result.chat.id, type: data.result.chat.type },
  };
}

// ── sendPhoto ─────────────────────────────────────────────────────────────
async function sendTelegramPhoto({ botToken, chatId, photo, caption, parseMode,
                                   disablePreview, escapeMd }) {
  if (!photo) throw new Error('telegram_photo is required for sendPhoto');

  if (parseMode === 'MarkdownV2' && escapeMd && caption) {
    caption = escapeMarkdownV2(caption);
  }

  const form = new FormData();
  form.append('chat_id', chatId);

  if (isUrl(photo)) {
    form.append('photo', photo);
  } else {
    const filePath = resolveFilePath(photo);
    form.append('photo', new Blob([fs.readFileSync(filePath)]), path.basename(filePath));
  }

  if (caption) form.append('caption', caption);
  if (parseMode) form.append('parse_mode', parseMode);
  if (disablePreview) form.append('disable_web_page_preview', 'true');

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
    method: 'POST',
    body: form,
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
    chat: { id: data.result.chat.id, type: data.result.chat.type },
  };
}

// ── sendDocument ──────────────────────────────────────────────────────────
async function sendTelegramDocument({ botToken, chatId, document, caption, parseMode,
                                      disablePreview, escapeMd }) {
  if (!document) throw new Error('telegram_document is required for sendDocument');

  if (parseMode === 'MarkdownV2' && escapeMd && caption) {
    caption = escapeMarkdownV2(caption);
  }

  const form = new FormData();
  form.append('chat_id', chatId);

  if (isUrl(document)) {
    form.append('document', document);
  } else {
    const filePath = resolveFilePath(document);
    form.append('document', new Blob([fs.readFileSync(filePath)]), path.basename(filePath));
  }

  if (caption) form.append('caption', caption);
  if (parseMode) form.append('parse_mode', parseMode);
  if (disablePreview) form.append('disable_web_page_preview', 'true');

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
    method: 'POST',
    body: form,
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
    chat: { id: data.result.chat.id, type: data.result.chat.type },
  };
}

// ── sendMediaGroup ────────────────────────────────────────────────────────
async function sendTelegramMediaGroup({ botToken, chatId, media, mediaGroup, parseMode,
                                        disablePreview, escapeMd }) {
  let inputMedia = [];

  if (mediaGroup) {
    inputMedia = JSON.parse(mediaGroup);
  } else if (media) {
    const urls = media.split(',').map(s => s.trim()).filter(Boolean);
    inputMedia = urls.map(url => ({ type: 'photo', media: url }));
  }

  if (inputMedia.length === 0) {
    throw new Error('telegram_media or telegram_media_group is required for sendMediaGroup');
  }
  if (inputMedia.length > 10) {
    throw new Error('sendMediaGroup supports at most 10 items');
  }

  // Apply MarkdownV2 escaping to captions
  if (parseMode === 'MarkdownV2' && escapeMd) {
    inputMedia = inputMedia.map(item => {
      if (item.caption) {
        return { ...item, caption: escapeMarkdownV2(item.caption) };
      }
      return item;
    });
  }

  const body = {
    chat_id: chatId,
    media: inputMedia,
  };

  if (parseMode) body.parse_mode = parseMode;
  if (disablePreview) body.disable_web_page_preview = true;

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMediaGroup`, {
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

  // sendMediaGroup returns an array of messages
  const first = data.result[0];
  return {
    messageId: first.message_id,
    chat: { id: first.chat.id, type: first.chat.type },
    count: data.result.length,
  };
}

// ── Main dispatch ─────────────────────────────────────────────────────────
async function sendTelegram({ method, botToken, chatId, text, parseMode, disablePreview,
                              escapeMd, photo, photoCaption, document, documentCaption,
                              media, mediaGroup }) {
  switch (method) {
    case 'sendPhoto':
      return sendTelegramPhoto({
        botToken, chatId, photo, caption: photoCaption,
        parseMode, disablePreview, escapeMd,
      });
    case 'sendDocument':
      return sendTelegramDocument({
        botToken, chatId, document, caption: documentCaption,
        parseMode, disablePreview, escapeMd,
      });
    case 'sendMediaGroup':
      return sendTelegramMediaGroup({
        botToken, chatId, media, mediaGroup,
        parseMode, disablePreview, escapeMd,
      });
    case 'sendMessage':
    default:
      return sendTelegramMessage({
        botToken, chatId, text, parseMode, disablePreview, escapeMd,
      });
  }
}

module.exports = { sendTelegram };
```

- [ ] **Step 2: Verify syntax**

```bash
node -c lib/telegram.js
```

Expected: no output (syntax OK)

- [ ] **Step 3: Commit**

```bash
git add lib/telegram.js
git commit -m "feat: add sendPhoto, sendDocument, sendMediaGroup to telegram module"
```

---

### Task 2: Update index.js to pass new params

**Files:**
- Modify: `index.js:56-63` (the sendTelegram call in the Telegram branch)

**Interfaces:**
- Consumes: `sendTelegram({ ... })` — now with `method`, `photo`, `photoCaption`, `document`, `documentCaption`, `media`, `mediaGroup` params
- Produces: no change to return value

- [ ] **Step 1: Update the sendTelegram call**

Replace the sendTelegram call object in `index.js` (lines 56-63):

```javascript
      tasks.push(
        sendTelegram({
          method: core.getInput('telegram_method') || 'sendMessage',
          botToken,
          chatId,
          text: core.getInput('body'),
          parseMode: core.getInput('telegram_parse_mode') || 'MarkdownV2',
          disablePreview: core.getInput('telegram_disable_preview') === 'true',
          escapeMd: core.getInput('telegram_escape_markdown') === 'true',
          photo: core.getInput('telegram_photo'),
          photoCaption: core.getInput('telegram_photo_caption'),
          document: core.getInput('telegram_document'),
          documentCaption: core.getInput('telegram_document_caption'),
          media: core.getInput('telegram_media'),
          mediaGroup: core.getInput('telegram_media_group'),
        }).then(info => {
```

The `.then(info => { ... })` and `.catch(err => { ... })` after it stay exactly the same.

- [ ] **Step 2: Verify syntax**

```bash
node -c index.js
```

Expected: no output (syntax OK)

- [ ] **Step 3: Commit**

```bash
git add index.js
git commit -m "feat: pass new telegram media params from action inputs"
```

---

### Task 3: Add new inputs to action.yml

**Files:**
- Modify: `action.yml:43-50` (append after `telegram_escape_markdown`)

**Interfaces:**
- Produces: 7 new action inputs consumed by `index.js` via `core.getInput()`

- [ ] **Step 1: Add inputs after `telegram_escape_markdown`**

Insert after line 50 (`default: 'false'` of `telegram_escape_markdown`):

```yaml
  telegram_method:
    description: 'Telegram method: sendMessage, sendPhoto, sendDocument, or sendMediaGroup'
    required: false
    default: 'sendMessage'
  telegram_photo:
    description: 'Photo URL or local file path (for sendPhoto)'
    required: false
  telegram_photo_caption:
    description: 'Caption for the photo'
    required: false
  telegram_document:
    description: 'Document URL or local file path (for sendDocument)'
    required: false
  telegram_document_caption:
    description: 'Caption for the document'
    required: false
  telegram_media:
    description: 'Comma-separated photo URLs for simple media group'
    required: false
  telegram_media_group:
    description: 'JSON array of {type, media, caption} objects for media group'
    required: false
```

- [ ] **Step 2: Verify YAML is valid**

```bash
node -e "require('fs').readFileSync('action.yml','utf8'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add action.yml
git commit -m "feat: add telegram media inputs to action.yml"
```

---

### Task 4: Rebuild dist and final verification

**Files:**
- Regenerate: `dist/index.js`

- [ ] **Step 1: Build**

```bash
npm run build
```

Expected: `ncc build index.js -o dist` succeeds, no errors.

- [ ] **Step 2: Quick integration smoke test**

```bash
node -e "
  const { sendTelegram } = require('./lib/telegram');
  console.log('Module loaded OK');
  console.log('Exports:', Object.keys(require('./lib/telegram')));
"
```

Expected: `Module loaded OK` with `['sendTelegram']`

- [ ] **Step 3: Run existing tests**

```bash
npm test
```

Expected: all existing tests pass (no regressions)

- [ ] **Step 4: Commit**

```bash
git add dist/
git commit -m "chore: rebuild dist with telegram media support"
```
