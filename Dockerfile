# Build Stage
FROM node:20-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (clean)
RUN npm ci

# Copy source code
COPY . .

# Build Arguments for Environment Variables
# These must be passed during build for Vite to embed them
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_EVOLUTION_API_URL
ARG VITE_EVOLUTION_API_KEY

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_EVOLUTION_API_URL=$VITE_EVOLUTION_API_URL
ENV VITE_EVOLUTION_API_KEY=$VITE_EVOLUTION_API_KEY

# Build the application
RUN npm run build

# Production Stage
FROM nginx:alpine

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
