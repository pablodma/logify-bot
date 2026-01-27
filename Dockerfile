# Use Node.js 20
FROM node:20-alpine

WORKDIR /app

# Copy package files (including package-lock.json)
COPY package.json package-lock.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies for smaller image
RUN npm prune --production

# Start the bot
CMD ["npm", "start"]
