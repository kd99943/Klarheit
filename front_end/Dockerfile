# ==========================================
# STAGE 1: Build Environment
# ==========================================
FROM node:22-alpine AS build

WORKDIR /app

# Install dependencies first for build caching
COPY package*.json ./
RUN npm ci

# Copy full application sources
COPY . .

# Run assets localization script and build frontend distribution
RUN node scripts/localize-ar-assets.js && npm run build

# ==========================================
# STAGE 2: High Performance Web Host
# ==========================================
FROM nginx:1.27-alpine

# Set up custom Nginx server block configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Extract build bundle output to host public root
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
