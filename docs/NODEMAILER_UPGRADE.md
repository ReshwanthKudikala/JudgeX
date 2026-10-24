# Nodemailer 10.2.1

`backend` depends on `nodemailer@^10.2.1` (resolved 10.2.1). `npm audit --omit=dev` is clean for both backend and frontend. The old production advisory on `nodemailer@6.10.1` is gone.

## What JudgeX sends

`backend/src/infrastructure/email/email.service.js` uses `nodemailer.createTransport` with host, port, `secure`, and user/password auth, then `sendMail({ from, to, subject, text, html })`.

The default provider is `console`. It stores the message in memory for tests and, in development, in `.local-mailbox/latest.txt`. It does not contact an SMTP server. `EMAIL_PROVIDER=smtp` requires `EMAIL_FROM`, `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS`; incomplete configuration throws at startup and on send. `sendMail` uses a 10 second connection, greeting, and socket timeout. `buildVerifyEmailMessage` and `buildPasswordResetMessage` return `{ to, subject, text }` only. They do not set `html`. There are no attachments, OAuth2 token fetches, or raw MIME bodies. A returned `delivery: "submitted"` means the transport accepted the message.

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

Full `npm audit` reports no backend vulnerabilities. Nodemon stays on 3.

The frontend full audit reports three moderate development findings, all through Tailwind 3: `postcss-selector-parser` below 7.1.6 and `postcss-nested`. The published fix is `tailwindcss@4`. Left on Tailwind 3. The non-breaking update does not reach parser 7.

Other frontend development advisories that have same-major fixes (Vite 6, PostCSS 8, Playwright 1, and their lockfile transitives such as `js-yaml`, `nanoid`, `browserslist`, `brace-expansion`, and `source-map-js`) are updated in the lockfile without `npm audit fix --force`.
