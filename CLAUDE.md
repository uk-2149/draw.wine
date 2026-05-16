@AGENTS.md

# Claude Policy Fallback

This file is a concise fallback summary for AI agents. If anything here conflicts with [AGENTS.md](AGENTS.md), the AGENTS policy wins.

## Core Rules

- Do not read, expose, copy, summarize, or log secrets or personal data.
- Never hardcode API keys, tokens, passwords, connection strings, webhook URLs, or private emails.
- Read secrets from environment variables or approved secret stores only.
- Do not place secrets in frontend code, static assets, documentation, tests, or commit messages.
- Keep logs and error messages sanitized; do not expose tokens, cookies, request bodies, or raw provider errors.
- Validate and sanitize untrusted input before use.
- Do not weaken auth or permission boundaries.
- Prefer secure defaults and ask for clarification before handling sensitive data.
- Avoid unnecessary dependencies and untrusted external calls.
- After every major change, run build and lint checks, or the closest available project checks, and fix relevant failures before finalizing.

## Checklist Before Finalizing

- No hardcoded secret-like values were introduced.
- No sensitive values are logged or returned in API responses.
- All keys and secrets come from environment variables or approved secret stores.
- Frontend or client bundles do not contain backend secrets.
- New docs and config examples use placeholders only.
