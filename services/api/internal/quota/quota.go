package quota

import "errors"

var ErrUser = errors.New("quota_user")
var ErrGlobal = errors.New("quota_global")
var ErrDisk = errors.New("quota_disk")
var ErrTooLarge = errors.New("too_large")

type Limits struct {
	MaxFileBytes     int64
	MaxMessageBytes  int64
	UserQuotaBytes   int64
	GlobalQuotaBytes int64
	MinFreeBytes     int64
}

func (l Limits) CheckMessage(size int64) error {
	if size > l.MaxMessageBytes {
		return ErrTooLarge
	}
	return nil
}

func EnoughFree(free, total uint64, min float64) bool {
	if total == 0 {
		return true
	}
	return float64(free)/float64(total) >= min
}

func (l Limits) CheckFile(size, userUsed, globalUsed int64, diskFree uint64) error {
	if size > l.MaxFileBytes {
		return ErrTooLarge
	}
	if l.MinFreeBytes > 0 && diskFree < uint64(l.MinFreeBytes) {
		return ErrDisk
	}
	if userUsed+size > l.UserQuotaBytes {
		return ErrUser
	}
	if globalUsed+size > l.GlobalQuotaBytes {
		return ErrGlobal
	}
	return nil
}
