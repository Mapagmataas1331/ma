package auth

import "testing"

func TestHashAndVerify(t *testing.T) {
	if err := ValidatePassword("short"); err == nil {
		t.Fatal("expected short password to fail")
	}
	if err := ValidatePassword("password123"); err == nil {
		t.Fatal("expected common password to fail")
	}
	hash, err := HashPassword("correct horse battery")
	if err != nil {
		t.Fatal(err)
	}
	if !VerifyPassword(hash, "correct horse battery") {
		t.Fatal("expected match")
	}
	if VerifyPassword(hash, "wrong password!!") {
		t.Fatal("expected mismatch")
	}
}
