package authz

import "testing"

func TestAllowChat(t *testing.T) {
	if err := AllowChat(DeviceAccess{HasDevice: true, Trust: "trusted"}); err != nil {
		t.Fatal(err)
	}
	for _, access := range []DeviceAccess{{}, {HasDevice: true, Trust: "pending"}, {HasDevice: true, Trust: "revoked"}} {
		if err := AllowChat(access); err == nil {
			t.Fatalf("expected denial for %+v", access)
		}
	}
}

func TestDeviceMutation(t *testing.T) {
	if err := AllowDeviceMutation(false, true, 2, true, true); err != ErrNotFound {
		t.Fatalf("foreign actor: %v", err)
	}
	if err := AllowDeviceMutation(true, false, 2, true, true); err != ErrNotFound {
		t.Fatalf("foreign target: %v", err)
	}
	if err := AllowDeviceMutation(true, true, 1, true, false); err != ErrLastTrusted {
		t.Fatalf("last device: %v", err)
	}
	if err := AllowDeviceMutation(true, true, 1, true, true); err != nil {
		t.Fatal(err)
	}
}

func TestSignalAndDelivery(t *testing.T) {
	if err := AllowSignal(SignalInput{FrameType: "chat.file.chunk", HasTarget: true, Related: true}); err != ErrPlaintext {
		t.Fatal(err)
	}
	if err := AllowSignal(SignalInput{FrameType: "rtc.offer", HasTarget: true, Blocked: true, Related: true}); err != ErrForbidden {
		t.Fatal(err)
	}
	if err := AllowSignal(SignalInput{FrameType: "pair.confirm", HasTarget: true, SameAccount: true, TargetDeviceOK: true}); err != nil {
		t.Fatal(err)
	}
	if err := AllowSignal(SignalInput{FrameType: "rtc.offer", HasTarget: true, Related: true}); err != nil {
		t.Fatal(err)
	}
	if err := AllowDelivery(DeliveryInput{Found: true, SenderMember: true, RecipientMember: true, DirectPeerMatches: false}); err != ErrForbidden {
		t.Fatal(err)
	}
	if err := AllowIdentityKeys(KeyInput{}); err != ErrNotFound {
		t.Fatal(err)
	}
	if err := AllowIdentityKeys(KeyInput{Contact: true}); err != nil {
		t.Fatal(err)
	}
}
