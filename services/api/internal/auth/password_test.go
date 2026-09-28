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

func TestAccountNames(t *testing.T) {
	if _, err := CanonicalUsername("Ab_c"); err != nil {
		t.Fatal(err)
	}
	if _, err := CanonicalUsername("_ab"); err == nil {
		t.Fatal("expected leading underscore to fail")
	}
	name, err := CanonicalDisplayName("  Cafe\u0301 ")
	if err != nil || name == "" {
		t.Fatal(err)
	}
	if err := ValidateDisplayName("bad\nname"); err == nil {
		t.Fatal("expected line break to fail")
	}
	if err := ValidateGroupName(""); err == nil {
		t.Fatal("expected empty group name to fail")
	}
}
