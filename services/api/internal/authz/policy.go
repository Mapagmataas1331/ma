package authz

import "errors"

var (
	ErrUnauthenticated = errors.New("unauthenticated")
	ErrUntrusted       = errors.New("device_untrusted")
	ErrForbidden       = errors.New("forbidden")
	ErrNotFound        = errors.New("not_found")
	ErrLastTrusted     = errors.New("last_trusted_device")
	ErrOffline         = errors.New("offline")
	ErrPlaintext       = errors.New("plaintext_rejected")
)

type DeviceAccess struct {
	HasDevice bool
	Trust     string
}

func AllowChat(access DeviceAccess) error {
	if !access.HasDevice {
		return ErrUntrusted
	}
	if access.Trust != "trusted" {
		return ErrUntrusted
	}
	return nil
}

func AllowDeviceMutation(actorTrusted, targetOwned bool, trustedCount int, targetTrusted, confirmLast bool) error {
	if !actorTrusted || !targetOwned {
		return ErrNotFound
	}
	if targetTrusted && trustedCount <= 1 && !confirmLast {
		return ErrLastTrusted
	}
	return nil
}

type SignalInput struct {
	FrameType      string
	HasTarget      bool
	SameAccount    bool
	TargetDeviceOK bool
	Blocked        bool
	Related        bool
}

func AllowSignal(in SignalInput) error {
	if in.FrameType == "ping" || in.FrameType == "pong" {
		return nil
	}
	if !in.HasTarget {
		return ErrForbidden
	}
	if in.FrameType == "chat.file.chunk" || in.FrameType == "chat.file.data" {
		return ErrPlaintext
	}
	if len(in.FrameType) >= 5 && in.FrameType[:5] == "pair." {
		if in.SameAccount && in.TargetDeviceOK {
			return nil
		}
		return ErrForbidden
	}
	if in.SameAccount && in.TargetDeviceOK {
		return nil
	}
	if in.Blocked || !in.Related {
		return ErrForbidden
	}
	return nil
}

type DeliveryInput struct {
	Found             bool
	SenderMember      bool
	RecipientMember   bool
	DirectPeerMatches bool
	Blocked           bool
}

func AllowDelivery(in DeliveryInput) error {
	if !in.Found || !in.SenderMember || !in.RecipientMember || !in.DirectPeerMatches || in.Blocked {
		return ErrForbidden
	}
	return nil
}

type KeyInput struct {
	Self     bool
	Contact  bool
	Converse bool
}

func AllowIdentityKeys(in KeyInput) error {
	if in.Self || in.Contact || in.Converse {
		return nil
	}
	return ErrNotFound
}
