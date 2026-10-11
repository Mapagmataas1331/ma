---
features:
  - Material cards with category, unit, minimum stock and a comment; archived instead of deleted
  - One material across several warehouses or bins, with the total calculated automatically
  - Receipts with quantity, cost, supplier and location, plus issues and transfers between locations
  - Stock can never go below zero, even when several people issue the same item at once
  - An automatic list of items below their minimum or at zero, with print and CSV export
  - An operations journal with user, type, quantity, location, supplier and the balance after each entry
  - Admin and user roles; a disabled account keeps its history; passwords hashed with Argon2id
  - Works on a desktop, tablet or phone, in light and dark themes
featuresRu:
  - Карточки материалов с категорией, единицей, минимальным остатком и комментарием; архив вместо удаления
  - Один материал на нескольких складах или ячейках, общий остаток считается автоматически
  - Поступления с количеством, стоимостью, поставщиком и местом, списания и перемещения между местами
  - Остаток не уходит в минус, даже если несколько человек списывают одно и то же одновременно
  - Автоматический список позиций ниже минимума или с нулевым остатком, печать и выгрузка CSV
  - Журнал операций с пользователем, типом, количеством, местом, поставщиком и остатком после операции
  - Роли администратора и пользователя; отключённая учётка сохраняет историю; пароли в Argon2id
  - Удобно с ПК, планшета и телефона, светлая и тёмная тема
stack:
  - Next.js
  - React
  - TypeScript
  - PostgreSQL 16
  - Drizzle ORM
  - Auth.js
  - Argon2id
  - shadcn/ui
  - Tailwind CSS
  - Docker Compose
  - nginx
---

## The problem

I built this as a freelance project for Exomaterial. Its production needs to know what materials it has, where they are, and what to buy next. Spreadsheets and paper logs drift out of date as soon as two people work at once.

## How it works

One Next.js app holds both the interface and the server code (server actions on top of a small service layer), next to PostgreSQL. It runs on the client's own server and is used from the local network, so it needs no internet access.

Every receipt, issue and transfer runs in a database transaction. An issue lowers stock with one conditional update that succeeds only while enough is left, adjustments lock the stock row first, and a database check keeps every quantity at zero or above. Two people can't issue the same last item twice. The purchase list is computed from current stock and each material's minimum. Material search uses trigram indexes in PostgreSQL.

There is no public registration. The first administrator is created with a command-line script inside the container, and everyone else is added in the Users section.

## Stack and why

- **Next.js, React and TypeScript.** UI and server in one project, so it ships as one container.
- **PostgreSQL 16 and Drizzle ORM.** Typed schema and SQL migrations that apply on container start.
- **Auth.js with Argon2id.** Sessions and password hashing without an external identity service.
- **shadcn/ui and Tailwind CSS.** A responsive interface with light and dark themes.
- **Docker Compose.** `db`, `app` and an optional `proxy` (nginx with HTTPS), switched with one `COMPOSE_PROFILES` setting.

## Status

In active development as client work for Exomaterial; the source is public on my GitHub. It deploys with `docker compose up -d --build`, and backups are a `pg_dump` of the database.

<!-- ru -->

## Задача

Я сделал эту систему на фрилансе для компании Exomaterial. Её производству нужно знать, какие материалы есть, где они лежат и что пора закупать. Таблицы и бумажные журналы устаревают, как только с ними работают двое одновременно.

## Как это работает

Одно приложение на Next.js содержит и интерфейс, и серверный код (server actions поверх небольшого слоя сервисов), рядом PostgreSQL. Оно разворачивается на собственном сервере заказчика и открывается из локальной сети — интернет не нужен.

Каждое поступление, списание и перемещение выполняется в транзакции. Списание уменьшает остаток одним условным обновлением, которое проходит, только пока хватает количества; корректировки сначала блокируют строку остатка, а проверка в базе не даёт количеству уйти ниже нуля. Двое не спишут одну и ту же последнюю позицию дважды. Список закупки считается из текущих остатков и минимума каждого материала. Поиск по названию использует триграммные индексы PostgreSQL.

Публичной регистрации нет. Первый администратор создаётся скриптом в контейнере, остальные — в разделе «Пользователи».

## Стек и почему

- **Next.js, React и TypeScript.** Интерфейс и сервер в одном проекте, поставляется одним контейнером.
- **PostgreSQL 16 и Drizzle ORM.** Типизированная схема и SQL-миграции, которые применяются при старте контейнера.
- **Auth.js и Argon2id.** Сессии и хеширование паролей без внешнего сервиса учёток.
- **shadcn/ui и Tailwind CSS.** Адаптивный интерфейс со светлой и тёмной темой.
- **Docker Compose.** `db`, `app` и опциональный `proxy` (nginx с HTTPS), переключаются одной настройкой `COMPOSE_PROFILES`.

## Статус

В активной разработке как заказ для Exomaterial; исходный код открыт на моём GitHub. Разворачивается командой `docker compose up -d --build`, резервная копия — `pg_dump` базы.
