package store

import (
	"testing"
	"time"
)

func intPtr(n int) *int { return &n }

func TestInviteTrack(t *testing.T) {
	cases := []struct {
		n    int
		tier string
		next *int
	}{
		{0, "", intPtr(1)},
		{1, "introducer", intPtr(3)},
		{3, "connector", intPtr(10)},
		{10, "host", intPtr(25)},
		{25, "circle", nil},
		{100, "circle", nil},
	}
	for _, tc := range cases {
		got := InviteTrack(tc.n)
		if got.Tier != tc.tier {
			t.Fatalf("n=%d tier=%q want %q", tc.n, got.Tier, tc.tier)
		}
		if (got.Next == nil) != (tc.next == nil) || (got.Next != nil && tc.next != nil && *got.Next != *tc.next) {
			t.Fatalf("n=%d next=%v want %v", tc.n, got.Next, tc.next)
		}
		if got.Value != tc.n || got.ID != "invites" {
			t.Fatalf("n=%d bad value/id %#v", tc.n, got)
		}
	}
}

func TestTenureTrack(t *testing.T) {
	created := time.Now().Add(-100 * 24 * time.Hour)
	got := TenureTrack(created)
	if got.Tier != "regular" || got.Next == nil || *got.Next != 365 {
		t.Fatalf("unexpected tenure track %#v", got)
	}
}

func TestContactsDevicesGroupsTracks(t *testing.T) {
	if got := ContactsTrack(5); got.Tier != "ally" || got.Next == nil || *got.Next != 15 {
		t.Fatalf("contacts %#v", got)
	}
	if got := DevicesTrack(3); got.Tier != "synced" || got.Next == nil || *got.Next != 5 {
		t.Fatalf("devices %#v", got)
	}
	if got := GroupsTrack(1); got.Tier != "member" || got.Next == nil || *got.Next != 3 {
		t.Fatalf("groups %#v", got)
	}
}
