---
title: Ripo Team Cloud PC
emoji: 🖥️
colorFrom: indigo
colorTo: blue
sdk: gradio
app_file: app_server_v2.py
python_version: 3.12
fullWidth: true
header: mini
suggested_hardware: zero-a10g
pinned: false
---

# Ripo Team Cloud PC

Ripo Team's browser-accessible Cloud PC, TikTok AI backend, and streamed Aug-25-2021 Rec Room runtime.

This Space stays on the free Gradio/ZeroGPU-compatible SDK. Rec Room uses a SHA256-pinned portable Wine amd64-wow64 runtime and launches the archived client directly inside an isolated server sandbox. The archive contains no iOS or Android client binary. The archived client requires Steamworks, so the official Steam client runs as a hidden background dependency; its UI is not shown or streamed to players. A legitimate authenticated Steam session may still be required.

TikTok Login Kit credentials remain configured through Hugging Face Variables and Secrets. Deployment verification checks the live server health and Rec Room runtime after rollout.
