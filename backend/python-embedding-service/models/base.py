"""
基础模型接口
所有嵌入模型都应继承此类
"""

from abc import ABC, abstractmethod
import torch.nn as nn
from typing import Dict, Any
import numpy as np


class BaseEmbeddingModel(ABC):
    """嵌入模型基类"""
    
    def __init__(self):
        self.version = None
        self.dimension = None
        self.requires_training = False
        self.description = ""
    
    @abstractmethod
    def get_info(self) -> Dict[str, Any]:
        """获取模型信息"""
        return {
            'version': self.version,
            'dimension': self.dimension,
            'requires_training': self.requires_training,
            'description': self.description,
        }
    
    @abstractmethod
    def generate_embedding(self, text_emb: np.ndarray, numeric_emb: np.ndarray) -> np.ndarray:
        """
        生成嵌入向量
        
        Args:
            text_emb: 文本嵌入 (N, text_dim)
            numeric_emb: 数值特征 (N, numeric_dim)
            
        Returns:
            嵌入向量 (N, output_dim)
        """
        pass
    
    @abstractmethod
    def get_trainable_model(self):
        """获取可训练的 PyTorch 模型（如果有）"""
        pass

