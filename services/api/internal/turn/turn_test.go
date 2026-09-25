package turn

import "testing"

func TestCredentialsStable(t *testing.T) {
	u1, c1, _ := Credentials("secret", "user", nil, 0)
	u2, c2, _ := Credentials("secret", "user", nil, 0)
	if u1 != u2 || c1 != c2 {
		t.Fatalf("expected stable hmac for same second, got %s %s vs %s %s", u1, c1, u2, c2)
	}
	if c1 == "" {
		t.Fatal("empty credential")
	}
}
