FROM node:20-alpine AS builder

# Use a fast Alpine mirror (Tsinghua) to speed up apk downloads
RUN printf '%s\n' \
	"https://mirrors.tuna.tsinghua.edu.cn/alpine/v3.22/main" \
	"https://mirrors.tuna.tsinghua.edu.cn/alpine/v3.22/community" \
	> /etc/apk/repositories

# Install dependencies for native modules (bcrypt, etc.)
RUN apk add --no-cache python3 make g++

# Install pnpm using corepack (不使用npm)
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./

# Install dependencies (不使用frozen-lockfile，允许更新lockfile)
RUN pnpm install

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the application
RUN pnpm run build

# Production stage
FROM node:20-alpine

# Use the same fast Alpine mirror in the production stage as well
RUN printf '%s\n' \
	"https://mirrors.tuna.tsinghua.edu.cn/alpine/v3.22/main" \
	"https://mirrors.tuna.tsinghua.edu.cn/alpine/v3.22/community" \
	> /etc/apk/repositories

# Install dependencies for native modules runtime
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Install pnpm using corepack (不使用npm)
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy built assets and dependencies from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/tsconfig.json ./

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/src/main"]
