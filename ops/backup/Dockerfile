FROM golang:1.27.2-alpine AS restic-build
WORKDIR /src
# Keep the upstream restic release with patched versions of its affected modules.
RUN go mod init tasteinsight-restic-build && \
    go get github.com/restic/restic/cmd/restic@v0.19.1 \
      golang.org/x/net@v0.60.0 google.golang.org/grpc@v1.83.2 && \
    CGO_ENABLED=0 go build -mod=readonly -ldflags="-X main.version=0.19.1" \
      -o /out/restic github.com/restic/restic/cmd/restic

FROM postgres:15-alpine3.24 AS postgres-client
FROM python:3.12-alpine3.24
RUN apk upgrade --no-cache && apk add --no-cache libedit krb5-libs libldap
COPY --from=postgres-client /usr/local/bin/pg_dump /usr/local/bin/pg_restore /usr/local/bin/psql /usr/local/bin/
COPY --from=postgres-client /usr/local/lib/libpq.so.5* /usr/local/lib/
COPY --from=restic-build /out/restic /usr/bin/restic
COPY backup.py /opt/backup.py
STOPSIGNAL SIGTERM
ENTRYPOINT ["python3", "/opt/backup.py"]
CMD ["loop"]
