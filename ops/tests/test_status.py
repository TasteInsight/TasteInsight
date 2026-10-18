import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("status", Path(__file__).parents[1] / "status/server.py")
status = importlib.util.module_from_spec(spec)
spec.loader.exec_module(status)

class StatusTests(unittest.TestCase):
    def test_only_public_keys_and_fresh_samples(self):
        rows = [{"metric": {"job":"public-probes", "service": "catalog", "instance": "secret.internal", "password": "secret"}, "value": [1000, "1"]}]
        rows.append({"metric":{"job":"internal-health","service":"public-api"},"value":[1000,"1"]})
        result = status.project(rows, 1020)
        self.assertEqual(result[0], {"id": "catalog", "name": "菜品与食堂", "status": "operational"})
        self.assertNotIn("secret", str(result))
        self.assertEqual(result[1]["status"], "unknown")
        self.assertEqual(status.project(rows, 1200)[0]["status"], "unknown")

    def test_failure_missing_and_invalid_data(self):
        for value, expected in [("0", "disrupted"), ("NaN", "unknown"), ("2", "unknown")]:
            self.assertEqual(status.project([{"metric": {"job":"public-probes", "service": "catalog"}, "value": [1000,value]}], 1001)[0]["status"], expected)
        self.assertTrue(all(x["status"] == "unknown" for x in status.project([], 1000)))

    def test_admin_frontend_up_api_down_is_disrupted(self):
        rows = [{"metric":{"job":"public-probes","service":"admin"},"value":[1000,"1"]}, {"metric":{"job":"internal-health","service":"admin-api"},"value":[1000,"0"]}]
        self.assertEqual(status.project(rows,1001)[2]["status"], "disrupted")
        self.assertEqual(status.project(rows[:1],1001)[2]["status"], "unknown")

    def test_duplicate_series_fail_closed(self):
        row = {"metric": {"job":"public-probes", "service": "catalog"}, "value": [1000, "1"]}
        self.assertEqual(status.project([row,row],1001)[0]["status"], "unknown")

if __name__ == "__main__": unittest.main()
