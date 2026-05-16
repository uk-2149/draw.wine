# AI Safety and Security Restrictions for draw.wine

These instructions apply to all AI-assisted code changes in this repository.
Canonical shared policy for all AI agents/models: see `AGENTS.md` at repository root.

## 1) Secrets and Sensitive Data

- Never read, expose, copy, transform, or summarize secret values from local files, environment variables, CI configs, logs, or external tools.
- Treat the following as sensitive by default: API keys, access tokens, OAuth secrets, JWT secrets, signing keys, cookies, session IDs, private URLs, credentials, database strings, and personal data.
- Do not print sensitive values in code, examples, comments, tests, commit messages, issue templates, or documentation.
- If a secret is required for setup, reference only the variable name and show a placeholder value.

Allowed example:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

## 2) No Hardcoded Keys or Credentials

- Never hardcode keys, tokens, passwords, private emails, webhook URLs, or connection strings in source code.
- Never add secrets to frontend code, static assets, or files that are bundled to the client.
- Access secrets only through environment variables or secure secret managers.
- Use fail-safe behavior when required secrets are missing: return a controlled error and log only non-sensitive context.

## 3) Logging and Error Handling

- Do not log request bodies if they can contain PII or secrets.
- Do not log auth headers, cookies, or full tokens.
- Error messages must be actionable but sanitized.
- Stack traces or raw provider errors should not be exposed to client responses in production.

## 4) Data Minimization and Privacy

- Collect and process only the minimum user data needed for the feature.
- Prefer aggregated telemetry over per-user raw payload logging.
- Avoid persisting sensitive user content unless explicitly required.
- Never send private data to third-party APIs unless that flow is explicitly approved and documented.

## 5) Network and External Calls

- Do not add outbound calls to unknown or untrusted domains.
- External integrations must be configurable through environment variables.
- Any new third-party API call should include timeout, retry limits, and error handling.

## 6) Authentication and Authorization Guardrails

- Do not bypass auth checks for convenience.
- Never weaken permission boundaries across rooms, sessions, or user-scoped actions.
- Validate and sanitize all untrusted input before processing.

## 7) Dependency and Supply Chain Safety

- Do not introduce dependencies without clear need.
- Prefer well-maintained packages with broad adoption.
- Avoid packages that require embedding secrets directly into code.

## 8) Git and Repository Safety

- Never commit real secrets.
- If a secret is accidentally found, rotate it immediately and replace with placeholders.
- Keep examples and templates secret-free.

## 9) Safe Defaults for AI-Generated Changes

- Prefer secure defaults over permissive defaults.
- Ask for clarification before implementing behavior that may expose or process sensitive data.
- If uncertain whether data is sensitive, treat it as sensitive.

## 10) UI Consistency and Theme Support

- When changing frontend UI, preserve the app's existing visual language, spacing, typography, and component patterns.
- Keep new UI consistent with the surrounding interface instead of introducing a separate design style.
- Ensure new or modified UI works in both light and dark themes.
- Respect the active app theme when choosing colors, surfaces, borders, shadows, and icon treatments.
- Avoid hardcoded colors that break theme switching or contrast in either theme.

## 11) Implementation Checklist (Must Pass)

Before finalizing AI-generated changes, verify all are true:

- No hardcoded secret-like values were introduced.
- No sensitive values are logged or returned in API responses.
- All keys are read from environment variables.
- Frontend bundles do not contain backend secrets.
- New docs/config examples use placeholders only.
- After every major change, run build and lint checks (or the closest available project checks) and fix relevant failures before finalizing.
