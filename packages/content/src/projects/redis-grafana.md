---
slug: redis-grafana
title: redis-grafana
titleRu: redis-grafana
tags:
  - Redis
  - Grafana
  - Flask
  - React
year: 2025
status: active
featured: true
summary: Telemetry pipeline from a TCP source into Redis TimeSeries and Grafana dashboards.
summaryRu: Телеметрия с TCP-источника в Redis TimeSeries и дашборды Grafana.
links: []
---

Binary messages are decoded, queued with backpressure, and stored in Redis TimeSeries with aggregation rules for several retention windows. A Flask and React controller manages channels, configuration, status, and logs. Components are split across internal and external networks.

<!-- ru -->

Двоичные сообщения разбираются, встают в очередь с ограничением скорости и пишутся в Redis TimeSeries с правилами агрегации на несколько окон хранения. Контроллер на Flask и React управляет каналами, конфигурацией, статусом и логами. Части системы разделены по внутренней и внешней сети.
