---
features:
  - Nothing to install on the phone; Safari on iPhone or Chrome on Android is enough
  - The stream stays on your Wi-Fi or phone hotspot; Google STUN is off unless you turn it on
  - A real Windows camera, so OBS, Discord, Zoom, Teams and the Camera app need no plugin
  - 480p to 4K, up to 60 fps; the default is 1080p30
  - Recording saves the phone’s original H.264 instead of encoding it a second time
  - Lives in the tray; closing the window keeps the camera running until you exit
  - The phone page holds a screen wake lock while live, so auto-lock doesn’t end the session
featuresRu:
  - На телефон ничего не ставится — достаточно Safari на iPhone или Chrome на Android
  - Поток не выходит за пределы вашего Wi-Fi или точки доступа телефона; Google STUN выключен, пока его не включить
  - Настоящая камера Windows — OBS, Discord, Zoom, Teams и «Камере» не нужен плагин
  - От 480p до 4K, до 60 кадров в секунду; по умолчанию 1080p30
  - Запись сохраняет исходный H.264 с телефона, без повторного кодирования
  - Живёт в трее: закрытое окно не выключает камеру до выхода из программы
  - Страница на телефоне держит экран включённым, пока идёт трансляция, чтобы автоблокировка не прервала сеанс
stack:
  - Rust
  - egui / eframe
  - axum
  - webrtc-rs
  - Media Foundation
  - Win32
  - Windows Virtual Camera
  - HTML / JS
  - jsQR
  - Inno Setup
---

## The problem

Using a phone as a webcam on Windows usually means installing an app on the phone, and often paying for 1080p, 4K or a watermark-free picture. PocketCam needs only the phone's browser.

## How it works

Open PocketCam on Windows 11, scan the QR with Safari or Chrome, allow the camera, and keep the page open. The phone and the PC must share a Wi-Fi network, or the PC can join the phone's hotspot.

The Windows host is written in Rust. It serves the phone page over HTTPS with a certificate for this PC (so the phone shows a one-time warning) and receives the camera as an H.264 WebRTC stream. Windows Media Foundation decodes it, and frames go into a shared NV12 ring buffer. A virtual camera source, built from Microsoft's Windows Virtual Camera sample, reads that buffer, so every app that can pick a webcam sees a camera named PocketCam. Recording writes the phone's original H.264 to MP4 in Videos\PocketCam.

If the phone drops off, the same session token works for about five minutes. **New session** issues a new one.

## Stack and why

- **Rust with egui / eframe.** A native Windows app with its own window and a tray icon.
- **axum and webrtc-rs.** The HTTPS server for the phone page and the WebRTC peer, in the same process.
- **Media Foundation and Win32.** H.264 decoding and the system virtual camera, so apps need no plugin.
- **Plain HTML and JS on the phone.** Nothing to install, and the page is built into the exe. QR scanning uses jsQR.
- **Inno Setup.** The installer registers the camera and adds a firewall rule for private networks.

## Status

Version 0.1.1 for Windows 11, with one phone, video only (no virtual microphone) and a self-signed certificate. Multiple phones, a virtual microphone and Windows 10 are on the list for v2. The source is readable on GitHub, but the licence isn't open source: you may use the official build, not redistribute or sell it.

<!-- ru -->

## Задача

Чтобы сделать телефон веб-камерой для Windows, обычно нужно ставить приложение на телефон и часто платить за 1080p, 4K или картинку без водяного знака. PocketCam нужен только браузер телефона.

## Как это работает

Откройте PocketCam на Windows 11, отсканируйте QR в Safari или Chrome, разрешите камеру и не закрывайте страницу. Телефон и ПК должны быть в одной сети Wi-Fi, либо ПК можно подключить к точке доступа телефона.

Программа для Windows написана на Rust. Она отдаёт страницу для телефона по HTTPS с сертификатом этого ПК (поэтому телефон один раз показывает предупреждение) и принимает камеру как поток H.264 по WebRTC. Windows Media Foundation декодирует его, кадры попадают в общий кольцевой буфер NV12. Источник виртуальной камеры, собранный из примера Microsoft Windows Virtual Camera, читает этот буфер, и любое приложение, умеющее выбирать веб-камеру, видит камеру PocketCam. Запись сохраняет исходный H.264 с телефона в MP4 в папку Видео\PocketCam.

Если телефон отключился, тот же токен сеанса работает ещё около пяти минут. Кнопка **New session** выдаёт новый.

## Стек и почему

- **Rust, egui / eframe.** Нативное приложение для Windows со своим окном и иконкой в трее.
- **axum и webrtc-rs.** HTTPS-сервер страницы для телефона и WebRTC в одном процессе.
- **Media Foundation и Win32.** Декодирование H.264 и системная виртуальная камера — приложениям не нужен плагин.
- **Простой HTML и JS на телефоне.** Ничего не нужно ставить, страница встроена в exe. QR сканируется через jsQR.
- **Inno Setup.** Установщик регистрирует камеру и добавляет правило брандмауэра для частной сети.

## Статус

Версия 0.1.1 для Windows 11: один телефон, только видео (без виртуального микрофона) и самоподписанный сертификат. Несколько телефонов, виртуальный микрофон и Windows 10 запланированы на v2. Исходники открыты для чтения на GitHub, но лицензия не открытая: официальную сборку можно использовать, но нельзя распространять или продавать.
