FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY prisma ./prisma
# Docker runs against PostgreSQL; swap in the postgres schema before generating
RUN cp prisma/schema.postgres.prisma prisma/schema.prisma && npx prisma generate

COPY src ./src

EXPOSE 4000

# Apply schema on boot (idempotent), seed if empty, then start
CMD ["sh", "-c", "npx prisma db push --skip-generate && node prisma/seed.js && node src/server.js"]
