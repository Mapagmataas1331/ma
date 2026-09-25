package server

import "encoding/json"

func decodeJSON(b []byte, v any) error {
	return json.Unmarshal(b, v)
}
