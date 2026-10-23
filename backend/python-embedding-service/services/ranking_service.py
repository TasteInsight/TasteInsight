"""固定数值契约的 PyTorch 逻辑回归排序器。"""
from pathlib import Path
import math
from copy import deepcopy
from model_parameters import resolve_parameters
import torch
from services.artifact_identity import identity_digest, source_digest, state_digest

FEATURE_SCHEMA = 'ranking-numeric-v1'
FEATURE_NAMES = ('price', 'spicyLevel', 'sweetness', 'saltiness', 'oiliness', 'averageRating', 'reviewCount')
SCALES = (50.0, 5.0, 5.0, 5.0, 5.0, 5.0, 1000.0)
INPUT_DIM = len(FEATURE_NAMES) * 2


def pair_features(user, candidate):
    """菜品属性与用户属性差值；训练与在线推理共用。"""
    dish_values, differences = [], []
    for name, scale in zip(FEATURE_NAMES, SCALES):
        left, right = user[name], candidate[name]
        if isinstance(left, bool) or isinstance(right, bool) or not isinstance(left, (int, float)) or not isinstance(right, (int, float)):
            raise ValueError(f'Numeric feature required: {name}')
        if not math.isfinite(left) or not math.isfinite(right):
            raise ValueError(f'Non-finite feature: {name}')
        dish_values.append(right / scale)
        differences.append(abs(right - left) / scale)
    return dish_values + differences


class RankingService:
    parameter_schema = {
        'type': 'object', 'additionalProperties': False,
        'properties': {
            'temperature': {
                'type': 'number', 'title': '温度',
                'description': '缩放 sigmoid 前的分数；值越大，概率越接近 0.5。',
                'default': 1, 'minimum': 0.25, 'maximum': 4,
            },
            'pricePenalty': {
                'type': 'number', 'title': '价格惩罚系数',
                'description': '按菜品价格除以 50 后扣减分数，控制价格对排序的影响。',
                'default': 0, 'minimum': 0, 'maximum': 2,
            },
        },
    }

    def __init__(self, checkpoint_path, version='rank-v1'):
        self.checkpoint_path = checkpoint_path
        self.version = version
        self.model = None
        self.identity = None

    def get_model_identity(self):
        if self.model is None:
            checkpoint = torch.load(self.checkpoint_path, map_location='cpu', weights_only=True)
            if checkpoint.get('featureSchemaVersion') != FEATURE_SCHEMA:
                raise ValueError('Ranking feature schema mismatch')
            if checkpoint.get('version') != self.version:
                raise ValueError('Ranking checkpoint version mismatch')
            model = torch.nn.Linear(INPUT_DIM, 1)
            model.load_state_dict(checkpoint['model_state_dict'], strict=True)
            if not all(torch.isfinite(value).all() for value in model.state_dict().values()):
                raise ValueError('Ranking checkpoint contains non-finite weights')
            model.eval()
            digest = identity_digest({
                'version': self.version, 'schema': FEATURE_SCHEMA,
                'weights': state_digest(model.state_dict()),
                'parameterSchema': self.parameter_schema,
                'implementation': source_digest(__file__, Path(__file__).with_name('artifact_identity.py'),
                                                Path(__file__).resolve().parents[1] / 'model_parameters.py'),
            })
            self.identity = {'ready': True, 'kind': 'ranking', 'version': self.version,
                             'artifactDigest': digest, 'featureSchemaVersion': FEATURE_SCHEMA,
                             'parameterSchema': deepcopy(self.parameter_schema)}
            self.model = model
        return deepcopy(self.identity)

    def rank(self, user, candidates, parameters=None):
        applied = resolve_parameters(self.parameter_schema, {} if parameters is None else parameters)
        self.get_model_identity()
        ids = [candidate['dishId'] for candidate in candidates]
        if any(not isinstance(value, str) or not value for value in ids) or len(set(ids)) != len(ids):
            raise ValueError('Candidates require distinct dishId values')
        if not candidates:
            return []
        values = torch.tensor([pair_features(user, item) for item in candidates], dtype=torch.float32)
        with torch.no_grad():
            logits = self.model(values).flatten()
            logits = (logits - applied['pricePenalty'] * values[:, 0]) / applied['temperature']
            scores = torch.sigmoid(logits).tolist()
        if not all(math.isfinite(score) for score in scores):
            raise ValueError('Ranking produced non-finite scores')
        return [{'dishId': dish_id, 'score': score} for dish_id, score in zip(ids, scores)]
