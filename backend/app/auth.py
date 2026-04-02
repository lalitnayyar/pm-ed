"""Authentication utilities: password hashing and session token management."""

import hashlib
import secrets


def hash_password(password: str) -> str:
    """Hash a password with PBKDF2-HMAC-SHA256 and a random salt."""
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000)
    return f"{salt}:{dk.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify a plaintext password against a stored hash."""
    parts = stored_hash.split(":")
    if len(parts) != 2:
        return False
    salt, dk_hex = parts
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000)
    return secrets.compare_digest(dk.hex(), dk_hex)


def create_token() -> str:
    """Generate a cryptographically secure session token."""
    return secrets.token_urlsafe(32)
