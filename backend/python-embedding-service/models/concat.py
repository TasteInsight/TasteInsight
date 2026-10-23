"""
Concat 模型 (v2)
简单拼接文本和数值特征
"""

import numpy as np
from typing import Dict, Any
from .base import BaseEmbeddingModel
from model_parameters import resolve_parameters


class ConcatModel(BaseEmbeddingModel):
    """拼接模型 - 简单拼接文本和数值特征"""
    
    parameter_schema = {
        'type': 'object', 'additionalProperties': False,
        'properties': {
            'numericWeight': {
                'type': 'number', 'title': '数值特征权重',
                'description': '拼接前缩放数值特征；0 表示仅使用文本特征。',
                'default': 1, 'minimum': 0, 'maximum': 5,
            },
        },
    }

    def __init__(self, text_dim=768, numeric_dim=20):
        super().__init__()
        self.version = 'v2'
        self.text_dim = text_dim
        self.numeric_dim = numeric_dim
        self.dimension = text_dim + numeric_dim  # 788
        self.requires_training = False
        self.description = '文本+数值简单拼接'
    
    def get_info(self) -> Dict[str, Any]:
        info = super().get_info()
        info.update({
            'text_dim': self.text_dim,
            'numeric_dim': self.numeric_dim,
            'method': 'concatenation',
        })
        return info
    
    def generate_embedding(self, text_emb: np.ndarray, numeric_emb: np.ndarray, parameters: Dict = None) -> np.ndarray:
        """
        拼接并归一化
        
        Args:
            text_emb: (N, 768) 或 (768,)
            numeric_emb: (N, 20) 或 (20,)
            
        Returns:
            (N, 788) 或 (788,)
        """
        applied = resolve_parameters(self.parameter_schema, {} if parameters is None else parameters)
        numeric_emb = numeric_emb * applied['numericWeight']

        # 拼接
        if text_emb.ndim == 1 and numeric_emb.ndim == 1:
            # 单个样本
            hybrid = np.concatenate([text_emb, numeric_emb])
        else:
            # 批量
            hybrid = np.concatenate([text_emb, numeric_emb], axis=1)
        
        # L2 归一化
        if hybrid.ndim == 1:
            norm = np.linalg.norm(hybrid)
            if norm > 0:
                hybrid = hybrid / norm
        else:
            norms = np.linalg.norm(hybrid, axis=1, keepdims=True)
            norms[norms == 0] = 1
            hybrid = hybrid / norms
        
        return hybrid
    
    def get_trainable_model(self):
        """Concat 模型不需要训练"""
        return None

