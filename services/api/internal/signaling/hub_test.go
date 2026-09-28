package signaling

import (
	"context"
	"testing"

	"github.com/google/uuid"
)

func TestRelayMissingDeviceIsOffline(t *testing.T) {
	h := New()
	err := h.Relay(context.Background(), uuid.New(), uuid.New(), Frame{V: 1, T: "rtc.offer", To: &Target{User: uuid.NewString(), Device: uuid.NewString()}, P: map[string]any{}})
	if !IsOffline(err) {
		t.Fatalf("expected offline, got %v", err)
	}
}
