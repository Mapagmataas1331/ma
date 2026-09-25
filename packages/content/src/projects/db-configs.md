---
slug: db-configs
title: db-configs
titleRu: db-configs
tags:
  - PostgreSQL
  - FastAPI
  - React
  - Nginx
year: 2024
status: active
featured: true
summary: One workspace for several PostgreSQL databases, with a guarded edit mode and session rollback.
summaryRu: Один интерфейс к нескольким базам PostgreSQL, с защищённым режимом правок и откатом сессии.
links: []
---

A single interface routes queries to multiple PostgreSQL sources from configuration. Operators browse tables and apply allowed edits without a direct database connection. Protected edit mode, server sessions, and in-session undo reduce accidental changes. Authentication goes through Keycloak OIDC with JWT role checks. The React SPA and FastAPI API are deployed behind Nginx with systemd.

<!-- ru -->

Один интерфейс отправляет запросы в несколько баз PostgreSQL по конфигурации. Можно смотреть таблицы и делать разрешённые правки без прямого подключения к базе. Защищённый режим, серверные сессии и отмена внутри сессии уменьшают случайные изменения. Вход через Keycloak OIDC и проверка ролей в JWT. React и FastAPI работают за Nginx и systemd.
