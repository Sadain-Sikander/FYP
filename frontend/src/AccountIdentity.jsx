import React, { useState } from "react";
import { accountName, accountPhoto } from "./accountIdentity";
import "./account-flow.css";

export default function AccountIdentity({ user, showName = true }) {
  const name = accountName(user);
  const photo = accountPhoto(user);
  const [failed, setFailed] = useState("");
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => Array.from(part)[0])
      .join("")
      .toUpperCase() || "?";
  return (
    <span className="account-identity">
      <span className="account-avatar" aria-hidden="true">
        {photo && failed !== photo ? (
          <img
            src={photo}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setFailed(photo)}
          />
        ) : (
          initials
        )}
      </span>
      {showName && (
        <span className="account-display-name">{name || "Your account"}</span>
      )}
    </span>
  );
}
