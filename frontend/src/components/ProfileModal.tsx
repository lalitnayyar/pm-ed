"use client";

import { useState, type FormEvent } from "react";
import { apiUpdateProfile, type UserProfile } from "@/lib/api";

type ProfileModalProps = {
  token: string;
  user: UserProfile;
  onClose: () => void;
  onUpdated: (user: UserProfile) => void;
};

const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const ProfileModal = ({ token, user, onClose, onUpdated }: ProfileModalProps) => {
  const [email, setEmail] = useState(user.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const payload: { email?: string; current_password?: string; new_password?: string } = {};
    if (email !== (user.email ?? "")) payload.email = email;
    if (newPassword) {
      payload.current_password = currentPassword;
      payload.new_password = newPassword;
    }

    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const updated = await apiUpdateProfile(token, payload);
      onUpdated(updated);
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={handleBackdrop}
      data-testid="profile-modal"
    >
      <div className="w-full max-w-md rounded-3xl border border-[var(--stroke)] bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg font-semibold text-[var(--navy-dark)]">Profile</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--gray-text)] hover:bg-[var(--surface)] hover:text-[var(--navy-dark)] transition-colors"
            aria-label="Close"
            data-testid="close-profile-modal"
          >
            <XIcon />
          </button>
        </div>

        <p className="mb-4 text-sm text-[var(--gray-text)]">
          Signed in as <span className="font-semibold text-[var(--navy-dark)]">{user.username}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="profile-email" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Email
            </label>
            <input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)] transition-colors"
              data-testid="profile-email-input"
            />
          </div>

          <div className="border-t border-[var(--stroke)] pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Change Password
            </p>
            <div className="space-y-3">
              <div>
                <label htmlFor="profile-current-password" className="mb-1.5 block text-xs text-[var(--gray-text)]">
                  Current password
                </label>
                <input
                  id="profile-current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)] transition-colors"
                  data-testid="profile-current-password"
                />
              </div>
              <div>
                <label htmlFor="profile-new-password" className="mb-1.5 block text-xs text-[var(--gray-text)]">
                  New password
                </label>
                <input
                  id="profile-new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  className="w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)] transition-colors"
                  data-testid="profile-new-password"
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500" role="alert" data-testid="profile-error">
              {error}
            </p>
          )}
          {success && (
            <p className="text-xs text-emerald-600" data-testid="profile-success">
              Profile updated successfully.
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold text-[var(--gray-text)] hover:text-[var(--navy-dark)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-[var(--primary-blue)] px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
              data-testid="save-profile-button"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
