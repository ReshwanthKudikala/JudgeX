# Nodemailer 6 → 10 upgrade plan

Do not upgrade `nodemailer` in the current lifecycle change. `npm audit --omit=dev` reports one high advisory on `nodemailer@6.10.1`. The patched line is `nodemailer@10.2.1`, which is a major upgrade.

## What JudgeX uses

`backend/src/infrastructure/email/email.service.js` calls `nodemailer.createTransport` with host, port, `secure`, and user/password auth, then `sendMail({ from, to, subject, text, html })`. The default provider is `console`. SMTP is used only when `EMAIL_PROVIDER=smtp` and the host, user, and password are set. Verification and password-reset messages are plain text plus an HTML alternative. There are no attachments, OAuth2 token fetches, or raw MIME bodies.

Integration coverage in `backend/tests/integration/auth-email.test.js` records the console mailbox. It does not open an SMTP connection, so it cannot detect a Nodemailer 10 transport change.

## Why this is a separate change

Nodemailer 7–10 changed address parsing, TLS defaults, and header handling. The current advisory also names issues this code does not exercise (`envelope.size`, a custom EHLO name, `List-*` comments, `jsonTransport` / `raw` / `resolveContent` file access, OAuth2 token fetch, and DKIM unfolding). Address-parser and TLS changes still apply to `sendMail` recipients and SMTP. `createTransport` / `sendMail` still exist, but the major versions are not a drop-in lockfile bump. Forcing the upgrade to clear CI would hide that gap.

## Required before upgrading

1. Read the Nodemailer 7, 8, 9, and 10 changelogs against `createTransport` and `sendMail`.
2. Add a test that stands up a local SMTP catcher and sends one verification message and one password-reset message through `EMAIL_PROVIDER=smtp`.
3. Assert the recipient, subject, text link, and HTML alternative survive the new parser, and that a malformed recipient is rejected.
4. Run `backend/tests/integration/auth-email.test.js` plus that SMTP test.
5. Only then change the `nodemailer` range to `^10.2.1` and re-run `npm audit --omit=dev`.

Until that lands, leave the advisory visible. Do not suppress it in CI.
