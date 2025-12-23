"""
数值特征编码器
"""

import numpy as np
from typing import Dict, Union, List


class NumericEncoder:
    """数值特征编码器 - 将字典转换为固定长度向量"""
    
    def __init__(self, dimension: int = 20):
        """
        初始化数值编码器
        
        Args:
            dimension: 输出向量维度
        """
        self.dimension = dimension
    
    def encode(self, features: Union[Dict, List[Dict]]) -> np.ndarray:
        """
        编码数值特征
        
        Args:
            features: 单个特征字典或特征字典列表
            
        Returns:
            (dim,) 或 (N, dim)
        """
        if isinstance(features, dict):
            return self._encode_single(features)
        else:
            return np.array([self._encode_single(f) for f in features])
    
    def _encode_single(self, features: Dict) -> np.ndarray:
        """
        编码单个特征字典为向量
        
        特征维度分配 (20维):
        - 0-6: 基础特征（价格、口味、评分）
        - 7-10: 交叉特征
        - 11-12: 质量指标
        - 13-19: 预留扩展
        """
        vector = np.zeros(self.dimension)
        
        # 基础特征 (0-6)
        vector[0] = min(1.0, features.get('price', 0) / 50.0)
        vector[1] = features.get('spicyLevel', 0) / 5.0
        vector[2] = features.get('sweetness', 0) / 5.0
        vector[3] = features.get('saltiness', 0) / 5.0
        vector[4] = features.get('oiliness', 0) / 5.0
        vector[5] = features.get('averageRating', 0) / 5.0
        
        review_count = features.get('reviewCount', 0)
        vector[6] = min(1.0, np.log10(review_count + 1) / 3.0) if review_count > 0 else 0
        
        # 交叉特征 (7-10)
        vector[7] = vector[0] * vector[5]  # 价格-评分交互
        vector[8] = vector[1] * vector[2]  # 辣度-甜度交互
        vector[9] = (vector[1] + vector[2] + vector[3] + vector[4]) / 4  # 平均口味强度
        vector[10] = np.std([vector[1], vector[2], vector[3], vector[4]])  # 口味多样性
        
        # 质量指标 (11-12)
        if review_count > 0:
            vector[11] = min(1.0, features.get('averageRating', 0) * np.log10(review_count + 1) / 15)
        vector[12] = 1.0 if review_count >= 50 else review_count / 50.0  # 热度
        
        # 13-19: 预留扩展
        
        return vector
    
    def get_info(self) -> dict:
        """获取编码器信息"""
        return {
            'dimension': self.dimension,
            'features': [
                'price', 'spicyLevel', 'sweetness', 'saltiness', 'oiliness',
                'averageRating', 'reviewCount'
            ],
        }

