# Local build artifact only. DevOps must supply reviewed immutable image/package
# pins; no mutable default is provided, so an accidental unpinned build fails.
ARG BASE_IMAGE
FROM ${BASE_IMAGE} AS build
WORKDIR /build
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --ignore-scripts
COPY src ./src
COPY test ./test
RUN npm run build && npm test

ARG BASE_IMAGE
FROM ${BASE_IMAGE} AS runtime
ARG FFMPEG_PACKAGE_VERSION
RUN test -n "${FFMPEG_PACKAGE_VERSION}" \
    && apt-get update \
    && apt-get install --yes --no-install-recommends "ffmpeg=${FFMPEG_PACKAGE_VERSION}" ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 mediaworker \
    && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin mediaworker
WORKDIR /app
COPY --from=build --chown=10001:10001 /build/dist ./dist
USER 10001:10001
ENV NODE_ENV=production
# C2 must provide the approved gateway adapters before this image receives a
# runnable entrypoint. Failing closed is intentional during the C3 prototype.
CMD ["node", "-e", "throw new Error('C2 envelope adapter is not configured')"]
