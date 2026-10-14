"""Encrypted PostgreSQL/upload backups and isolated restore operations."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import tarfile
import time


def positive(name, default):
    value = int(os.environ.get(name, default))
    if value < 1:
        raise ValueError(name + " must be positive")
    return value


def settings():
    for name in ("RESTIC_REPOSITORY", "RESTIC_PASSWORD"):
        if not os.environ.get(name):
            raise ValueError(name + " is required")
    return {
        "interval": positive("BACKUP_INTERVAL_SECONDS", 86400),
        "retry": positive("BACKUP_RETRY_SECONDS", 300),
        "daily": positive("BACKUP_KEEP_DAILY", 7),
        "weekly": positive("BACKUP_KEEP_WEEKLY", 4),
        "monthly": positive("BACKUP_KEEP_MONTHLY", 6),
        "timeout": positive("BACKUP_COMMAND_TIMEOUT_SECONDS", 14400),
    }


def run(command):
    result = subprocess.run(command, capture_output=True, text=True,
                            timeout=positive("BACKUP_COMMAND_TIMEOUT_SECONDS", 14400))
    if result.returncode:
        # Tool stderr may contain repository credentials or connection strings.
        raise RuntimeError(f"{Path(command[0]).name} failed (exit {result.returncode}); check storage/network/credentials")
    return result.stdout


def restic(*args):
    return run(["restic", "--no-cache", *args])


def sql(query):
    return run(["psql", "-X", "-v", "ON_ERROR_STOP=1", "-At", "-c", query]).strip()


def atomic(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(text)
    tmp.replace(path)
    if path.suffix == ".prom": path.chmod(0o644)


def write_metrics(directory, *, success, started, finished, maintenance=None):
    state_file = directory / "state.json"
    state = json.loads(state_file.read_text()) if state_file.exists() else {}
    state.update(last_attempt_timestamp_seconds=started, last_run_success=int(success),
                 last_duration_seconds=finished-started)
    if success:
        state["last_success_timestamp_seconds"] = finished
    else:
        state.setdefault("last_success_timestamp_seconds", 0)
    if maintenance is not None:
        state["retention_success"] = int(maintenance)
    atomic(state_file, json.dumps(state))
    atomic(directory / "backup.prom", "".join(f"tasteinsight_backup_{key} {value}\n" for key, value in state.items()))


def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024*1024), b""):
            h.update(chunk)
    return h.hexdigest()


def backup():
    config = settings()
    directory = Path(os.environ.get("BACKUP_METRICS_DIR", "/metrics"))
    started = time.time()
    bundle = Path("/work/bundle")
    try:
        # The repository must have been explicitly initialized by an operator.
        restic("snapshots", "--json")
        if bundle.exists():
            shutil.rmtree(bundle)
        bundle.mkdir(parents=True)
        run(["pg_dump", "--format=custom", "--no-owner", "--no-acl", "--file", str(bundle / "database.dump")])
        uploads = Path(os.environ.get("UPLOADS_PATH", "/uploads"))
        if not uploads.is_dir():
            raise ValueError("Upload source directory is missing")
        with tarfile.open(bundle / "uploads.tar", "w") as archive:
            for path in sorted(uploads.rglob("*")):
                if path.is_symlink() or not (path.is_file() or path.is_dir()):
                    raise ValueError("Upload backups require regular files and directories")
                archive.add(path, arcname=str(path.relative_to(uploads)), recursive=False)
        manifest = {"format": 1, "createdAt": started,
                    "release": os.environ.get("BACKUP_RELEASE", "unspecified"),
                    "sha256": {name: digest(bundle / name) for name in ("database.dump", "uploads.tar")}}
        (bundle / "manifest.json").write_text(json.dumps(manifest))
        output = restic("backup", "--json", "--host", os.environ.get("BACKUP_HOST", "tasteinsight"),
                        "--tag", "tasteinsight", str(bundle))
        summary = [json.loads(line) for line in output.splitlines() if line.startswith("{")]
        snapshot = next((x["snapshot_id"] for x in summary if x.get("message_type") == "summary" and "snapshot_id" in x), None)
        if not snapshot:
            raise RuntimeError("Backup did not return a snapshot id")
        backup_finished = time.time()
        write_metrics(directory, success=True, started=started, finished=backup_finished)
        print(json.dumps({"event": "backup_completed", "snapshot": snapshot}), flush=True)
    except Exception:
        write_metrics(directory, success=False, started=started, finished=time.time())
        raise
    finally:
        if bundle.exists():
            shutil.rmtree(bundle)
    # A retention failure must preserve the successful backup timestamp.
    try:
        restic("forget", "--host", os.environ.get("BACKUP_HOST", "tasteinsight"), "--tag", "tasteinsight",
               "--path", str(bundle), "--keep-daily", str(config["daily"]), "--keep-weekly", str(config["weekly"]),
               "--keep-monthly", str(config["monthly"]), "--prune")
        maintenance = True
    except Exception:
        maintenance = False
        print(json.dumps({"event": "retention_failed"}), flush=True)
    write_metrics(directory, success=True, started=started, finished=backup_finished, maintenance=maintenance)


def validate_snapshot(value):
    if not re.fullmatch(r"[0-9a-f]{64}", value):
        raise ValueError("RESTORE_SNAPSHOT must be a full 64-character snapshot id")
    return value


def empty_directory(directory):
    if directory.exists() and any(directory.iterdir()):
        raise ValueError("Restore directory must be empty")
    directory.mkdir(parents=True, exist_ok=True)


def restore():
    settings()
    snapshot = validate_snapshot(os.environ.get("RESTORE_SNAPSHOT", ""))
    target = Path(os.environ.get("RESTORE_UPLOADS_PATH", "/restored-uploads"))
    empty_directory(target)
    # This check happens before pg_restore; never drop or clean an existing schema.
    count = sql("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace "
                "WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' "
                "AND c.relkind IN ('r','p','v','m','S','f')")
    if count != "0":
        raise ValueError("Restore database must be empty")
    stage = Path("/work/restore")
    empty_directory(stage)
    restic("restore", snapshot, "--target", str(stage))
    bundle = stage / "work/bundle"
    manifest = json.loads((bundle / "manifest.json").read_text())
    if manifest.get("format") != 1:
        raise ValueError("Unsupported backup format")
    for name in ("database.dump", "uploads.tar"):
        if digest(bundle / name) != manifest["sha256"][name]:
            raise ValueError("Backup checksum mismatch")
    with tarfile.open(bundle / "uploads.tar") as archive:
        members = archive.getmembers()
        for member in members:
            candidate = Path(member.name)
            if candidate.is_absolute() or ".." in candidate.parts or not (member.isfile() or member.isdir()):
                raise ValueError("Unsafe upload archive entry")
        # Target is a new private volume; archives contain only regular files/directories.
        for member in members:
            destination = target / member.name
            if member.isdir():
                destination.mkdir(parents=True, exist_ok=True)
            else:
                destination.parent.mkdir(parents=True, exist_ok=True)
                with archive.extractfile(member) as source, destination.open("xb") as output:
                    shutil.copyfileobj(source, output)
    run(["pg_restore", "--exit-on-error", "--single-transaction", "--no-owner", "--no-acl",
         "--dbname", os.environ["PGDATABASE"], str(bundle / "database.dump")])
    tables = json.loads(sql("SELECT coalesce(json_agg(tablename),'[]'::json) FROM pg_tables WHERE schemaname='public'"))
    counts = {table: int(sql('SELECT count(*) FROM public."' + table.replace('"','""') + '"')) for table in tables}
    print(json.dumps({"event": "restore_verified", "snapshot": snapshot, "release": manifest["release"],
                      "tables": counts, "uploadFiles": sum(p.is_file() for p in target.rglob("*"))}), flush=True)


def main():
    settings()
    command = sys.argv[1] if len(sys.argv) > 1 else "once"
    Path("/work").mkdir(parents=True, exist_ok=True)
    with open("/work/operation.lock", "w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if command == "init":
            restic("init")
            print("Encrypted repository initialized")
        elif command == "list":
            print(restic("snapshots", "--json"))
        elif command == "check":
            restic("check", "--read-data")
            print("Repository data verified")
        elif command == "restore":
            restore()
        elif command == "once":
            backup()
        elif command == "loop":
            while True:
                try:
                    backup()
                    delay = settings()["interval"]
                except Exception as error:
                    print(json.dumps({"event":"backup_failed", "type":type(error).__name__}), flush=True)
                    delay = settings()["retry"]
                time.sleep(delay)
        else:
            raise ValueError("Unknown operation")


if __name__ == "__main__":
    os.umask(0o077)
    try:
        main()
    except Exception as error:
        print(f"Operation failed: {error}", file=sys.stderr)
        sys.exit(1)
