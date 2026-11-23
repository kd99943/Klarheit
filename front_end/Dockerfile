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

# Build-time API base URL baked into Vite bundle (can also be overridden at runtime via env-config.js)
ARG VITE_API_BASE_URL=http://localhost:8080/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Run assets localization script and build frontend distribution
RUN node scripts/localize-ar-assets.js && npm run build

# ==========================================
# STAGE 2: High Performance Web Host
# ==========================================
FROM nginx:1.27-alpine

# Install envsubst for runtime config templating
RUN apk add --no-cache gettext

ENV API_ORIGIN=http://localhost:8080
ENV VITE_API_BASE_URL=http://localhost:8080/api/v1

# Set up custom Nginx server block configuration (as template)
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

# Runtime entrypoint: substitute env vars then start nginx
CMD ["/bin/sh", "-c", "envsubst '${API_ORIGIN}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && envsubst '${VITE_API_BASE_URL}' < /usr/share/nginx/html/env-config.js > /tmp/env-config.js && mv /tmp/env-config.js /usr/share/nginx/html/env-config.js && nginx -g 'daemon off;'"]

# Extract build bundle output to host public root
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
