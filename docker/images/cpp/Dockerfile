# Minimal C++ toolchain sandbox for JudgeX (ARCHITECTURE.md §5.2).
# Prebuilt so judge-time never pulls packages or hits the network.
FROM alpine:3.20

RUN apk add --no-cache g++ libstdc++ \
  && adduser -D -u 1000 -g 1000 judge

WORKDIR /workspace
