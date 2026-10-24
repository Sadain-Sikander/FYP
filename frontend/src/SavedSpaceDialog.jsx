import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, LogOut } from "lucide-react";
import SavedSpace from "./SavedSpace";
import "./account-flow.css";

export default function SavedSpaceDialog({ user, onClose, signOut, ...props }) {
  const dialog = useRef(null);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => {
      if (element.open) element.close();
    };
  }, []);
  async function leaveAccount() {
    setSigningOut(true);
    setError("");
    if ((await signOut()) === false) {
      setError("Sign-out failed. Please try again.");
      setSigningOut(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="saved-dialog"
      aria-label="Your saved space"
      onClose={onClose}
    >
      <div className="saved-dialog-toolbar">
        <button className="loom-text" onClick={() => dialog.current.close()}>
          <ArrowLeft size={16} /> Back to discovery
        </button>
        <button
          className="loom-text"
          onClick={leaveAccount}
          disabled={signingOut}
        >
          <LogOut size={16} /> Sign out
        </button>
      </div>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      <p className="saved-account-name">
        {user.user_metadata?.display_name ||
          user.user_metadata?.full_name ||
          user.email}
      </p>
      <SavedSpace user={user} {...props} />
      <p className="saved-privacy-note">
        Only you can access your saved work. Profiles, careers and roadmaps are
        saved when you choose Save. Original resume files stay out of your
        account.
      </p>
    </dialog>
  );
}
