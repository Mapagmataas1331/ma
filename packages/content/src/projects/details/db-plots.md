---
features:
  - Pick channels and a time range, then compare them on interactive Plotly charts
  - Reference data for each channel next to the chart
  - Dates, time zones and selected ranges handled explicitly
  - A typed API layer between the UI and the backend
  - Responsive layout and localization
  - Built to be served from an Nginx subpath
featuresRu:
  - Выбор каналов и интервала, сравнение на интерактивных графиках Plotly
  - Справочные данные канала рядом с графиком
  - Даты, часовые пояса и выбранные диапазоны заданы явно
  - Типизированный слой API между интерфейсом и бэкендом
  - Адаптивная вёрстка и локализация
  - Сборка для публикации в подкаталоге Nginx
stack:
  - React
  - TypeScript
  - Redux Toolkit
  - Plotly
  - PostgreSQL
  - Nginx
---

## The problem

Time-series values recorded in PostgreSQL are hard to compare from SQL alone. People need to pick a few channels and a time range and see them side by side, without mistakes from time zones.

## How it works

Users choose channels and an interval, then compare values on Plotly charts and read each channel's reference data. Dates and time zones are converted explicitly, so a selected range means the same thing for everyone. The frontend talks to the backend through a typed API layer, and the build is published under an Nginx subpath.

## Stack and why

- **React, TypeScript and Redux Toolkit.** Predictable state for selected channels, ranges and loaded series.
- **Plotly.** Zoom, pan and hover on dense time series out of the box.
- **PostgreSQL.** Where the channel data already lives.
- **Nginx subpath build.** It can be served from a path of an existing site, without a separate domain.

## Status

An internal work tool in use. The source is private, so there are no public links.

<!-- ru -->

## Задача

Временные ряды в PostgreSQL сложно сравнивать одним SQL. Нужно выбрать несколько каналов и интервал и увидеть их рядом, не ошибаясь с часовыми поясами.

## Как это работает

Пользователь выбирает каналы и интервал, сравнивает значения на графиках Plotly и смотрит справочные данные канала. Даты и часовые пояса преобразуются явно, поэтому выбранный интервал для всех означает одно и то же. Фронтенд обращается к бэкенду через типизированный слой API, а сборка публикуется в подкаталоге Nginx.

## Стек и почему

- **React, TypeScript и Redux Toolkit.** Предсказуемое состояние для выбранных каналов, интервалов и загруженных рядов.
- **Plotly.** Масштаб, сдвиг и подсказки на плотных временных рядах из коробки.
- **PostgreSQL.** Там уже лежат данные каналов.
- **Сборка под подкаталог Nginx.** Можно отдавать по пути существующего сайта, без отдельного домена.

## Статус

Внутренний рабочий инструмент, используется. Исходники закрыты, поэтому публичных ссылок нет.
