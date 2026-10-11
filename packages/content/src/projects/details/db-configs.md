---
features:
  - Pick a PostgreSQL source from configuration, then browse its tables in one interface
  - Allowed edits without a direct database connection or a desktop client
  - A protected edit mode, so changes are deliberate
  - Server-side sessions with undo of the latest changes in that session
  - Sign-in through Keycloak (OIDC), with JWT checks and roles on the API
  - Deployed as a React SPA and a FastAPI service under Uvicorn, systemd and Nginx
featuresRu:
  - Выбор источника PostgreSQL из конфигурации и просмотр его таблиц в одном интерфейсе
  - Разрешённые правки без прямого подключения к базе и без десктопного клиента
  - Защищённый режим правок, чтобы изменения были осознанными
  - Серверные сессии и откат последних изменений в рамках сессии
  - Вход через Keycloak (OIDC), проверка JWT и ролей на API
  - React SPA и FastAPI под Uvicorn, systemd и Nginx
stack:
  - PostgreSQL
  - FastAPI
  - Python
  - React
  - Keycloak (OIDC)
  - JWT
  - Uvicorn
  - systemd
  - Nginx
---

## The problem

The data sits in several PostgreSQL databases. People who need to browse or adjust it shouldn't need a direct database connection, a desktop client, or the risk of an unguarded `UPDATE`.

## How it works

A single interface routes queries to multiple PostgreSQL sources defined in configuration. Operators pick a source, browse tables and apply only the edits they're allowed to make. Edits happen in a protected mode inside a server-side session, so the latest changes in that session can be rolled back. Authentication goes through Keycloak OIDC, and the API checks the JWT and its roles before any protected operation.

## Stack and why

- **FastAPI.** A typed Python API between the browser and the databases, so users never connect to a database directly.
- **React SPA.** Fast table browsing and an explicit edit mode.
- **Keycloak (OIDC) and JWT roles.** Single sign-on, with access decided per role on the API.
- **Uvicorn, systemd and Nginx.** A plain Linux deployment that is easy to restart, log and update.

## Status

An internal work tool in use. The source is private, so there are no public links.

<!-- ru -->

## Задача

Данные лежат в нескольких базах PostgreSQL. Тем, кому нужно их посмотреть или поправить, не должны требоваться прямое подключение к базе, десктопный клиент и риск случайного `UPDATE`.

## Как это работает

Один интерфейс отправляет запросы в несколько баз PostgreSQL, описанных в конфигурации. Пользователь выбирает источник, смотрит таблицы и вносит только разрешённые правки. Правки идут в защищённом режиме внутри серверной сессии, поэтому последние изменения сессии можно откатить. Вход через Keycloak OIDC, а API проверяет JWT и роли перед любой защищённой операцией.

## Стек и почему

- **FastAPI.** Типизированный API на Python между браузером и базами — пользователи не подключаются к базе напрямую.
- **React SPA.** Быстрый просмотр таблиц и явный режим правок.
- **Keycloak (OIDC) и роли в JWT.** Единый вход и доступ по ролям на API.
- **Uvicorn, systemd и Nginx.** Простое развёртывание на Linux, которое легко перезапускать, смотреть логи и обновлять.

## Статус

Внутренний рабочий инструмент, используется. Исходники закрыты, поэтому публичных ссылок нет.
