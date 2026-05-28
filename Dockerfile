# Build
FROM node:22-alpine AS build
USER node
WORKDIR /app
COPY --chown=node:node . .
RUN npm ci
RUN npm run build

# Runtime
FROM node:22-alpine AS runtime
USER node
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json package.json
COPY --from=build --chown=node:node /app/package-lock.json package-lock.json
COPY --from=build --chown=node:node /app/db/migrations db/migrations
COPY --from=build --chown=node:node /app/dist dist
COPY --from=build --chown=node:node /app/tsconfig.json tsconfig.json
COPY --from=build --chown=node:node /app/node_modules node_modules
EXPOSE 8004
CMD npm run start:prod
