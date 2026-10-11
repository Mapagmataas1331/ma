---
features:
  - Accounts by invite only; a separate vault password protects chats on each device and never reaches the server
  - Text and files are encrypted in the browser with libsodium before they leave the device
  - Direct chats and groups of up to 20 members, with one encrypted envelope per member
  - When people are online, text and files go directly between browsers over WebRTC
  - Offline delivery through a short-lived encrypted mailbox, removed after 24 hours or once everyone has it
  - History stays on each device, field-encrypted in IndexedDB, with file ciphertext in OPFS
  - Moving to a new device uses a short pairing code and a direct WebRTC transfer of keys and history
  - Installs as a PWA, in English and Russian
featuresRu:
  - Аккаунты только по приглашению; отдельный пароль сейфа защищает чаты на каждом устройстве и не уходит на сервер
  - Текст и файлы шифруются в браузере через libsodium до отправки
  - Личные чаты и группы до 20 участников, по одному зашифрованному конверту на каждого
  - Когда люди в сети, текст и файлы идут напрямую между браузерами по WebRTC
  - Доставка офлайн через временный зашифрованный ящик, который очищается через 24 часа или когда все получили файл
  - История хранится на каждом устройстве: поля зашифрованы в IndexedDB, шифротекст файлов — в OPFS
  - Переезд на новое устройство — короткий код сопряжения и прямая передача ключей и истории по WebRTC
  - Устанавливается как PWA, на русском и английском
stack:
  - React 19
  - TypeScript
  - Vite
  - libsodium
  - WebRTC
  - IndexedDB / OPFS
  - Go
  - PostgreSQL 16
  - WebSocket
  - coturn
  - Cloudflare Workers
  - nginx
---

## The problem

A small circle of people wants to chat and share files of any size without trusting a server with what they say. Big messengers either see the content or cap file sizes.

## How it works

Accounts are created with an invite. Each device has a vault: identity keys and history live in IndexedDB, encrypted under a key derived with Argon2id from a vault password that never leaves the browser. Every message is encrypted to the recipients' identity keys with libsodium before it is sent. Groups get one envelope per member, with no shared group key.

When people are online, the Go API only relays WebRTC signaling over a WebSocket, and text and files travel directly between browsers. Files stream in 64 KB encrypted chunks with backpressure, so their size is limited only by storage. When someone is offline, small messages and files wait in a temporary encrypted mailbox on the API: one ciphertext per file, counted against a 5 GB budget for the sender. A TURN relay (coturn) covers networks where a direct connection fails.

## Stack and why

- **React 19, TypeScript and Vite.** The same toolchain as the rest of ma.cyou, with the chat as an installable PWA.
- **libsodium.** Argon2id, X25519 and XChaCha20-Poly1305 from one well-known library, run in the browser.
- **WebRTC data channels.** The server never carries online traffic, so there's no cap on file size.
- **Go and PostgreSQL 16.** One small process for REST, WebSocket signaling, presence and the mailbox. PostgreSQL holds accounts, devices, contacts and mailbox metadata, and there's no Redis.
- **Cloudflare Workers, nginx and coturn.** Static frontend at the edge; the API and TURN run on an Oracle Cloud ARM host.

## Status

Live at chat.ma.cyou for invited users. The threat model is public: v1 isn't anonymous and has no forward secrecy, and a server compromise exposes metadata but not message bodies or files.

<!-- ru -->

## Задача

Небольшому кругу людей нужно переписываться и пересылать файлы любого размера, не доверяя серверу содержимое. Крупные мессенджеры либо видят переписку, либо ограничивают размер файлов.

## Как это работает

Аккаунт создаётся по приглашению. На каждом устройстве есть сейф: ключи и история лежат в IndexedDB и зашифрованы ключом, который выводится через Argon2id из пароля сейфа. Этот пароль не покидает браузер. Каждое сообщение шифруется через libsodium на ключи получателей до отправки. В группах — отдельный конверт для каждого участника, без общего группового ключа.

Когда люди в сети, Go API только передаёт сигналинг WebRTC через WebSocket, а текст и файлы идут напрямую между браузерами. Файлы передаются зашифрованными блоками по 64 КБ с учётом скорости получателя, так что размер ограничен только хранилищем. Если кто-то не в сети, небольшие сообщения и файлы ждут во временном зашифрованном ящике на API: один шифротекст на файл, в пределах 5 ГБ на отправителя. Ретранслятор TURN (coturn) выручает там, где прямое соединение не получается.

## Стек и почему

- **React 19, TypeScript и Vite.** Тот же инструментарий, что и у остального ma.cyou; чат устанавливается как PWA.
- **libsodium.** Argon2id, X25519 и XChaCha20-Poly1305 из одной известной библиотеки, прямо в браузере.
- **Каналы данных WebRTC.** Сервер не передаёт трафик онлайн, поэтому размер файлов не ограничен.
- **Go и PostgreSQL 16.** Один небольшой процесс для REST, сигналинга по WebSocket, присутствия и почтового ящика. В PostgreSQL — аккаунты, устройства, контакты и метаданные ящика, Redis нет.
- **Cloudflare Workers, nginx и coturn.** Статика на edge, API и TURN — на ARM-сервере в Oracle Cloud.

## Статус

Работает на chat.ma.cyou для приглашённых. Модель угроз открыта: v1 не анонимен и не даёт forward secrecy, а взлом сервера раскрывает метаданные, но не тексты сообщений и не файлы.
