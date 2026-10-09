"""Unit tests for embedding-service environment parsing."""

import os
import sys
import unittest
from unittest.mock import patch


class ConfigTest(unittest.TestCase):
    def load_config_with_preload_models(self, value: str):
        with patch.dict(
            os.environ,
            {'PYTHON_EMBEDDING_PRELOAD_MODELS': value},
            clear=False,
        ):
            sys.modules.pop('config', None)
            from config import Config

            return Config

    def tearDown(self):
        sys.modules.pop('config', None)

    def test_empty_preload_value_disables_preloading(self):
        config = self.load_config_with_preload_models('')

        self.assertEqual(config.PRELOAD_MODELS, [])

    def test_preload_versions_are_trimmed_and_empty_items_are_ignored(self):
        config = self.load_config_with_preload_models(' v2, ,v3 ')

        self.assertEqual(config.PRELOAD_MODELS, ['v2', 'v3'])


if __name__ == '__main__':
    unittest.main()
