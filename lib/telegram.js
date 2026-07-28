async function sendTelegram({ botToken, chatId, text, parseMode, disablePreview }) {
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

module.exports = { sendTelegram };
