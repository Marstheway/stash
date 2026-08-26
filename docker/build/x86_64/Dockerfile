# This dockerfile should be built with `make docker-build` from the stash root.
# Layer order is intentional: dependency installs must not sit after COPY of
# frequently-changed sources, or every UI tweak re-downloads pnpm/Go modules.

# Build Frontend
FROM node:24-alpine AS frontend
RUN apk add --no-cache make git tzdata
ENV TZ=Asia/Shanghai
WORKDIR /stash
COPY Makefile /stash/
COPY ./ui/v2.5/package.json ./ui/v2.5/pnpm-lock.yaml /stash/ui/v2.5/
# Pin pnpm to the version declared in ui/v2.5/package.json (packageManager).
# Newer pnpm releases can reject the committed pnpm-lock.yaml on frozen installs.
RUN npm install -g pnpm@10.30.3
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    make pre-ui
COPY ./graphql /stash/graphql/
COPY ./ui /stash/ui/
RUN make generate-ui
ARG GITHASH
ARG STASH_VERSION
RUN BUILD_DATE=$(date +"%Y-%m-%d %H:%M:%S") make ui-only

# Build Backend
FROM golang:1.24.3-alpine AS backend
RUN apk add --no-cache make alpine-sdk tzdata
ENV TZ=Asia/Shanghai
# proxy.golang.org is slow from this host; goproxy.cn is the usual China mirror.
ENV GOPROXY=https://goproxy.cn,direct
WORKDIR /stash
COPY go.mod go.sum /stash/
RUN go mod download
COPY ./go* ./*.go Makefile gqlgen.yml .gqlgenc.yml /stash/
COPY ./graphql /stash/graphql/
COPY ./scripts /stash/scripts/
COPY ./pkg /stash/pkg/
COPY ./cmd /stash/cmd/
COPY ./internal /stash/internal/
# gqlgen imports the ui package; copy only the Go/embed bits so TS/SCSS
# edits do not invalidate generate-backend or re-download tool modules.
COPY ./ui/ui.go /stash/ui/ui.go
COPY ./ui/login /stash/ui/login/
RUN make generate-backend
COPY ./ui /stash/ui/
RUN make generate-login-locale
COPY --from=frontend /stash /stash/
ARG GITHASH
ARG STASH_VERSION
RUN make flags-release flags-pie stash

# Final Runnable Image
FROM alpine:latest
RUN apk add --no-cache ca-certificates vips-tools ffmpeg tzdata
ENV TZ=Asia/Shanghai
COPY --from=backend /stash/stash /usr/bin/
ENV STASH_CONFIG_FILE=/root/.stash/config.yml
EXPOSE 9999
ENTRYPOINT ["stash"]
