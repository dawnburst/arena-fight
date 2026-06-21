# --- Build stage: compile the Vite static bundle ---
FROM node:22-alpine AS build

WORKDIR /app

# Install dependencies first to leverage Docker layer caching.
# --ignore-scripts skips the "postinstall" lefthook git-hook setup, which
# fails (and is unnecessary) inside the container where there is no .git.
COPY package*.json ./
RUN npm ci --ignore-scripts

# Build the static site. Override Vite's base path to "/" so the bundle
# is served from the container root instead of the GitHub Pages /arena-fight/ path.
COPY . .
RUN npx vite build --base=/

# --- Runtime stage: serve the bundle with nginx ---
FROM nginx:alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
