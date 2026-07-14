FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY nest-cli.json tsconfig*.json eslint.config.mjs ./
COPY src ./src
COPY packages ./packages
RUN npm run typecheck && npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node
EXPOSE 4000 3100
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:${PORT:-4000}/health/ready >/dev/null || exit 1
CMD ["node", "dist/main"]
