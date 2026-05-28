FROM debian:bookworm-slim AS engine-builder

# Build fairy-stockfish from source on glibc (Debian). The Alpine/musl variant
# fails to link the engine's C++ runtime, so we stay on glibc here.
# The same binary supports xiangqi when launched with
# `setoption name UCI_Variant value xiangqi`.
#
# TARGETARCH is provided by BuildKit (amd64 on Ubuntu/Intel, arm64 on Apple
# Silicon and Graviton). We map it to the engine's Makefile ARCH so a single
# Dockerfile works on both Ubuntu servers and macOS dev machines.
ARG TARGETARCH
RUN apt-get update \
	&& apt-get install -y --no-install-recommends git build-essential ca-certificates \
	&& rm -rf /var/lib/apt/lists/* \
	&& case "${TARGETARCH}" in \
		amd64) FAIRY_ARCH=x86-64 ;; \
		arm64) FAIRY_ARCH=armv8 ;; \
		*) echo "Unsupported TARGETARCH: ${TARGETARCH}" >&2; exit 1 ;; \
	esac \
	&& git clone --depth=1 https://github.com/fairy-stockfish/Fairy-Stockfish.git /tmp/fairy-stockfish \
	&& cd /tmp/fairy-stockfish/src \
	&& make -j"$(nproc)" build ARCH="${FAIRY_ARCH}" largeboards=yes all=yes \
	&& cp stockfish /usr/local/bin/fairy-stockfish \
	&& chmod +x /usr/local/bin/fairy-stockfish \
	&& rm -rf /tmp/fairy-stockfish


FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV FAIRY_STOCKFISH_PATH=/usr/local/bin/fairy-stockfish

# Same glibc base as the builder, so the binary's libstdc++/libgcc dependencies
# are already satisfied — no extra runtime packages needed.
COPY --from=engine-builder /usr/local/bin/fairy-stockfish /usr/local/bin/fairy-stockfish

COPY package.json yarn.lock prisma.config.ts ./
RUN yarn install --frozen-lockfile --production

COPY dist ./dist
COPY src/templates ./dist/templates
COPY src/generated ./dist/generated
COPY prisma ./prisma

EXPOSE 8000

CMD ["node", "dist/server.js"]
