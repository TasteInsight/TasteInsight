"""Fault injection inside a disposable backup container, never a live database."""

import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile

spec = importlib.util.spec_from_file_location("backup", "/opt/backup.py")
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)

if sys.argv[1] == "timeout":
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        os.environ.update(
            RESTIC_REPOSITORY=str(root / "repo"),
            RESTIC_PASSWORD="test-only",
            BACKUP_COMMAND_TIMEOUT_SECONDS="30",
        )
        backup.restic("init")
        (root / "source").mkdir()
        (root / "source/random").write_bytes(os.urandom(1048576))
        os.environ["BACKUP_COMMAND_TIMEOUT_SECONDS"] = "1"
        try:
            backup.restic("backup", "--limit-upload", "1", str(root / "source"))
        except RuntimeError as error:
            assert "timed out" in str(error)
        else:
            raise AssertionError("slow backup must time out")
        assert not list((root / "repo/locks").iterdir()), "restic lock survived timeout"
        os.environ["BACKUP_COMMAND_TIMEOUT_SECONDS"] = "30"
        backup.restic("forget", "--keep-last", "1", "--prune")
        print("PASS: timed-out restic releases its lock and permits retention")
elif sys.argv[1] == "disk":
    os.environ.update(
        RESTIC_REPOSITORY="/repo",
        RESTIC_PASSWORD="test-only",
        BACKUP_METRICS_DIR="/work/metrics",
    )
    Path("/uploads").mkdir(exist_ok=True)
    backup.restic = lambda *args: "[]"
    real_run = backup.run

    def fill_disk(_command):
        real_run(
            [
                "sh",
                "-c",
                "dd if=/dev/zero of=/work/bundle/database.dump bs=1024 count=4096 2>/dev/null",
            ]
        )

    backup.run = fill_disk
    backup.write_metrics(
        Path("/work/metrics"), success=True, started=100, finished=110, maintenance=True
    )
    try:
        backup.backup()
    except RuntimeError:
        pass
    else:
        raise AssertionError("bounded tmpfs must fill")
    state = json.loads(Path("/work/metrics/state.json").read_text())
    assert state["last_run_success"] == 0
    assert state["last_success_timestamp_seconds"] == 110
    assert not Path("/work/bundle").exists()
    print("PASS: full disk backup failure is recorded after staging cleanup")
else:
    raise ValueError("Unknown fault scenario")
