# Nodemailer 10.2.1

`backend` depends on `nodemailer@^10.2.1` (resolved 10.2.1). `npm audit --omit=dev` is clean for both backend and frontend. The old production advisory on `nodemailer@6.10.1` is gone.

## What JudgeX sends

`backend/src/infrastructure/email/email.service.js` uses `nodemailer.createTransport` with host, port, `secure`, and user/password auth, then `sendMail({ from, to, subject, text, html })`.

The default provider is `console`. SMTP is used only when `EMAIL_PROVIDER=smtp` and host, user, and password are set. `buildVerifyEmailMessage` and `buildPasswordResetMessage` return `{ to, subject, text }` only. They do not set `html`. There are no attachments, OAuth2 token fetches, or raw MIME bodies.

## Tests

Console-mode registration and password-reset coverage stays in `backend/tests/integration/auth-email.test.js` (`npm test`). That process loads the email service as `console` and must not import the SMTP file, because config freezes `EMAIL_PROVIDER` on first import.

SMTP delivery is a separate process:

```bash
cd backend
npm run test:smtp
```

That runs `node --test tests/smtp/email-smtp.test.js`. The test starts a localhost plaintext SMTP catcher, sets `EMAIL_PROVIDER=smtp` and the catcher host before loading the email service, and closes the catcher and its sockets in `after`. It uses no external SMTP service and no production credentials. CI runs it as the **Backend (smtp)** job, not inside the integration job.

The SMTP tests assert the recipient, subject, text link, `text/plain`, and the absence of `text/html` and `multipart/alternative`. A malformed recipient is rejected and delivers nothing.

## Audit status

Production (`npm audit --omit=dev --audit-level=high`) reports no vulnerabilities.

Full `npm audit` still reports development-only findings that are not safe to clear in this tree:

- **Backend, high:** `nodemon` 3.x depends on `chokidar` 3, which depends on `braces`. The only audit fix is `nodemon@1.14.10`, a major downgrade. Every `nodemon` 3 release, including 3.1.14, still depends on `chokidar@^3.5.2`. Left on nodemon 3.
- **Frontend, high:** `tailwindcss` 3.4 depends on `chokidar`, `micromatch`, `braces`, and `fast-glob`. The audit fix is `tailwindcss@4`, a major upgrade. Left on Tailwind 3.
- **Frontend, moderate:** `postcss-selector-parser` below 7 and `postcss-nested`, pulled in by Tailwind 3. The non-breaking update does not reach parser 7. Left in place.

Other frontend development advisories that have same-major fixes (Vite 6, PostCSS 8, Playwright 1, and their lockfile transitives such as `js-yaml`, `nanoid`, `browserslist`, `brace-expansion`, and `source-map-js`) are updated in the lockfile without `npm audit fix --force`.
