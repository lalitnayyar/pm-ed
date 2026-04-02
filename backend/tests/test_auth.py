"""Tests for authentication: password hashing and session tokens."""

import pytest

from app.auth import create_token, hash_password, verify_password


class TestPasswordHashing:
    def test_hash_is_not_plaintext(self) -> None:
        pw = "supersecret"
        hashed = hash_password(pw)
        assert pw not in hashed

    def test_hash_contains_salt_and_dk(self) -> None:
        hashed = hash_password("pw")
        parts = hashed.split(":")
        assert len(parts) == 2
        salt, dk = parts
        assert len(salt) == 32  # 16 bytes hex
        assert len(dk) == 64   # 32 bytes sha256 hex

    def test_verify_correct_password(self) -> None:
        pw = "correct-horse-battery-staple"
        hashed = hash_password(pw)
        assert verify_password(pw, hashed) is True

    def test_verify_wrong_password(self) -> None:
        hashed = hash_password("right")
        assert verify_password("wrong", hashed) is False

    def test_two_hashes_of_same_password_are_different(self) -> None:
        pw = "same"
        assert hash_password(pw) != hash_password(pw)

    def test_verify_invalid_hash_format(self) -> None:
        assert verify_password("pw", "notvalid") is False

    def test_verify_empty_string_password(self) -> None:
        hashed = hash_password("")
        assert verify_password("", hashed) is True
        assert verify_password("x", hashed) is False


class TestTokenCreation:
    def test_token_is_string(self) -> None:
        assert isinstance(create_token(), str)

    def test_token_has_reasonable_length(self) -> None:
        token = create_token()
        assert len(token) >= 32

    def test_tokens_are_unique(self) -> None:
        tokens = {create_token() for _ in range(100)}
        assert len(tokens) == 100
