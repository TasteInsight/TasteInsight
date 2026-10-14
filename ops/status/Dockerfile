FROM python:3.12-alpine3.24
RUN apk upgrade --no-cache
WORKDIR /app
COPY server.py index.html app.js style.css ./
USER 65534:65534
EXPOSE 8080
CMD ["python", "server.py"]
