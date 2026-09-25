package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/mapagmataas1331/ma/services/api/internal/auth"
	"github.com/mapagmataas1331/ma/services/api/internal/config"
	"github.com/mapagmataas1331/ma/services/api/internal/store"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("usage: admin invite create | user reset-password <name> | user disable <name> | device revoke <id> | stats")
		os.Exit(2)
	}
	cfg := config.Load()
	ctx := context.Background()
	db, err := store.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		panic(err)
	}
	defer db.Pool.Close()
	switch os.Args[1] {
	case "invite":
		fs := flag.NewFlagSet("invite", flag.ExitOnError)
		uses := fs.Int("uses", 1, "max uses")
		exp := fs.Duration("expires", 7*24*time.Hour, "lifetime")
		_ = fs.Parse(os.Args[3:])
		raw := make([]byte, 18)
		_, _ = rand.Read(raw)
		code := base64.RawURLEncoding.EncodeToString(raw)
		sum := sha256.Sum256([]byte(code))
		if err := db.CreateInvite(ctx, sum[:], *uses, time.Now().Add(*exp)); err != nil {
			panic(err)
		}
		fmt.Println(code)
	case "user":
		if len(os.Args) < 4 {
			os.Exit(2)
		}
		switch os.Args[2] {
		case "reset-password":
			pw := make([]byte, 12)
			_, _ = rand.Read(pw)
			plain := base64.RawURLEncoding.EncodeToString(pw)
			hash, err := auth.HashPassword(plain + "Aa1")
			if err != nil {
				panic(err)
			}
			u, err := db.UserByName(ctx, os.Args[3])
			if err != nil {
				panic(err)
			}
			if err := db.SetPassword(ctx, u.ID, hash); err != nil {
				panic(err)
			}
			fmt.Println(plain + "Aa1")
		case "disable":
			if err := db.DisableUser(ctx, os.Args[3]); err != nil {
				panic(err)
			}
		default:
			os.Exit(2)
		}
	case "device":
		id, err := uuid.Parse(os.Args[3])
		if err != nil {
			panic(err)
		}
		if err := db.RevokeDevice(ctx, id); err != nil {
			panic(err)
		}
	case "stats":
		var users, messages int
		_ = db.Pool.QueryRow(ctx, `SELECT count(*) FROM users`).Scan(&users)
		_ = db.Pool.QueryRow(ctx, `SELECT count(*) FROM mailbox_messages`).Scan(&messages)
		fmt.Printf("users=%d mailbox_messages=%d\n", users, messages)
	default:
		os.Exit(2)
	}
}
