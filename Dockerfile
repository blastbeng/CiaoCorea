# syntax=docker/dockerfile:1.7
#
# Tre stadi: dipendenze, build, runtime. Nell'immagine finale non resta né
# node_modules né TypeScript: il server è un solo file CJS prodotto da esbuild,
# il client è già HTML/CSS/JS. Meno superficie, avvio più rapido.
#
FROM node:24-bookworm-slim AS deps
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false
WORKDIR /app

# I workspace vanno dichiarati tutti prima di npm ci, altrimenti il lockfile
# non torna e l'installazione fallisce.
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
COPY packages/engine/package.json packages/engine/
COPY packages/curriculum/package.json packages/curriculum/

RUN --mount=type=cache,target=/root/.npm \
    npm ci --include=dev

FROM deps AS build
COPY tsconfig.base.json vitest.config.ts ./
COPY packages ./packages
COPY apps ./apps
COPY scripts ./scripts
RUN npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    DATA_DIR=/data \
    WEB_DIST=/app/web
WORKDIR /app

COPY --from=build /app/apps/server/dist/server.cjs ./server.cjs
COPY --from=build /app/apps/web/dist ./web

# Il volume ./data è montato sopra /data: l'uid 1000 (node) deve poter
# scrivere, e l'host ha lo stesso uid per lo stesso motivo.
RUN mkdir -p /data && chown -R node:node /data /app

USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.cjs"]
