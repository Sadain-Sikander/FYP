export function accountName(user) {
  const metadata = user?.user_metadata || {};
  const google =
    user?.identities?.find((identity) => identity.provider === "google")
      ?.identity_data || {};
  return (
    [
      metadata.display_name,
      metadata.full_name,
      metadata.name,
      google.full_name,
      google.name,
    ]
      .find((value) => typeof value === "string" && value.trim())
      ?.trim()
      .slice(0, 80) || ""
  );
}

export function accountPhoto(user) {
  const google =
    user?.identities?.find((identity) => identity.provider === "google")
      ?.identity_data || {};
  const metadata = user?.user_metadata || {};
  for (const value of [
    google.avatar_url,
    google.picture,
    metadata.avatar_url,
    metadata.picture,
  ]) {
    try {
      const url = new URL(value);
      if (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        (url.hostname === "googleusercontent.com" ||
          url.hostname.endsWith(".googleusercontent.com"))
      )
        return url.href;
    } catch {
      /* A missing or invalid photo falls back to initials. */
    }
  }
  return "";
}
