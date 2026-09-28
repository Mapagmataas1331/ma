package auth

import (
	"errors"
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/text/unicode/norm"
)

const (
	UsernameMin   = 3
	UsernameMax   = 12
	DisplayMin    = 1
	DisplayMax    = 32
	PasswordMin   = 10
	PasswordMax   = 128
	PasswordBytes = 512
	DeviceNameMax = 64
	GroupNameMax  = 64
)

func ValidateUsername(username string) error {
	value := strings.ToLower(strings.TrimSpace(username))
	if value != strings.TrimSpace(username) && username != value {
		return errors.New("username_invalid")
	}
	if len(value) < UsernameMin || len(value) > UsernameMax {
		return errors.New("username_invalid")
	}
	for i, r := range value {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
		case r == '_' && i > 0 && i < len(value)-1:
		default:
			return errors.New("username_invalid")
		}
	}
	return nil
}

func CanonicalUsername(username string) (string, error) {
	value := strings.ToLower(strings.TrimSpace(username))
	if err := ValidateUsername(value); err != nil {
		return "", err
	}
	return value, nil
}

func CanonicalDisplayName(name string) (string, error) {
	value := norm.NFC.String(strings.TrimSpace(name))
	if err := validateText(value, DisplayMin, DisplayMax); err != nil {
		return "", errors.New("display_name_invalid")
	}
	return value, nil
}

func ValidateDisplayName(name string) error {
	_, err := CanonicalDisplayName(name)
	return err
}

func ValidateDeviceName(name string) error {
	if err := validateText(strings.TrimSpace(name), 1, DeviceNameMax); err != nil {
		return errors.New("device_name_invalid")
	}
	return nil
}

func ValidateGroupName(name string) error {
	if err := validateText(strings.TrimSpace(name), 1, GroupNameMax); err != nil {
		return errors.New("group_name_invalid")
	}
	return nil
}

func validateText(value string, min, max int) error {
	if value == "" || graphemes(value) < min || graphemes(value) > max || len(value) > max*4 {
		return errors.New("invalid")
	}
	for _, r := range value {
		if r == '\n' || r == '\r' || unicode.IsControl(r) || isBidi(r) {
			return errors.New("invalid")
		}
	}
	return nil
}

func graphemes(value string) int {
	count := 0
	for _, r := range value {
		if unicode.Is(unicode.Mn, r) || r == '\u200d' || unicode.Is(unicode.Me, r) {
			continue
		}
		count++
	}
	if count == 0 {
		return utf8.RuneCountInString(value)
	}
	return count
}

func isBidi(r rune) bool {
	return r == '\u200e' || r == '\u200f' || (r >= '\u202a' && r <= '\u202e') || (r >= '\u2066' && r <= '\u2069')
}
