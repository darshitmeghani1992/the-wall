# Local build artifact only. DevOps must supply reviewed immutable image/package
# pins; no mutable default is provided, so an accidental unpinned build fails.
ARG BASE_IMAGE
FROM ${BASE_IMAGE} AS media-tools
ARG FFMPEG_PACKAGE_VERSION
RUN test -n "${FFMPEG_PACKAGE_VERSION}" \
    && apt-get update \
    && apt-get install --yes --no-install-recommends "ffmpeg=${FFMPEG_PACKAGE_VERSION}" ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Tests invoke ffmpeg and ffprobe. Use the same pinned toolchain as runtime.
FROM media-tools AS build
WORKDIR /build
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --ignore-scripts
COPY src ./src
COPY test ./test
RUN npm test

FROM media-tools AS runtime
RUN groupadd --gid 10001 mediaworker \
    && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin mediaworker
WORKDIR /app
COPY --from=build --chown=10001:10001 /build/dist ./dist
USER 10001:10001
ENV NODE_ENV=production
# The executable requires MARK_MEDIA_RUNTIME_ENABLED=true plus validated
# gateway secrets and Ed25519 public-key bindings or exits before listening.
# The runtime is NOT hosted/released until DevOps enforces the declarative
# sandbox, exact egress, immutable image digest and C2 Edge secret gates.
COPY --chown=10001:10001 start.cjs ./start.cjs
EXPOSE 8080
CMD ["node", "start.cjs"]
