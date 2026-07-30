# Telegram Media Support

**Date:** 2026-07-30
**Status:** approved

## Summary

Extend Telegram notification module to support `sendPhoto`, `sendDocument`, and `sendMediaGroup` in addition to existing `sendMessage`.

## Design Decisions

| Decision | Choice |
|----------|--------|
| Method dispatch | Unified `sendTelegram()` with internal switch |
| URL vs file | Auto-detect: `http(s)://` prefix → URL mode, else multipart upload |
| mediaGroup input | Two inputs: comma-separated (`telegram_media`) + JSON array (`telegram_media_group`) |
| HTML escaping | Not added — user provides valid HTML |
| New dependencies | Zero — Node 20 native `fetch` + `FormData` |

## Architecture

```
sendTelegram({ method, botToken, chatId, ... })
  ├─ method='sendMessage'    → sendTelegramMessage()
  ├─ method='sendPhoto'      → sendTelegramPhoto()
  ├─ method='sendDocument'   → sendTelegramDocument()
  └─ method='sendMediaGroup' → sendTelegramMediaGroup()
```

Each sub-function constructs the appropriate Telegram Bot API request, auto-detecting media source type (URL or local file path).

## Action Inputs (new)

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `telegram_method` | string | `sendMessage` | `sendMessage` / `sendPhoto` / `sendDocument` / `sendMediaGroup` |
| `telegram_photo` | string | — | Image URL or local file path |
| `telegram_photo_caption` | string | — | Caption for photo |
| `telegram_document` | string | — | Document URL or local file path |
| `telegram_document_caption` | string | — | Caption for document |
| `telegram_media` | string | — | Comma-separated URLs (simple media group) |
| `telegram_media_group` | string | — | JSON array of `{url, caption}` objects (full media group) |

## Error Handling

Same pattern as existing `sendMessage`: HTTP-level errors and Telegram API `ok: false` errors both throw, caught by `index.js` → `core.setFailed()`.

## Scope

- `lib/telegram.js`: ~37 → ~120 lines
- `index.js`: Telegram branch adds ~5 param lines
- `action.yml`: +7 inputs
- Zero new npm dependencies
