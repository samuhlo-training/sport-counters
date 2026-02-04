# Logging Style Guide

All application logs must follow a **Brutalist + Minimalist** aesthetic. This means:
clean lines, monospaced alignment, high contrast tags, and zero emojis.

## Format Structure

```text
[TAG]  :: ACTION_NAME   :: Details or Context
```

## Columns

1.  **Tag**: Max 6 chars, uppercase, enclosed in `[]`. Examples: `[WARN]`, `[DB]`, `[API]`.
2.  **Separator**: `::` (or `>>` for start/async start, `++` for success/completion, `->` for outbound).
3.  **Action**: Max 12 chars, uppercase. Examples: `SIG_MISSING`, `WRITING`, `EXTRACTED`.
4.  **Details**: The message content. minimal punctuation. key: value pairs preferred.

## Examples

### Warnings & Errors
```text
[WARN]  :: SIG_MISSING   :: Webhook Secret not set. Skipping verification.
[ERR]   :: DB_CONN       :: Connection timed out after 5000ms.
```

### Webhooks
```text
[HOOK]  :: TRIGGER_REC   :: source: github/tiny-showcase | branch: main
[INGEST] >> START        :: Context loading...
```

### Analysis & Data
```text
[ANLZ]  >> README.md     :: Size: 4917 chars | Status: AI_PROCESSING
[DATA]  ++ EXTRACTED     :: entity: "Tiny Show"
```

### Database
```text
[DB]    >> WRITING       :: Committing transaction...
[DB]    ++ SAVED         :: id: tiny-showcase
```

### Network/API
```text
[API]   -> OUTBOUND      :: target: localhost:3000/api/webhooks/github
[200]   :: OK            :: Signature: sha256=5e0f308...
```

## Implementation Rules
- **No Emojis**: 🚫 🚀, ✅, ❌.
- **Alignment**: visual alignment of separators is encouraged where possible, but consistency of structure is primary.
- **Tags**: Keep them short (2-6 chars).
