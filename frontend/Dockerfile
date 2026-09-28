FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY frontend ./frontend

ARG VITE_API_BASE_URL=/
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ARG NGINX_CONFIG=nginx.conf

RUN npm run build

FROM nginx:1.27-alpine

ARG NGINX_CONFIG=nginx.conf

COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /tmp/nginx.conf
COPY frontend/nginx.https.conf /tmp/nginx.https.conf
RUN case "$NGINX_CONFIG" in \
      nginx.conf|nginx.https.conf) cp "/tmp/$NGINX_CONFIG" /etc/nginx/conf.d/default.conf ;; \
      *) echo "Unsupported NGINX_CONFIG: $NGINX_CONFIG" >&2; exit 1 ;; \
    esac

EXPOSE 80
EXPOSE 443
