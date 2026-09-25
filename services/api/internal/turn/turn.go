package turn

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"fmt"
	"time"
)

func Credentials(secret, userID string, urls []string, ttl time.Duration) (username, credential string, expiry int64) {
	expiry = time.Now().Add(ttl).Unix()
	username = fmt.Sprintf("%d:%s", expiry, userID)
	mac := hmac.New(sha1.New, []byte(secret))
	_, _ = mac.Write([]byte(username))
	credential = base64.StdEncoding.EncodeToString(mac.Sum(nil))
	return username, credential, expiry
}

func URLsOrDefault(urls []string) []string {
	if len(urls) == 0 {
		return []string{"stun:turn.ma.cyou:3478"}
	}
	return urls
}
