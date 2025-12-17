from .base import BaseEmbeddingModel
from .concat import ConcatModel
from .fusion import FeatureFusionMLP, FusionModel

__all__ = [
    'BaseEmbeddingModel',
    'ConcatModel',
    'FusionModel',
    'FeatureFusionMLP',  # 保留用于训练
]

__version__ = '0.1.0'