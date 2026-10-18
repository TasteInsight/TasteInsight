import importlib.util
import unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location("render",Path(__file__).parents[1]/"render.py")
render=importlib.util.module_from_spec(spec);spec.loader.exec_module(render)

class ConfigTests(unittest.TestCase):
    def env(self):
        return {"PROBE_CATALOG_URL":"https://example.com/canteens", "PROBE_COMMUNITY_URL":"https://example.com/posts", "PROBE_ADMIN_URL":"https://admin.example.com/login"}
    def test_disabled_delivery_is_explicitly_alerted(self):
        config=render.configuration(self.env())
        rules=config["alerts.yml"]["groups"][0]["rules"]
        self.assertEqual(next(x for x in rules if x["alert"]=="AlertDeliveryDisabled")["expr"],"vector(1) == 1")
        self.assertTrue(any("absent(" in x["expr"] for x in rules if x["alert"]=="BackupOverdue"))
    def test_webhook_and_email_must_be_complete(self):
        for channel in ["webhook","email","unknown"]:
            with self.assertRaises(ValueError):render.configuration({**self.env(),"ALERT_CHANNEL":channel})
    def test_rejects_credentials_in_public_probe_urls(self):
        with self.assertRaises(ValueError):render.configuration({**self.env(),"PROBE_CATALOG_URL":"https://user:secret@example.com"})
    def test_webhook_is_private_and_json_encoded(self):
        config=render.configuration({**self.env(),"ALERT_CHANNEL":"webhook","ALERT_WEBHOOK_URL":"https://notify.example.com/?token=private"})
        self.assertNotIn("private",str(config["prometheus.yml"]))
        self.assertIn("private",str(config["alertmanager.yml"]))

if __name__=="__main__":unittest.main()
