import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProfileModal } from "@/components/ProfileModal";
import type { UserProfile } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    apiUpdateProfile: vi.fn(),
  };
});

import { apiUpdateProfile } from "@/lib/api";
const mockApiUpdateProfile = apiUpdateProfile as ReturnType<typeof vi.fn>;

const mockUser: UserProfile = {
  id: 1,
  username: "testuser",
  email: "test@example.com",
  created_at: "2026-01-01T00:00:00Z",
};

describe("ProfileModal", () => {
  const onClose = vi.fn();
  const onUpdated = vi.fn();
  const token = "tok-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders username and pre-fills email", () => {
    render(<ProfileModal token={token} user={mockUser} onClose={onClose} onUpdated={onUpdated} />);
    expect(screen.getByText("testuser")).toBeInTheDocument();
    expect(screen.getByTestId("profile-email-input")).toHaveValue("test@example.com");
  });

  it("calls onClose when cancel is clicked", async () => {
    render(<ProfileModal token={token} user={mockUser} onClose={onClose} onUpdated={onUpdated} />);
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when X button is clicked", async () => {
    render(<ProfileModal token={token} user={mockUser} onClose={onClose} onUpdated={onUpdated} />);
    await userEvent.click(screen.getByTestId("close-profile-modal"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when backdrop is clicked", async () => {
    render(<ProfileModal token={token} user={mockUser} onClose={onClose} onUpdated={onUpdated} />);
    await userEvent.click(screen.getByTestId("profile-modal"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose without API call when nothing changed", async () => {
    render(<ProfileModal token={token} user={mockUser} onClose={onClose} onUpdated={onUpdated} />);
    await userEvent.click(screen.getByTestId("save-profile-button"));
    expect(mockApiUpdateProfile).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("updates email successfully", async () => {
    const updatedUser = { ...mockUser, email: "new@example.com" };
    mockApiUpdateProfile.mockResolvedValueOnce(updatedUser);

    render(<ProfileModal token={token} user={mockUser} onClose={onClose} onUpdated={onUpdated} />);
    fireEvent.change(screen.getByTestId("profile-email-input"), { target: { value: "new@example.com" } });
    await userEvent.click(screen.getByTestId("save-profile-button"));

    await waitFor(() => {
      expect(mockApiUpdateProfile).toHaveBeenCalledWith(token, expect.objectContaining({ email: "new@example.com" }));
      expect(onUpdated).toHaveBeenCalledWith(updatedUser);
      expect(screen.getByTestId("profile-success")).toBeInTheDocument();
    });
  });

  it("shows error message on API failure", async () => {
    mockApiUpdateProfile.mockRejectedValueOnce(new Error("Email already in use"));

    render(<ProfileModal token={token} user={mockUser} onClose={onClose} onUpdated={onUpdated} />);
    fireEvent.change(screen.getByTestId("profile-email-input"), { target: { value: "taken@example.com" } });
    await userEvent.click(screen.getByTestId("save-profile-button"));

    await waitFor(() => {
      expect(screen.getByTestId("profile-error")).toHaveTextContent("Email already in use");
    });
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it("sends password fields when new password provided", async () => {
    mockApiUpdateProfile.mockResolvedValueOnce(mockUser);

    render(<ProfileModal token={token} user={mockUser} onClose={onClose} onUpdated={onUpdated} />);
    fireEvent.change(screen.getByTestId("profile-current-password"), { target: { value: "oldpass1" } });
    fireEvent.change(screen.getByTestId("profile-new-password"), { target: { value: "newpass1" } });
    await userEvent.click(screen.getByTestId("save-profile-button"));

    await waitFor(() => {
      expect(mockApiUpdateProfile).toHaveBeenCalledWith(token, {
        current_password: "oldpass1",
        new_password: "newpass1",
      });
    });
  });
});
