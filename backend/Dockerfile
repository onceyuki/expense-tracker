FROM node:20-alpine

# Alpine ships without OpenSSL; Prisma's engine binaries need libssl at runtime
# or they crash before printing valid JSON ("Could not parse schema engine response").
RUN apk add --no-cache openssl

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
