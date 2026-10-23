"""Real PyTorch loading and HTTP contract tests using synthetic checkpoints."""
import importlib
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import torch
from models.fusion import FeatureFusionMLP
from services.model_manager import ModelManager
from services.ranking_service import RankingService, FEATURE_SCHEMA, INPUT_DIM
from train.train_ranker import split_samples


class ModelContractTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)

    def tearDown(self):
        self.directory.cleanup()

    def checkpoint(self, version='rank-v1', schema=FEATURE_SCHEMA):
        path = self.root / 'rank.pt'
        model = torch.nn.Linear(INPUT_DIM, 1)
        torch.save({'version': version, 'featureSchemaVersion': schema, 'model_state_dict': model.state_dict()}, path)
        return path

    def test_missing_and_corrupt_fusion_weights_never_ready_or_cached(self):
        manager = ModelManager(device='cpu', model_dir=str(self.root))
        with self.assertRaises(FileNotFoundError):
            manager.get_model('v3')
        self.assertNotIn('v3', manager._models)
        (self.root / 'fusion_v3.pt').write_bytes(b'invalid checkpoint')
        with self.assertRaises(Exception):
            manager.get_model('v3')
        self.assertNotIn('v3', manager._models)
        self.assertFalse(manager.get_model_info()['v3']['ready'])
        self.assertTrue(manager.get_model_info()['v2']['ready'])

    def test_fusion_loads_complete_checkpoint_and_rejects_nonfinite_weights(self):
        model = FeatureFusionMLP()
        path = self.root / 'fusion_v3.pt'
        torch.save({'model_state_dict': model.state_dict()}, path)
        manager = ModelManager(device='cpu', model_dir=str(self.root))
        self.assertEqual(manager.get_model('v3').dimension, 256)
        state = model.state_dict()
        state['text_proj.0.weight'][0, 0] = float('nan')
        torch.save({'model_state_dict': state}, path)
        with self.assertRaises(ValueError):
            ModelManager(device='cpu', model_dir=str(self.root)).get_model('v3')

    def test_ranker_requires_weights_and_exact_schema_version_shape(self):
        with self.assertRaises(FileNotFoundError):
            RankingService(str(self.root / 'missing')).get_model_identity()
        for version, schema in [('wrong', FEATURE_SCHEMA), ('rank-v1', 'wrong')]:
            path = self.checkpoint(version, schema)
            with self.assertRaises(ValueError):
                RankingService(str(path)).get_model_identity()
        path = self.checkpoint()
        data = torch.load(path, weights_only=True)
        data['model_state_dict']['weight'] = torch.ones(1, 2)
        torch.save(data, path)
        with self.assertRaises(RuntimeError):
            RankingService(str(path)).get_model_identity()

    def test_identity_uses_weights_and_ignores_claimed_digest(self):
        path = self.checkpoint()
        first = RankingService(str(path)).get_model_identity()
        data = torch.load(path, weights_only=True)
        data['artifactDigest'] = 'pretend-real-production-model'
        torch.save(data, path)
        self.assertEqual(first, RankingService(str(path)).get_model_identity())
        data['model_state_dict']['weight'][0, 0] += 1
        torch.save(data, path)
        self.assertNotEqual(first['artifactDigest'], RankingService(str(path)).get_model_identity()['artifactDigest'])

    def test_temporal_split_keeps_delivery_together_and_rejects_conflicting_snapshot(self):
        rows = [dict(deliveryId='a', deliveredAt='2026-01-01T00:00:00Z', candidate={'dishId': 'd1'}, label=1),
                dict(deliveryId='a', deliveredAt='2026-01-01T00:00:00Z', candidate={'dishId': 'd2'}, label=0),
                dict(deliveryId='b', deliveredAt='2026-01-02T00:00:00Z', candidate={'dishId': 'd1'}, label=1)]
        train, val = split_samples(rows, '2026-01-02T00:00:00Z')
        self.assertEqual([row['deliveryId'] for row in train], ['a', 'a'])
        self.assertEqual([row['deliveryId'] for row in val], ['b'])
        rows[1]['labelWindowEnd'] = '2026-01-03T00:00:00Z'
        train, val = split_samples(rows, '2026-01-02T00:00:00Z')
        self.assertEqual(len(train), 1)
        rows[1]['deliveredAt'] = '2026-01-03T00:00:00Z'
        with self.assertRaises(ValueError):
            split_samples(rows, '2026-01-02T00:00:00Z')

    def test_http_rank_contract_and_unavailable_embedding(self):
        with patch.dict(os.environ, {'PYTHON_EMBEDDING_ENABLED': 'false', 'PYTHON_EMBEDDING_TOKEN': 'secret'}):
            import config
            importlib.reload(config)
            import app
            importlib.reload(app)
            app.ranking_service = RankingService(str(self.checkpoint()))
            client = app.app.test_client()
            headers = {'Authorization': 'Bearer secret'}
            self.assertEqual(client.get('/model-info/rank-v1').status_code, 401)
            self.assertEqual(client.get('/health').status_code, 200)
            info = client.get('/model-info/rank-v1', headers=headers).get_json()
            values = dict(price=10, spicyLevel=2, sweetness=1, saltiness=3, oiliness=2, averageRating=4, reviewCount=10)
            body = {**info, 'user': values, 'candidates': [{'dishId': 'a', **values}, {'dishId': 'b', **values}]}
            response = client.post('/rank', json=body, headers=headers)
            self.assertEqual(response.status_code, 200)
            self.assertEqual({item['dishId'] for item in response.get_json()['scores']}, {'a', 'b'})
            for override in [{'version': 'wrong'}, {'artifactDigest': 'wrong'}, {'featureSchemaVersion': 'wrong'}, {'candidates': [body['candidates'][0]] * 2}]:
                self.assertEqual(client.post('/rank', json={**body, **override}, headers=headers).status_code, 400)
            self.assertEqual(client.get('/model-info/v3', headers=headers).status_code, 503)
            app.ranking_service = RankingService(str(self.root / 'missing'))
            self.assertFalse(client.get('/model-info/rank-v1', headers=headers).get_json()['ready'])
            self.assertEqual(client.get('/health').status_code, 503)

    def test_real_local_text_encoder_embeds_with_bound_identity(self):
        # Small local SentenceTransformer fixture exercises serialization without a model download.
        from sentence_transformers import SentenceTransformer, models
        from services.embedding_service import EmbeddingService
        text_path = self.root / 'text'
        SentenceTransformer(modules=[models.BoW(['rice'] + [f'word{i}' for i in range(767)])]).save(str(text_path))
        service = EmbeddingService(text_model_name=str(text_path), device='cpu', model_dir=str(self.root))
        identity = service.get_model_identity('v2')
        vector = service.generate_embedding('rice', {}, 'v2')
        self.assertEqual(identity['dimension'], len(vector))
        self.assertEqual(len(vector), 788)
        second = EmbeddingService(text_model_name=str(text_path), device='cpu', model_dir=str(self.root))
        self.assertEqual(identity, second.get_model_identity('v2'))
        changed_path = self.root / 'changed-text'
        SentenceTransformer(modules=[models.BoW(['noodles'] + [f'word{i}' for i in range(767)])]).save(str(changed_path))
        changed = EmbeddingService(text_model_name=str(changed_path), device='cpu', model_dir=str(self.root))
        self.assertNotEqual(identity['artifactDigest'], changed.get_model_identity('v2')['artifactDigest'])
        with patch.dict(os.environ, {'PYTHON_EMBEDDING_ENABLED': 'false', 'PYTHON_EMBEDDING_TOKEN': 'secret'}):
            import config
            importlib.reload(config)
            import app
            importlib.reload(app)
        app.embedding_service = service
        client = app.app.test_client()
        headers = {'Authorization': 'Bearer secret'}
        response = client.post('/embed', json={'version': 'v2', 'text': 'rice', 'features': {}, **identity}, headers=headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['artifactDigest'], identity['artifactDigest'])
        self.assertEqual(len(response.get_json()['embedding']), 788)
        rejected = client.post('/embed', json={'version': 'v2', 'text': 'rice', 'artifactDigest': 'wrong'}, headers=headers)
        self.assertNotEqual(rejected.status_code, 200)
        app.embedding_service = None
