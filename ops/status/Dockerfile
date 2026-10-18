FROM nginx:1.28-alpine
RUN apk upgrade --no-cache
COPY nginx.conf.template /etc/nginx/status.conf.template
COPY start.sh /start.sh
USER 101:101
EXPOSE 8080
ENTRYPOINT ["/bin/sh", "/start.sh"]
