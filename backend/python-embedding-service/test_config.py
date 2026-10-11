"""Unit tests for embedding-service environment parsing."""

import os
import sys
import unittest
from unittest.mock import patch


class ConfigTest(unittest.TestCase):
    def load_config(self, values=None):
        with patch.dict(
            os.environ,
            values or {},
            clear=True,
        ):
            sys.modules.pop('config', None)
            from config import Config

            return Config

    def tearDown(self):
        sys.modules.pop('config', None)

    def test_empty_preload_value_disables_preloading(self):
        config = self.load_config({'PYTHON_EMBEDDING_PRELOAD_MODELS': ''})

        self.assertEqual(config.PRELOAD_MODELS, [])

    def test_preload_versions_are_trimmed_and_empty_items_are_ignored(self):
        config = self.load_config({'PYTHON_EMBEDDING_PRELOAD_MODELS': ' v2, ,v3 '})

        self.assertEqual(config.PRELOAD_MODELS, ['v2', 'v3'])

    def test_omitted_settings_keep_standalone_defaults(self):
        config = self.load_config()
        self.assertEqual(config.HOST, '0.0.0.0')
        self.assertEqual(config.PORT, 5001)
        self.assertFalse(config.DEBUG)
        self.assertEqual(config.TEXT_MODEL, 'sentence-transformers/paraphrase-multilingual-mpnet-base-v2')
        self.assertEqual(config.DEFAULT_VERSION, 'v2')
        self.assertIsNone(config.DEVICE)
        self.assertEqual(config.PRELOAD_MODELS, ['v2', 'v3'])

    def test_empty_optional_model_settings_keep_the_same_defaults(self):
        config = self.load_config({
            'PYTHON_EMBEDDING_TEXT_MODEL': '',
            'PYTHON_EMBEDDING_DEFAULT_VERSION': '',
            'PYTHON_EMBEDDING_DEVICE': '',
        })
        self.assertEqual(config.TEXT_MODEL, 'sentence-transformers/paraphrase-multilingual-mpnet-base-v2')
        self.assertEqual(config.DEFAULT_VERSION, 'v2')
        self.assertIsNone(config.DEVICE)

    def test_default_model_directory_resolves_to_the_container_volume(self):
        config = self.load_config()
        with patch('os.getcwd', return_value='/app'):
            self.assertEqual(os.path.abspath(config.MODEL_DIR), '/app/saved_models')

    def test_explicit_model_and_device_choices_are_preserved(self):
        config = self.load_config({
            'PYTHON_EMBEDDING_TEXT_MODEL': 'organization/custom-encoder',
            'PYTHON_EMBEDDING_DEFAULT_VERSION': 'v3',
            'PYTHON_EMBEDDING_MODEL_DIR': '/srv/model-weights',
            'PYTHON_EMBEDDING_DEVICE': 'cpu',
            'PYTHON_EMBEDDING_PRELOAD_MODELS': 'v3',
        })
        self.assertEqual(config.TEXT_MODEL, 'organization/custom-encoder')
        self.assertEqual(config.DEFAULT_VERSION, 'v3')
        self.assertEqual(config.MODEL_DIR, '/srv/model-weights')
        self.assertEqual(config.DEVICE, 'cpu')
        self.assertEqual(config.PRELOAD_MODELS, ['v3'])


if __name__ == '__main__':
    unittest.main()
