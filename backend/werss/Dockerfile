# Keep backend and bundled frontend sources on the same immutable upstream release.
FROM ghcr.io/rachelos/we-mp-rss@sha256:af771f21b3f7958a5dea16911fba050a6d7b92eac2fb2499c467c1b11f07ef34 AS upstream
FROM node:22-alpine AS frontend
WORKDIR /build
RUN apk add --no-cache patch
COPY --from=upstream /app/web_ui/ ./
RUN npm ci --no-audit --no-fund
COPY sanitizers/package*.json /sanitizers/
RUN npm ci --prefix /sanitizers --no-audit --no-fund && cp -r /sanitizers/node_modules/. /build/node_modules/
COPY frontend-prefix.patch /tmp/frontend-prefix.patch
RUN find src -type f \( -name '*.vue' -o -name '*.ts' \) -exec sed -i 's/\r$//' {} + && sed -i 's/\r$//' index.html
RUN patch --batch --fuzz=0 -p1 < /tmp/frontend-prefix.patch
COPY public-url.ts ./src/utils/public-url.ts
COPY sanitize-article.ts ./src/utils/sanitize-article.ts
ENV VITE_API_BASE_URL=/werss/
RUN npm run build -- --base=/werss/

FROM upstream
RUN rm -rf /app/static && mkdir -p /app/static
COPY --from=frontend /build/dist/ /app/static/
RUN /app/env_$(uname -m)/bin/python -m pip install --no-cache-dir nh3==0.3.7
COPY prefix_adapter.py /app/prefix_adapter.py
COPY install_adapter.py /tmp/install_adapter.py
RUN python3 /tmp/install_adapter.py && rm /tmp/install_adapter.py
COPY tests/ /tmp/adapter-tests/
RUN /app/env_$(uname -m)/bin/python -m unittest discover -s /tmp/adapter-tests/ && rm -rf /tmp/adapter-tests
ENV WERSS_PUBLIC_PATH=/werss/
