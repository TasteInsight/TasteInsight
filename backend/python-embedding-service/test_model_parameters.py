"""Parameter contracts exercised with real local model weights and encoders."""
from copy import deepcopy
import importlib
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import numpy as np
import torch
from sentence_transformers import SentenceTransformer, models
from model_parameters import EMPTY_PARAMETER_SCHEMA, resolve_parameters
from models.concat import ConcatModel
from models.fusion import FeatureFusionMLP
from services.embedding_service import EmbeddingService
from services.ranking_service import FEATURE_SCHEMA, INPUT_DIM, RankingService, pair_features


class ModelParameterTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory()
        cls.root = Path(cls.directory.name)
        cls.text_path = cls.root / 'text'
        SentenceTransformer(modules=[models.BoW(['rice'] + [f'word{i}' for i in range(767)])]).save(str(cls.text_path))
        torch.save({'model_state_dict': FeatureFusionMLP().state_dict()}, cls.root / 'fusion_v3.pt')
        cls.embedding = EmbeddingService(text_model_name=str(cls.text_path), device='cpu', model_dir=str(cls.root))
        model = torch.nn.Linear(INPUT_DIM, 1)
        with torch.no_grad():
            model.weight.zero_()
            model.weight[0, 0] = 1
            model.bias.fill_(0.25)
        cls.checkpoint = cls.root / 'rank.pt'
        torch.save({'version': 'rank-v1', 'featureSchemaVersion': FEATURE_SCHEMA,
                    'model_state_dict': model.state_dict()}, cls.checkpoint)
        cls.ranking = RankingService(str(cls.checkpoint))
        cls.features = dict(price=10, spicyLevel=2, sweetness=1, saltiness=3,
                            oiliness=2, averageRating=4, reviewCount=10)
        cls.candidates = [{'dishId': 'cheap', **cls.features},
                          {'dishId': 'expensive', **cls.features, 'price': 40}]
        with patch.dict(os.environ, {'PYTHON_EMBEDDING_ENABLED': 'false', 'PYTHON_EMBEDDING_TOKEN': 'secret'}):
            import config
            importlib.reload(config)
            import app
            cls.app = importlib.reload(app)
        cls.app.embedding_service = cls.embedding
        cls.app.ranking_service = cls.ranking
        cls.client = cls.app.app.test_client()
        cls.headers = {'Authorization': 'Bearer secret'}

    @classmethod
    def tearDownClass(cls):
        cls.app.embedding_service = None
        cls.directory.cleanup()

    def post(self, path, body):
        return self.client.post(path, json=body, headers=self.headers)

    def test_rank_defaults_match_original_and_parameters_change_scores_and_order(self):
        baseline = self.ranking.rank(self.features, self.candidates)
        self.assertEqual(baseline, self.ranking.rank(self.features, self.candidates, {'temperature': 1, 'pricePenalty': 0}))
        values = torch.tensor([pair_features(self.features, item) for item in self.candidates])
        with torch.no_grad():
            original = torch.sigmoid(self.ranking.model(values)).flatten().tolist()
        self.assertEqual([item['score'] for item in baseline], original)
        self.assertLess(baseline[0]['score'], baseline[1]['score'])
        penalized = self.ranking.rank(self.features, self.candidates, {'pricePenalty': 2})
        self.assertGreater(penalized[0]['score'], penalized[1]['score'])
        softened = self.ranking.rank(self.features, self.candidates, {'temperature': 4})
        self.assertNotEqual(softened, baseline)
        self.assertLess(abs(softened[1]['score'] - 0.5), abs(baseline[1]['score'] - 0.5))

    def test_embedding_numeric_weight_consumed_with_single_batch_parity(self):
        baseline = self.embedding.generate_embedding('rice', self.features, 'v2')
        original = np.concatenate([self.embedding.text_encoder.encode('rice'), self.embedding.numeric_encoder.encode(self.features)])
        np.testing.assert_array_equal(baseline, original / np.linalg.norm(original))
        np.testing.assert_array_equal(baseline, self.embedding.generate_embedding('rice', self.features, 'v2', {'numericWeight': 1}))
        for weight in (0, 2, 5):
            single = self.embedding.generate_embedding('rice', self.features, 'v2', {'numericWeight': weight})
            batch = self.embedding.generate_embeddings_batch(['rice', 'rice'], [self.features] * 2, 'v2', {'numericWeight': weight})
            np.testing.assert_allclose(batch, [single, single])
            self.assertFalse(np.allclose(single, baseline))
            self.assertAlmostEqual(float(np.linalg.norm(single)), 1)
            if weight == 0:
                np.testing.assert_array_equal(single[768:], np.zeros(20))

    def test_schemas_are_model_specific_and_bound_to_stable_identity(self):
        identity = self.embedding.get_model_identity('v2')
        self.assertEqual(identity['parameterSchema'], ConcatModel.parameter_schema)
        self.assertEqual(self.embedding.get_model_identity('v3')['parameterSchema'], EMPTY_PARAMETER_SCHEMA)
        second = EmbeddingService(text_model_name=str(self.text_path), device='cpu', model_dir=str(self.root))
        self.assertEqual(second.get_model_identity('v2'), identity)
        modified = deepcopy(ConcatModel.parameter_schema)
        modified['properties']['numericWeight']['maximum'] = 4
        with patch.object(ConcatModel, 'parameter_schema', modified):
            changed = EmbeddingService(text_model_name=str(self.text_path), device='cpu', model_dir=str(self.root))
            self.assertNotEqual(changed.get_model_identity('v2')['artifactDigest'], identity['artifactDigest'])
        rank_identity = self.ranking.get_model_identity()
        modified_rank = deepcopy(RankingService.parameter_schema)
        modified_rank['properties']['temperature']['maximum'] = 3
        with patch.object(RankingService, 'parameter_schema', modified_rank):
            self.assertNotEqual(RankingService(str(self.checkpoint)).get_model_identity()['artifactDigest'], rank_identity['artifactDigest'])
        identity['parameterSchema']['properties'].clear()
        self.assertIn('numericWeight', self.embedding.get_model_identity('v2')['parameterSchema']['properties'])

    def test_resolver_preserves_zero_false_enum_and_checks_json_types(self):
        schema = {'type': 'object', 'additionalProperties': False, 'properties': {
            'count': {'type': 'integer', 'title': 'Count', 'default': 1, 'minimum': 0, 'maximum': 2},
            'enabled': {'type': 'boolean', 'title': 'Enabled', 'default': True},
            'mode': {'type': 'string', 'title': 'Mode', 'enum': ['a', 'b'], 'default': 'a'},
        }}
        self.assertEqual(resolve_parameters(schema, {'count': 0, 'enabled': False}), {'count': 0, 'enabled': False, 'mode': 'a'})
        self.assertEqual(resolve_parameters(schema, {'mode': 'b'})['mode'], 'b')
        for value in ({'count': False}, {'count': 1.5}, {'count': -1}, {'count': 3}, {'enabled': 0}, {'mode': 'c'}, {'unknown': 0}, [], None):
            with self.subTest(value=value), self.assertRaises(ValueError):
                resolve_parameters(schema, value)

    def test_all_http_embedding_routes_report_applied_defaults_and_reject_invalid_parameters(self):
        routes = [('/embed', {'text': 'rice', 'features': self.features, 'version': 'v2'}),
                  ('/embed_batch', {'items': [{'text': 'rice', 'features': self.features}], 'version': 'v2'}),
                  ('/embed-batch', {'items': [{'text': 'rice', 'features': self.features}], 'version': 'v2'}),
                  ('/convert_version', {'text': 'rice', 'features': self.features, 'from_version': 'v1', 'to_version': 'v2'})]
        for path, body in routes:
            with self.subTest(path=path):
                baseline = self.post(path, body)
                self.assertEqual(baseline.status_code, 200, baseline.get_json())
                self.assertEqual(baseline.get_json()['appliedParameters'], {'numericWeight': 1})
                response = self.post(path, {**body, 'parameters': {'numericWeight': 0}})
                self.assertEqual(response.status_code, 200, response.get_json())
                self.assertEqual(response.get_json()['parameterSchema'], ConcatModel.parameter_schema)
                self.assertEqual(response.get_json()['appliedParameters'], {'numericWeight': 0})
                vector = response.get_json().get('embedding', response.get_json().get('embeddings', [None])[0])
                np.testing.assert_array_equal(vector[768:], np.zeros(20))
                for parameters in ({'numericWeight': False}, {'numericWeight': '1'}, {'numericWeight': -1},
                                   {'numericWeight': 6}, {'numericWeight': float('nan')}, {'numericWeight': float('inf')}, {'unknown': 1}, [], None):
                    self.assertEqual(self.post(path, {**body, 'parameters': parameters}).status_code, 400, (path, parameters))
        fusion = {'text': 'rice', 'version': 'v3'}
        self.assertEqual(self.post('/embed', fusion).get_json()['appliedParameters'], {})
        self.assertEqual(self.post('/embed', {**fusion, 'parameters': {'numericWeight': 1}}).status_code, 400)

    def test_http_ranking_reports_complete_parameters_and_real_score_changes(self):
        identity = self.client.get('/model-info/rank-v1', headers=self.headers).get_json()
        body = {**identity, 'user': self.features, 'candidates': self.candidates}
        baseline = self.post('/rank', body).get_json()
        self.assertEqual(baseline['appliedParameters'], {'temperature': 1, 'pricePenalty': 0})
        response = self.post('/rank', {**body, 'parameters': {'pricePenalty': 2}})
        self.assertEqual(response.status_code, 200)
        result = response.get_json()
        self.assertEqual(result['appliedParameters'], {'temperature': 1, 'pricePenalty': 2})
        self.assertGreater(result['scores'][0]['score'], result['scores'][1]['score'])
        self.assertNotEqual(result['scores'], baseline['scores'])
        for parameters in ({'temperature': 0}, {'temperature': 5}, {'temperature': False}, {'pricePenalty': False},
                           {'pricePenalty': -1}, {'pricePenalty': 3}, {'temperature': '1'}, {'temperature': float('nan')}, {'unknown': 1}, [], None):
            self.assertEqual(self.post('/rank', {**body, 'parameters': parameters}).status_code, 400, parameters)
