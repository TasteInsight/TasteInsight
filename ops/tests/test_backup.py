import importlib.util
import os
import tempfile
import subprocess
import sys
import tarfile
import io
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "backup", Path(__file__).parents[1] / "backup/backup.py"
)
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class BackupTests(unittest.TestCase):
    def test_requires_repository_and_secret(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ValueError):
                backup.settings()

    def test_rejects_unsafe_retention_and_interval(self):
        with patch.dict(
            os.environ,
            {
                "RESTIC_REPOSITORY": "/repo",
                "RESTIC_PASSWORD": "secret",
                "BACKUP_INTERVAL_SECONDS": "0",
            },
            clear=True,
        ):
            with self.assertRaises(ValueError):
                backup.settings()

    def test_snapshot_requires_exact_id(self):
        for value in ["latest", "", "../../x", "--help"]:
            with self.assertRaises(ValueError):
                backup.validate_snapshot(value)
        self.assertEqual(backup.validate_snapshot("a" * 64), "a" * 64)

    def test_metrics_keep_last_success_on_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory)
            backup.write_metrics(target, success=True, started=100, finished=110)
            backup.write_metrics(target, success=False, started=200, finished=205)
            text = (target / "backup.prom").read_text()
            self.assertIn(
                "tasteinsight_backup_last_success_timestamp_seconds 110", text
            )
            self.assertIn("tasteinsight_backup_last_run_success 0", text)

    def test_retention_failure_does_not_advance_backup_time(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "uploads").mkdir()
            clock = [100]

            def fake_run(command):
                Path(command[-1]).write_bytes(b"database")
                return ""

            def fake_restic(*args):
                if args[0] == "backup":
                    clock[0] = 110
                    return '{"message_type":"summary","snapshot_id":"snapshot"}'
                if args[0] == "forget":
                    clock[0] = 14510
                    raise RuntimeError("retention timeout")
                return "[]"

            def mapped_path(value):
                return root / "bundle" if value == "/work/bundle" else Path(value)

            env = {
                "RESTIC_REPOSITORY": "/repo",
                "RESTIC_PASSWORD": "secret",
                "UPLOADS_PATH": str(root / "uploads"),
                "BACKUP_METRICS_DIR": str(root / "metrics"),
            }
            with (
                patch.dict(os.environ, env),
                patch.object(backup, "Path", side_effect=mapped_path),
                patch.object(backup, "run", side_effect=fake_run),
                patch.object(backup, "restic", side_effect=fake_restic),
                patch.object(backup.time, "time", side_effect=lambda: clock[0]),
            ):
                backup.backup()
            text = (root / "metrics/backup.prom").read_text()
            self.assertIn(
                "tasteinsight_backup_last_success_timestamp_seconds 110", text
            )
            self.assertIn("tasteinsight_backup_retention_success 0", text)

    def test_timeout_allows_child_to_release_lock(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            script = root / "child.py"
            lock = root / "lock"
            script.write_text(
                "import signal,time,sys\nfrom pathlib import Path\np=Path(sys.argv[1])\ndef stop(*_):\n p.unlink()\n sys.exit(0)\nsignal.signal(signal.SIGTERM,stop)\np.touch()\nwhile True: time.sleep(.05)\n"
            )
            with patch.dict(os.environ, {"BACKUP_COMMAND_TIMEOUT_SECONDS": "1"}):
                with self.assertRaises(RuntimeError):
                    backup.run([sys.executable, str(script), str(lock)])
            self.assertFalse(
                lock.exists(),
                "subprocess must receive a graceful stop before its parent returns",
            )

    def test_restored_uploads_are_readable_by_web_server(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / "uploads.tar"
            with tarfile.open(archive, "w") as stream:
                member = tarfile.TarInfo("nested/image.txt")
                member.size = 5
                member.mode = 0o600
                stream.addfile(member, io.BytesIO(b"image"))
            previous = os.umask(0o077)
            try:
                backup.restore_uploads(archive, root / "restored")
            finally:
                os.umask(previous)
            self.assertEqual(
                (root / "restored/nested/image.txt").stat().st_mode & 0o777, 0o644
            )
            self.assertEqual((root / "restored/nested").stat().st_mode & 0o777, 0o755)
            self.assertEqual((root / "restored").stat().st_mode & 0o777, 0o755)

    def test_upload_restore_rejects_paths_and_links_before_writing(self):
        for name, kind in [
            ("../outside", tarfile.REGTYPE),
            ("/outside", tarfile.REGTYPE),
            ("link", tarfile.SYMTYPE),
            ("hardlink", tarfile.LNKTYPE),
        ]:
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                archive = root / "uploads.tar"
                with tarfile.open(archive, "w") as stream:
                    good = tarfile.TarInfo("good.txt")
                    good.size = 4
                    stream.addfile(good, io.BytesIO(b"good"))
                    bad = tarfile.TarInfo(name)
                    bad.type = kind
                    bad.linkname = "/etc/passwd"
                    stream.addfile(bad)
                with self.assertRaises(ValueError):
                    backup.restore_uploads(archive, root / "restored")
                self.assertFalse((root / "restored/good.txt").exists())

    def test_metrics_io_failure_cannot_turn_stop_into_retry(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            actual_open = open

            def mapped(value):
                return (
                    root / str(value).removeprefix("/work").lstrip("/")
                    if str(value).startswith("/work")
                    else Path(value)
                )

            def opened(value, *args, **kwargs):
                return actual_open(mapped(value), *args, **kwargs)

            def stop(*_):
                backup.interrupt_operation(None, None)

            with (
                patch.dict(
                    os.environ, RESTIC_REPOSITORY="/repo", RESTIC_PASSWORD="secret"
                ),
                patch.object(sys, "argv", ["backup.py", "loop"]),
                patch.object(backup, "Path", side_effect=mapped),
                patch("builtins.open", side_effect=opened),
                patch.object(backup, "restic", side_effect=stop),
                patch.object(
                    backup, "write_metrics", side_effect=OSError(28, "disk full")
                ),
                patch.object(backup.signal, "signal"),
                patch.object(backup, "_stopping", False),
                patch.object(backup.time, "sleep") as sleep,
            ):
                with self.assertRaises(backup.OperationInterrupted):
                    backup.main()
                sleep.assert_not_called()

    def test_stop_during_timeout_still_waits_for_child_cleanup(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            child = root / "child.py"
            lock = root / "lock"
            child.write_text(
                "import signal,time,sys\nfrom pathlib import Path\np=Path(sys.argv[1])\ndef stop(*_):\n time.sleep(2)\n p.unlink()\n sys.exit(0)\nsignal.signal(signal.SIGTERM,stop)\np.touch()\nwhile True: time.sleep(.05)\n"
            )
            parent = root / "parent.py"
            parent.write_text(
                "import importlib.util,signal,os,sys,threading\ns=importlib.util.spec_from_file_location('backup',"
                + repr(str(Path(__file__).parents[1] / "backup/backup.py"))
                + "); b=importlib.util.module_from_spec(s);s.loader.exec_module(b)\nos.environ['BACKUP_COMMAND_TIMEOUT_SECONDS']='1'\nsignal.signal(signal.SIGTERM,b.interrupt_operation)\nt=threading.Timer(1.4,lambda:os.kill(os.getpid(),signal.SIGTERM));t.start()\ntry: b.run([sys.executable,"
                + repr(str(child))
                + ","
                + repr(str(lock))
                + "])\nexcept b.OperationInterrupted: pass\nelse: raise AssertionError('stop was lost')\nfinally: t.join()\nfrom pathlib import Path\nassert not Path("
                + repr(str(lock))
                + ").exists(), 'parent returned before child cleanup'\n"
            )
            result = subprocess.run(
                [sys.executable, str(parent)],
                capture_output=True,
                text=True,
                timeout=10,
            )
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_restore_refuses_nonempty_target(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory)
            (target / "existing").write_text("keep")
            with self.assertRaises(ValueError):
                backup.empty_directory(target)


if __name__ == "__main__":
    unittest.main()
