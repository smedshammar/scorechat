# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install dependencies
RUN npm install
RUN cd client && npm install
RUN cd server && npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose the port that the server runs on
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production

# Start the server
CMD ["npm", "start"]