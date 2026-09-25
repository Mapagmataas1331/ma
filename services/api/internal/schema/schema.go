package schema

import "embed"

//go:embed migrations/*.sql
var Files embed.FS

func FS() embed.FS { return Files }
