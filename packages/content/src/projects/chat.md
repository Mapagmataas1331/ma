---
slug: chat
title: chat.ma.cyou
titleRu: chat.ma.cyou
tags:
  - React
  - Go
  - WebRTC
  - libsodium
year: 2026
status: active
context: own
featured: true
summary: Invite-only messenger for direct and small group chats. Messages and files are encrypted in the browser before they leave the device.
summaryRu: Мессенджер по приглашению для личных и небольших групповых чатов. Сообщения и файлы шифруются в браузере до отправки.
links:
  - label: chat.ma.cyou
    href: https://chat.ma.cyou
    kind: live
  - label: GitHub
    href: https://github.com/Mapagmataas1331/ma
    kind: github
  - label: Architecture notes
    labelRu: Заметки об архитектуре
    href: https://github.com/Mapagmataas1331/ma/blob/main/docs/ARCHITECTURE.md
    kind: writeup
  - label: Threat model
    labelRu: Модель угроз
    href: https://github.com/Mapagmataas1331/ma/blob/main/docs/THREAT_MODEL.md
    kind: writeup
images:
  - src: /shots/chat/signin-dark.webp
    width: 1440
    height: 900
    alt: chat.ma.cyou sign-in screen in the dark theme
    altRu: Экран входа chat.ma.cyou в тёмной теме
    caption: Sign-in, dark theme
    captionRu: Вход, тёмная тема
    source: live site, captured Oct 2026
  - src: /shots/chat/architecture.svg
    width: 1600
    height: 900
    alt: "Diagram: two browsers linked by an encrypted WebRTC data channel, with a Go API for signaling and mailbox, PostgreSQL, coturn and Cloudflare Workers"
    altRu: "Схема: два браузера, связанные зашифрованным каналом WebRTC, Go API для сигналинга и почтового ящика, PostgreSQL, coturn и Cloudflare Workers"
    caption: Architecture
    captionRu: Архитектура
    source: diagram drawn from docs/ARCHITECTURE.md
  - src: /shots/chat/signin-light.webp
    width: 1440
    height: 900
    alt: chat.ma.cyou sign-in screen in the light theme
    altRu: Экран входа chat.ma.cyou в светлой теме
    caption: Sign-in, light theme
    captionRu: Вход, светлая тема
    source: live site, captured Oct 2026
---
