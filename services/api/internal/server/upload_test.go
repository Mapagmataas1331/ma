package server

import (
	"errors"
	"io"
	"mime/multipart"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestUploadAborted(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/", nil)
	cases := []struct {
		name string
		err  error
		want bool
	}{
		{"nil", nil, false},
		{"eof", io.EOF, true},
		{"unexpectedEOF", io.ErrUnexpectedEOF, true},
		{"netClosed", net.ErrClosed, true},
		{"opError", &net.OpError{Op: "read", Err: errors.New("wsarecv: forcibly closed")}, true},
		{"multipartTooLarge", multipart.ErrMessageTooLarge, false},
		{"other", errors.New("disk full"), false},
	}
	for _, tc := range cases {
		if got := uploadAborted(req, tc.err); got != tc.want {
			t.Fatalf("%s: got %v want %v", tc.name, got, tc.want)
		}
	}
}

func TestWriteUploadParseErrorMessages(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/", nil)
	writeUploadParseError(rec, req, errors.New("something opaque"))
	if rec.Code != 400 {
		t.Fatalf("status %d", rec.Code)
	}
	body := rec.Body.String()
	if strings.Contains(body, `"multipart"`) && !strings.Contains(body, "could not read the upload") {
		t.Fatalf("raw multipart toast leaked: %s", body)
	}
	if !strings.Contains(body, "could not read the upload") {
		t.Fatalf("body=%s", body)
	}

	rec = httptest.NewRecorder()
	writeUploadParseError(rec, req, multipart.ErrMessageTooLarge)
	if rec.Code != 413 {
		t.Fatalf("too large status %d body %s", rec.Code, rec.Body.String())
	}
}

func TestStreamMailboxMultipartPast32MiB(t *testing.T) {
	// Build a multipart body larger than ParseMultipartForm's old 32 MiB memory spill point
	// and ensure MultipartReader can consume it with a 1 MiB copy buffer into a sink.
	const fileSize = 33 << 20
	pr, pw := io.Pipe()
	mw := multipart.NewWriter(pw)
	go func() {
		defer pw.Close()
		_ = mw.WriteField("conversation_id", "00000000-0000-0000-0000-000000000001")
		_ = mw.WriteField("file_id", "00000000-0000-0000-0000-000000000002")
		_ = mw.WriteField("envelope", "eyJhbGciOiJzZWNyZXRzdHJlYW0ifQ") // dummy
		_ = mw.WriteField("recipient_user_id", "00000000-0000-0000-0000-000000000003")
		part, err := mw.CreateFormFile("file", "big.bin")
		if err != nil {
			_ = pw.CloseWithError(err)
			return
		}
		buf := make([]byte, 1<<20)
		var left = fileSize
		for left > 0 {
			n := len(buf)
			if left < n {
				n = left
			}
			if _, err := part.Write(buf[:n]); err != nil {
				_ = pw.CloseWithError(err)
				return
			}
			left -= n
		}
		_ = mw.Close()
	}()

	mr := multipart.NewReader(pr, mw.Boundary())
	var sawFile bool
	var size int64
	copyBuf := make([]byte, 1<<20)
	for {
		part, err := mr.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatal(err)
		}
		if part.FormName() == "file" {
			sawFile = true
			n, err := io.CopyBuffer(io.Discard, part, copyBuf)
			if err != nil {
				t.Fatal(err)
			}
			size = n
		} else {
			_, _ = io.Copy(io.Discard, part)
		}
		_ = part.Close()
	}
	if !sawFile {
		t.Fatal("missing file part")
	}
	if size != fileSize {
		t.Fatalf("size=%d want %d", size, fileSize)
	}
}
