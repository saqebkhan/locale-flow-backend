# Use Node.js 20 LTS
FROM node:20-slim

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm install

# Copy source code
COPY . .

# Build TypeScript if necessary (we use tsx in dev, but for prod we can use tsc or just tsx)
# For Render, we'll keep it simple and use tsx directly or build to JS.
# Let's ensure tsx is available.
RUN npm install -g tsx

# Expose the port your app runs on
EXPOSE 5000

# Define environment variables (Render will override these)
ENV NODE_ENV=production
ENV PORT=5000

# Start the application
CMD ["tsx", "src/server.ts"]
