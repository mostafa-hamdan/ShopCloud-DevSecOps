FROM node:20-alpine AS deps
WORKDIR /app
COPY frontend/admin/package.json ./
RUN npm install --no-audit --no-fund

FROM node:20-alpine AS dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY frontend/admin/ ./
ENV NODE_ENV=development NEXT_TELEMETRY_DISABLED=1
EXPOSE 3001
CMD ["npm", "run", "dev"]
