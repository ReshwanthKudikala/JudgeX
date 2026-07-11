/** Map a users row to the public auth payload (never includes password_hash). */
function toPublicUser(row) {
  if (!row) return null;
  const {
    password_hash: _ph,
    token_version: tokenVersion,
    email_verified_at: emailVerifiedAt,
    ...rest
  } = row;
  return {
    ...rest,
    email_verified_at: emailVerifiedAt || null,
    email_verified: Boolean(emailVerifiedAt),
    token_version: tokenVersion ?? 0,
  };
}

module.exports = { toPublicUser };
