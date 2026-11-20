FROM node:22-alpine AS build

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend ./

ARG VITE_API_BASE_URL=/
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

FROM nginx:1.27-alpine

ARG NGINX_CONFIG=nginx.conf
ENV WS3_HTTPS_PORT=443 \
    NGINX_ENVSUBST_FILTER=^WS3_HTTPS_PORT$

COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /tmp/nginx.conf
COPY frontend/nginx.https.conf /tmp/nginx.https.conf
RUN case "$NGINX_CONFIG" in \
      nginx.conf) cp /tmp/nginx.conf /etc/nginx/conf.d/default.conf ;; \
      nginx.https.conf) mkdir -p /etc/nginx/templates && \
        cp /tmp/nginx.https.conf /etc/nginx/templates/default.conf.template ;; \
      *) echo "Unsupported NGINX_CONFIG: $NGINX_CONFIG" >&2; exit 1 ;; \
    esac

EXPOSE 80
EXPOSE 443
