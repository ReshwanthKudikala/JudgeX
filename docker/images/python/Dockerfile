# Minimal Python sandbox for JudgeX (ARCHITECTURE.md §5.2).
# Prebuilt so judge-time never pulls packages or hits the network.
FROM python:3.12-alpine

RUN adduser -D -u 1000 -g 1000 judge

# Adapter bind-mounts a per-job workspace here; keepalive uses `tail`.
WORKDIR /workspace
