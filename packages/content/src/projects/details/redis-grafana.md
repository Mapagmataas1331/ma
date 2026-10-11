---
features:
  - Binary messages from a TCP source are decoded and stored as time series
  - An async pipeline with queues, backpressure and automatic reconnects
  - Redis TimeSeries aggregation rules for several retention windows
  - Grafana dashboards on top of the stored series
  - A Flask and React controller for channels, configuration, status and logs
  - Components split across internal and external networks
featuresRu:
  - Двоичные сообщения с TCP-источника разбираются и сохраняются как временные ряды
  - Асинхронный конвейер с очередями, ограничением скорости и повторным подключением
  - Правила агрегации Redis TimeSeries на несколько окон хранения
  - Дашборды Grafana поверх сохранённых рядов
  - Контроллер на Flask и React для каналов, конфигурации, статуса и логов
  - Части системы разделены по внутренней и внешней сети
stack:
  - Redis TimeSeries
  - Grafana
  - Flask
  - Python
  - React
---

## The problem

A TCP source sends binary telemetry. The values have to be stored, downsampled for long periods and shown on dashboards, and the stream must survive slow consumers and dropped connections.

## How it works

An async collector reads the TCP stream, decodes the binary messages and puts them on queues with backpressure, reconnecting when the source drops. Samples are written to Redis TimeSeries, where aggregation rules keep coarser copies for several retention windows. Grafana reads those series for dashboards. A Flask and React controller manages channels, configuration, status and logs. The parts are split between internal and external networks.

## Stack and why

- **An async pipeline.** Queues and backpressure for a stream that can't be allowed to block.
- **Redis TimeSeries.** Fast writes and built-in downsampling rules instead of hand-written rollups.
- **Grafana.** Dashboards without building charts from scratch.
- **Flask and React.** A small controller for the people who run the pipeline.

## Status

An internal work tool in use. The source is private, so there are no public links.

<!-- ru -->

## Задача

TCP-источник присылает двоичную телеметрию. Значения нужно сохранять, прореживать для длинных периодов и показывать на дашбордах, а поток не должен ломаться из-за медленных потребителей и обрывов связи.

## Как это работает

Асинхронный сборщик читает поток TCP, разбирает двоичные сообщения и ставит их в очереди с ограничением скорости, переподключаясь при обрыве источника. Значения пишутся в Redis TimeSeries, где правила агрегации хранят более грубые копии на несколько окон хранения. Grafana читает эти ряды для дашбордов. Контроллер на Flask и React управляет каналами, конфигурацией, статусом и логами. Части системы разделены по внутренней и внешней сети.

## Стек и почему

- **Асинхронный конвейер.** Очереди и ограничение скорости для потока, который нельзя блокировать.
- **Redis TimeSeries.** Быстрая запись и встроенное прореживание вместо самописных агрегатов.
- **Grafana.** Дашборды без написания графиков с нуля.
- **Flask и React.** Небольшой контроллер для тех, кто сопровождает конвейер.

## Статус

Внутренний рабочий инструмент, используется. Исходники закрыты, поэтому публичных ссылок нет.
