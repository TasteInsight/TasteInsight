"""Check selected Compose configuration reaches the monitoring renderer."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from test_config import render

ROOT = Path(__file__).parents[1]

class ComposeConfigTests(unittest.TestCase):
    def test_selected_file_and_shell_reach_renderer_without_unrelated_secrets(self):
        with tempfile.TemporaryDirectory(prefix="ops-env-selection-") as directory:
            target = Path(directory)
            shutil.copyfile(ROOT / "compose.yml", target / "compose.yml")
            (target / ".env").write_text("ALERT_CHANNEL=none\nPROBE_CATALOG_URL=https://old.example.invalid/catalog\n")
            values = {
                "BACKUP_DB_NAME": "fixture", "BACKUP_DB_USER": "backup", "BACKUP_DB_PASSWORD": "private-backup",
                "RESTIC_REPOSITORY": "/fixture", "RESTIC_PASSWORD": "private-repository",
                "GRAFANA_ADMIN_PASSWORD": "private-grafana", "METRICS_DB_USER": "monitor",
                "METRICS_DB_PASSWORD": "private-monitor", "METRICS_REDIS_PASSWORD": "private-redis",
                "APP_NETWORK": "fixture-app", "APP_DATABASE_NETWORK": "fixture-db", "APP_UPLOADS_VOLUME": "fixture-uploads",
                "PROBE_CATALOG_URL": "https://selected.example.invalid/catalog",
                "PROBE_COMMUNITY_URL": "https://selected.example.invalid/posts",
                "PROBE_ADMIN_URL": "https://admin.example.invalid/login",
                "PUBLIC_HEALTH_URL": "http://selected-api:3000/health",
                "ALERT_CHANNEL": "webhook", "ALERT_WEBHOOK_URL": "https://notify.example.invalid/hook",
                "BACKUP_MAX_AGE_SECONDS": "1200", "MONITOR_HOST": "true",
            }
            selected = target / ".env.server"
            selected.write_text("".join(f"{key}={value}\n" for key, value in values.items()))
            result = subprocess.run(["docker", "compose", "--env-file", str(selected), "-f", str(target / "compose.yml"), "--profile", "tools", "config", "--format", "json"], capture_output=True, text=True,
                env={"PATH": os.environ["PATH"], "HOME": os.environ["HOME"], "PROBE_CATALOG_URL": "https://shell.example.invalid/catalog"}, check=True)
            model = json.loads(result.stdout)
            env = {key: value for key, value in model["services"]["configure"]["environment"].items() if value is not None}
            status = model["services"]["status"]
            kuma = model["services"]["uptime-kuma"]
            self.assertEqual(status["environment"]["STATUS_PUBLIC_ENABLED"], "false")
            self.assertEqual(status["ports"][0]["host_ip"], "127.0.0.1")
            self.assertEqual(kuma["ports"][0]["host_ip"], "127.0.0.1")
            self.assertEqual(set(status["networks"]), {"status-private", "status-edge"})
            self.assertEqual(set(kuma["networks"]), {"status-private", "app"})
            self.assertTrue(model["networks"]["status-private"]["internal"])
            self.assertTrue(status["read_only"])
            self.assertEqual(status["tmpfs"], ["/tmp:uid=101,gid=101,mode=0700"])
            self.assertEqual(kuma["user"], "1000:1000")
            self.assertEqual(set(kuma["environment"]), {"UPTIME_KUMA_DB_TYPE"})
            self.assertEqual(kuma["volumes"][0]["source"], "kuma-data")
            self.assertTrue(model["services"]["configure"]["build"]["context"].endswith("/configure"))
            config = render.configuration(env)
            probe = config["prometheus.yml"]["scrape_configs"][0]["static_configs"][0]["targets"][0]
            self.assertEqual(probe, "https://shell.example.invalid/catalog")
            self.assertEqual(config["alertmanager.yml"]["receivers"][0]["webhook_configs"][0]["url"], values["ALERT_WEBHOOK_URL"])
            self.assertTrue(any(job["job_name"] == "host" for job in config["prometheus.yml"]["scrape_configs"]))
            self.assertNotIn("RESTIC_PASSWORD", env)
            self.assertNotIn("BACKUP_DB_PASSWORD", env)
            self.assertNotIn("GRAFANA_ADMIN_PASSWORD", env)
            self.assertEqual(env["PUBLIC_HEALTH_URL"], values["PUBLIC_HEALTH_URL"])
            self.assertEqual(env["BACKUP_MAX_AGE_SECONDS"], "1200")
