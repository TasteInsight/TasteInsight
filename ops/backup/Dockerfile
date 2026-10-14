FROM postgres:15-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends python3 restic ca-certificates && rm -rf /var/lib/apt/lists/*
COPY backup.py /opt/backup.py
ENTRYPOINT ["python3", "/opt/backup.py"]
CMD ["loop"]
