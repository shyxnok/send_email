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
  return path.isAbsolute(filePath)
    ? filePath
    : path.join(process.env.GITHUB_WORKSPACE || process.cwd(), filePath);
}

// ── sendMessage ───────────────────────────────────────────────────────────
async function sendTelegramMessage({ botToken, chatId, text, parseMode,
                                     disablePreview, escapeMd, replyMarkup }) {
  if (parseMode === 'MarkdownV2' && escapeMd) {
    text = escapeMarkdownV2(text);
  }
  const body = { chat_id: chatId, text };

  if (parseMode) body.parse_mode = parseMode;
  if (disablePreview) body.disable_web_page_preview = true;
  if (replyMarkup) body.reply_markup = JSON.parse(replyMarkup);

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
                                   disablePreview, escapeMd, replyMarkup }) {
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
  if (replyMarkup) form.append('reply_markup', replyMarkup);

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
async function sendTelegramDocument({ botToken, chatId, document, caption,
                                      parseMode, disablePreview, escapeMd, replyMarkup }) {
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
  if (replyMarkup) form.append('reply_markup', replyMarkup);

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
async function sendTelegramMediaGroup({ botToken, chatId, media, mediaGroup,
                                        parseMode, disablePreview, escapeMd }) {
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

  if (parseMode === 'MarkdownV2' && escapeMd) {
    inputMedia = inputMedia.map(item =>
      item.caption ? { ...item, caption: escapeMarkdownV2(item.caption) } : item
    );
  }

  const body = {
    chat_id: chatId,
    media: inputMedia,
    ...(parseMode && { parse_mode: parseMode }),
    ...(disablePreview && { disable_web_page_preview: true }),
  };

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

  const first = data.result[0];
  return {
    messageId: first.message_id,
    chat: { id: first.chat.id, type: first.chat.type },
    count: data.result.length,
  };
}

// ── Main dispatch ─────────────────────────────────────────────────────────
async function sendTelegram({ method, botToken, chatId, text, parseMode,
                              disablePreview, escapeMd, replyMarkup, photo, photoCaption,
                              document, documentCaption, media, mediaGroup }) {
  const opts = { botToken, chatId, parseMode, disablePreview, escapeMd, replyMarkup };

  switch (method) {
    case 'sendPhoto':
      return sendTelegramPhoto({ ...opts, photo, caption: photoCaption });
    case 'sendDocument':
      return sendTelegramDocument({ ...opts, document, caption: documentCaption });
    case 'sendMediaGroup':
      return sendTelegramMediaGroup({ ...opts, media, mediaGroup });
    case 'sendMessage':
    default:
      return sendTelegramMessage({ ...opts, text });
  }
}

module.exports = { sendTelegram };
