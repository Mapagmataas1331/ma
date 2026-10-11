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
context: own
featured: false
summary: Go control plane for an Oracle Cloud host, with Caddy terminating TLS and routing HTTP, TCP, and UDP.
summaryRu: Панель на Go для хоста в Oracle Cloud: Caddy завершает TLS и маршрутизирует HTTP, TCP и UDP.
links: []
images:
  - src: /shots/reverse-proxy/architecture.svg
    width: 1600
    height: 900
    alt: "Diagram: Caddy on an Oracle Cloud VM in front of a Go control plane, PostgreSQL with TimescaleDB and a cloud Minecraft server, with failover to a home server and a home gateway over a private tunnel"
    altRu: "Схема: Caddy на ВМ Oracle Cloud перед панелью на Go, PostgreSQL с TimescaleDB и облачным сервером Minecraft, с переключением на домашний сервер и домашний шлюз через приватный туннель"
    caption: Architecture
    captionRu: Архитектура
    source: diagram drawn from the project README and deployment files
---
