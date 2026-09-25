//go:build windows

package server

import "golang.org/x/sys/windows"

func diskUsage(path string) (free, total uint64) {
	p, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return 0, 0
	}
	var avail, tot, freeBytes uint64
	if err = windows.GetDiskFreeSpaceEx(p, &avail, &tot, &freeBytes); err != nil {
		return 0, 0
	}
	return avail, tot
}
