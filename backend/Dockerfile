FROM node:22-alpine AS builder

# Keep the base image's Alpine release when selecting a mirror.
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apk/repositories

# Install dependencies for native modules (bcrypt, etc.)
RUN apk add --no-cache python3 make g++

# Install pnpm using corepack (不使用npm)
RUN corepack enable && corepack prepare pnpm@11.21.0 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./

# Install the versions recorded in the lockfile.
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the application
RUN pnpm run build

# Production stage
FROM node:22-alpine

# Keep the runtime repository release aligned with the base image too.
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apk/repositories

# Install dependencies for native modules runtime
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Install pnpm using corepack (不使用npm)
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@11.21.0 --activate

# Copy built assets and dependencies from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/tsconfig.json ./

# Copy entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Expose port
EXPOSE 3000

# Set entrypoint
ENTRYPOINT ["./docker-entrypoint.sh"]

# Start the application
CMD ["node", "dist/src/main"]
