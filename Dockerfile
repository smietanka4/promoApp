# =============================================================================
# Stage 1: Build frontendu PWA (React + Vite + Tailwind + vite-plugin-pwa)
# =============================================================================
FROM node:22-alpine AS client-builder

WORKDIR /app/client

COPY client/package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY client/ ./
RUN npm run build

# =============================================================================
# Stage 2: Produkcja (Node.js + Express + wbudowany statyczny build PWA)
# =============================================================================
FROM node:22-alpine AS production

ENV NODE_ENV=production
WORKDIR /app/server

COPY server/package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

COPY server/ ./
COPY --from=client-builder /app/client/dist /app/client/dist

# Uruchomienie jako użytkownik bez uprawnień root
RUN chown -R node:node /app
USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1

CMD ["node", "index.js"]
