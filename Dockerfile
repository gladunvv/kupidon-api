FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S kupidon \
  && adduser -S kupidon -G kupidon \
  && mkdir -p uploads/photos \
  && chown -R kupidon:kupidon /app

COPY --from=prod-deps --chown=kupidon:kupidon /app/node_modules ./node_modules
COPY --from=build --chown=kupidon:kupidon /app/dist ./dist

USER kupidon

# The app reads its listen port from app.port in the externally supplied
# config.yaml (see config.example.yaml); 8000 is that config's default.
EXPOSE 8000

CMD ["node", "dist/main.js"]
