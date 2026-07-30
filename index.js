const core = require('@actions/core');
const { sendEmail } = require('./lib/email');
const { sendTelegram } = require('./lib/telegram');

const VALID_CHANNELS = ['email', 'telegram', 'both'];

async function run() {
  try {
    const channel = core.getInput('channel') || 'email';

    if (!VALID_CHANNELS.includes(channel)) {
      core.setFailed(`Invalid channel "${channel}". Must be one of: ${VALID_CHANNELS.join(', ')}`);
      return;
    }

    const tasks = [];

    // Email
    if (channel === 'email' || channel === 'both') {
      tasks.push(
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
          return { channel: 'email', ok: true };
        }).catch(err => {
          core.error(`Email failed: ${err.message}`);
          return { channel: 'email', ok: false, error: err.message };
        })
      );
    }

    // Telegram
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
          core.info(`Telegram sent: message_id=${info.messageId}, chat_id=${info.chat.id}`);
          return { channel: 'telegram', ok: true };
        }).catch(err => {
          core.error(`Telegram failed: ${err.message}`);
          return { channel: 'telegram', ok: false, error: err.message };
        })
      );
    }

    const outcomes = await Promise.all(tasks);
    const failures = outcomes.filter(o => !o.ok);

    if (failures.length > 0) {
      core.setFailed(failures.map(f => `${f.channel}: ${f.error}`).join('; '));
    }
  } catch (error) {
    core.setFailed(`Unexpected error: ${error.message}`);
  }
}

run();
