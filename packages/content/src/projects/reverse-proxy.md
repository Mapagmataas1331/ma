---
slug: reverse-proxy
title: Reverse proxy and control plane
titleRu: Обратный прокси и панель управления
tags:
  - Go
  - Caddy
  - TimescaleDB
  - OCI
year: 2026
status: personal
featured: false
summary: Go control plane for an Oracle Cloud host, with Caddy terminating TLS and routing HTTP, TCP, and UDP.
summaryRu: Панель на Go для хоста в Oracle Cloud: Caddy завершает TLS и маршрутизирует HTTP, TCP и UDP.
links: []
---

The control plane stores users, JWT sessions, service state, system metrics, and logs in PostgreSQL with TimescaleDB. Caddy handles TLS and protocol routing. The API stays on localhost; only the edge is public.

<!-- ru -->

Панель хранит пользователей, JWT-сессии, состояние сервисов, метрики и логи в PostgreSQL с TimescaleDB. Caddy отвечает за TLS и маршрутизацию протоколов. API остаётся на localhost, снаружи только край.
