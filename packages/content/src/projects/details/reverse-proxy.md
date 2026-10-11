---
features:
  - Caddy is the only public entry point, for HTTP(S), Minecraft over TCP and voice chat over UDP
  - The Go API listens on localhost only, and Caddy forwards raw TCP and UDP
  - Cloud-first routing with automatic failover to a home server when the cloud one is down
  - Home-hosted projects published through a private tunnel without exposing the home IP
  - JWT access tokens, HTTP-only refresh tokens, roles and a forced password change on first login
  - Request logs and CPU, memory, disk and network metrics in TimescaleDB, compressed and kept for 30 days
  - systemd units, a Caddyfile and a deployment script for the Oracle Cloud Free Tier VM
featuresRu:
  - Caddy — единственная точка входа снаружи для HTTP(S), Minecraft по TCP и голосового чата по UDP
  - Go API слушает только localhost, а Caddy пробрасывает TCP и UDP как есть
  - Маршрутизация сначала в облако и автоматическое переключение на домашний сервер, если облачный недоступен
  - Домашние проекты публикуются через приватный туннель, домашний IP не раскрывается
  - JWT-токены доступа, HTTP-only refresh-токены, роли и обязательная смена пароля при первом входе
  - Логи запросов и метрики CPU, памяти, диска и сети в TimescaleDB, со сжатием и хранением 30 дней
  - Юниты systemd, Caddyfile и скрипт развёртывания для ВМ Oracle Cloud Free Tier
stack:
  - Go
  - Caddy
  - PostgreSQL
  - TimescaleDB
  - React
  - shadcn/ui
  - systemd
  - Oracle Cloud (ARM64)
  - WireGuard / Tailscale
---

## The problem

One free-tier Oracle Cloud VM had to serve websites, a Minecraft server with voice chat, and projects running at home, without opening the home network to the internet and while keeping memory use low.

## How it works

Caddy is the data plane. It terminates TLS on ports 80 and 443 and forwards raw TCP (Minecraft, 25565) and UDP (voice chat, 24454). The Go control plane runs on localhost:8080 and handles sign-in, users, health checks, metrics and logs. It stores its data in PostgreSQL with TimescaleDB.

Minecraft traffic goes to the cloud server first. When health checks fail, it switches to the home server. Requests under `/proxy/*` reach a gateway on the home PC through a WireGuard or Tailscale tunnel, so the home IP never appears in public. The admin frontend is a static React build that Caddy serves, with no Node.js at runtime.

## Stack and why

- **Go.** One small binary for the control plane, kept under about 150 MB of memory.
- **Caddy.** Automatic TLS and one place for HTTP, TCP and UDP routing.
- **PostgreSQL and TimescaleDB.** Time-series storage for request logs and system metrics, with compression and a retention policy.
- **React and shadcn/ui.** A static admin frontend for users and request logs.
- **systemd on Ubuntu 24.04 ARM64.** Restart policies and journald logs on the Oracle Cloud Free Tier shape.

## Status

Personal infrastructure. Version 1.0.0 shipped in January 2026. The repository isn't public, so there's no link.

<!-- ru -->

## Задача

Одна бесплатная ВМ в Oracle Cloud должна обслуживать сайты, сервер Minecraft с голосовым чатом и проекты, запущенные дома, не открывая домашнюю сеть в интернет и не расходуя много памяти.

## Как это работает

Caddy — плоскость данных. Он завершает TLS на портах 80 и 443 и пробрасывает TCP (Minecraft, 25565) и UDP (голосовой чат, 24454) как есть. Панель на Go работает на localhost:8080 и отвечает за вход, пользователей, проверки состояния, метрики и логи. Данные хранятся в PostgreSQL с TimescaleDB.

Трафик Minecraft сначала идёт на облачный сервер. Если проверки не проходят, он переключается на домашний. Запросы на `/proxy/*` уходят на шлюз на домашнем ПК через туннель WireGuard или Tailscale, поэтому домашний IP нигде не светится. Админка — статическая сборка React, которую отдаёт Caddy, без Node.js в работе.

## Стек и почему

- **Go.** Один небольшой бинарник для панели, около 150 МБ памяти максимум.
- **Caddy.** Автоматический TLS и одно место для маршрутизации HTTP, TCP и UDP.
- **PostgreSQL и TimescaleDB.** Временные ряды для логов запросов и системных метрик, со сжатием и политикой хранения.
- **React и shadcn/ui.** Статическая админка для пользователей и логов запросов.
- **systemd на Ubuntu 24.04 ARM64.** Политики перезапуска и логи journald на бесплатной конфигурации Oracle Cloud.

## Статус

Личная инфраструктура. Версия 1.0.0 вышла в январе 2026 года. Репозиторий не публичный, поэтому ссылки нет.
