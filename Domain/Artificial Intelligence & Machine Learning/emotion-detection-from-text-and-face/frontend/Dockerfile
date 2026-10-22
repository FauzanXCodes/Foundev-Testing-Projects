# Stage 1: Install dependencies and build
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies (using npm install for simplicity)
RUN npm install

# Copy frontend source code
COPY . .

# Build the Next.js application
RUN npm run build

# Stage 2: Production runner
FROM node:20-slim AS runner

WORKDIR /app

# Set environment to production
ENV NODE_ENV production

# Copy necessary files from builder stage
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Final environment variables
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Expose the port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
