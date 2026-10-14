import importlib.util
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location("backup", Path(__file__).parents[1]/"backup/backup.py")
backup=importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)

class BackupTests(unittest.TestCase):
    def test_requires_repository_and_secret(self):
        with patch.dict(os.environ,{},clear=True):
            with self.assertRaises(ValueError): backup.settings()
    def test_rejects_unsafe_retention_and_interval(self):
        with patch.dict(os.environ,{"RESTIC_REPOSITORY":"/repo", "RESTIC_PASSWORD":"secret", "BACKUP_INTERVAL_SECONDS":"0"},clear=True):
            with self.assertRaises(ValueError): backup.settings()
    def test_snapshot_requires_exact_id(self):
        for value in ["latest", "", "../../x", "--help"]:
            with self.assertRaises(ValueError): backup.validate_snapshot(value)
        self.assertEqual(backup.validate_snapshot("a"*64),"a"*64)
    def test_metrics_keep_last_success_on_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            target=Path(directory)
            backup.write_metrics(target, success=True, started=100, finished=110)
            backup.write_metrics(target, success=False, started=200, finished=205)
            text=(target/"backup.prom").read_text()
            self.assertIn("tasteinsight_backup_last_success_timestamp_seconds 110",text)
            self.assertIn("tasteinsight_backup_last_run_success 0",text)
    def test_retention_failure_does_not_advance_backup_time(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            (root/"uploads").mkdir()
            clock=[100]
            def fake_run(command):
                Path(command[-1]).write_bytes(b"database")
                return ""
            def fake_restic(*args):
                if args[0]=="backup":
                    clock[0]=110
                    return '{"message_type":"summary","snapshot_id":"snapshot"}'
                if args[0]=="forget":
                    clock[0]=14510
                    raise RuntimeError("retention timeout")
                return "[]"
            def mapped_path(value):
                return root/"bundle" if value=="/work/bundle" else Path(value)
            env={"RESTIC_REPOSITORY":"/repo","RESTIC_PASSWORD":"secret","UPLOADS_PATH":str(root/"uploads"),"BACKUP_METRICS_DIR":str(root/"metrics")}
            with patch.dict(os.environ,env), patch.object(backup,"Path",side_effect=mapped_path), patch.object(backup,"run",side_effect=fake_run), patch.object(backup,"restic",side_effect=fake_restic), patch.object(backup.time,"time",side_effect=lambda:clock[0]):
                backup.backup()
            text=(root/"metrics/backup.prom").read_text()
            self.assertIn("tasteinsight_backup_last_success_timestamp_seconds 110",text)
            self.assertIn("tasteinsight_backup_retention_success 0",text)

    def test_restore_refuses_nonempty_target(self):
        with tempfile.TemporaryDirectory() as directory:
            target=Path(directory)
            (target/"existing").write_text("keep")
            with self.assertRaises(ValueError): backup.empty_directory(target)

if __name__ == "__main__": unittest.main()
