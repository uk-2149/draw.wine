# AI Agent Policy for draw.wine

This policy is model-agnostic and applies to any AI agent or coding assistant used in this repository.

## Scope

- Applies to all AI-generated or AI-assisted changes, suggestions, reviews, docs, tests, scripts, configs, and commit text.
- If multiple policy files exist, the strictest rule wins.

## 1) Secrets and Sensitive Data

- Never read, expose, copy, transform, summarize, or output secret values from files, environment variables, CI/CD configs, logs, terminals, or external tools.
- Treat as sensitive by default: API keys, access tokens, OAuth secrets, JWT secrets, signing keys, cookies, session IDs, private URLs, credentials, database connection strings, and personal data.
- Do not print sensitive values in code, comments, examples, tests, documentation, issue/PR templates, or commit messages.
- If setup requires a secret, reference only variable names and placeholder values.

Allowed example:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

## 2) No Hardcoded Credentials

- Never hardcode keys, tokens, passwords, private emails, webhook URLs, or connection strings.
- Never place secrets in frontend code, static assets, or any client-bundled artifact.
- Read secrets from environment variables or approved secret managers only.
- If required secrets are missing, fail safely with sanitized errors.

## 3) Logging and Error Safety

- Do not log request bodies when they may contain sensitive data.
- Do not log auth headers, cookies, bearer tokens, or session identifiers.
- Keep errors actionable but sanitized.
- Do not expose stack traces or raw provider errors to client responses in production.

## 4) Privacy and Data Minimization

- Process only data required for the feature.
- Prefer aggregated telemetry over user-level raw payload logging.
- Avoid storing sensitive user content unless explicitly necessary and approved.
- Do not send private data to third-party APIs unless explicitly documented and approved.

## 5) External Calls and Integrations

- Do not add outbound calls to unknown or untrusted domains.
- Make external integration endpoints configurable via environment variables.
- New third-party calls must include timeout, bounded retries, and error handling.

## 6) Auth and Authorization Guardrails

- Never bypass authentication/authorization checks for convenience.
- Do not weaken room/session/user permission boundaries.
- Validate and sanitize all untrusted input before use.

## 7) Dependencies and Supply Chain

- Add dependencies only when necessary.
- Prefer maintained, widely adopted libraries.
- Avoid packages that encourage embedding secrets in source code.

## 8) Repository and Version Control Safety

- Never commit real secrets.
- If a secret is discovered, replace with placeholders and require rotation.
- Keep examples and templates secret-free.

## 9) Secure-by-Default AI Behavior

- Prefer secure defaults over permissive defaults.
- Ask for clarification before implementing behavior that may expose sensitive data.
- If uncertain whether data is sensitive, treat it as sensitive.

## 10) UI Consistency and Theme Support

- When changing frontend UI, preserve the app's existing visual language, spacing, typography, and component patterns.
- Keep new UI consistent with the surrounding interface instead of introducing a separate design style.
- Ensure new or modified UI works in both light and dark themes.
- Respect the active app theme when choosing colors, surfaces, borders, shadows, and icon treatments.
- Avoid hardcoded colors that break theme switching or contrast in either theme.

## 11) Pre-Finalization Checklist (Must Pass)

Before finalizing AI-generated changes, all must be true:

- No hardcoded secret-like values were introduced.
- No sensitive values are logged or returned in API responses.
- All keys/secrets are sourced from environment variables or approved secret stores.
- Frontend/client bundles contain no backend secrets.
- New docs/config examples use placeholders only.
- After every major change, run build and lint checks (or the closest available project checks) and fix relevant failures before finalizing.
