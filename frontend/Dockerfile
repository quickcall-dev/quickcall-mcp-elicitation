FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Expose frontend port
EXPOSE 3000

# Run the production server
CMD ["npm", "start"]
