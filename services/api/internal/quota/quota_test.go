package quota

import "testing"

func TestCheckFile(t *testing.T) {
	l := Limits{MaxFileBytes: 100, UserQuotaBytes: 150, GlobalQuotaBytes: 200, MinFreeBytes: 50}
	if err := l.CheckFile(40, 120, 0, 1000); err != ErrUser {
		t.Fatalf("user: %v", err)
	}
	if err := l.CheckFile(10, 0, 195, 1000); err != ErrGlobal {
		t.Fatalf("global: %v", err)
	}
	if err := l.CheckFile(10, 0, 0, 10); err != ErrDisk {
		t.Fatalf("disk: %v", err)
	}
	if err := l.CheckFile(101, 0, 0, 1000); err != ErrTooLarge {
		t.Fatalf("size: %v", err)
	}
	if err := l.CheckFile(10, 0, 0, 1000); err != nil {
		t.Fatal(err)
	}
	if EnoughFree(10, 100, 0.20) {
		t.Fatal("expected the disk to look full")
	}
	if !EnoughFree(20, 100, 0.20) || !EnoughFree(0, 0, 0.20) {
		t.Fatal("expected enough free space")
	}
}
