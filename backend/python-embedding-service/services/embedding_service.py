"""
嵌入服务 - 统一的嵌入生成接口
"""

import numpy as np
import logging
from typing import Dict, List, Union
from encoders import TextEncoder, NumericEncoder
from services.model_manager import ModelManager

logger = logging.getLogger(__name__)


class EmbeddingService:
    """嵌入服务 - 协调文本编码器、数值编码器和模型"""
    
    def __init__(self, 
                 text_model_name: str = 'sentence-transformers/paraphrase-multilingual-mpnet-base-v2',
                 device: str = None,
                 model_dir: str = 'models',
                 default_version: str = 'v2'):
        """
        初始化嵌入服务
        
        Args:
            text_model_name: 文本模型名称
            device: 计算设备
            model_dir: 模型文件目录
            default_version: 默认版本
        """
        self.text_encoder = TextEncoder(model_name=text_model_name, device=device)
        self.numeric_encoder = NumericEncoder(dimension=20)
        self.model_manager = ModelManager(device=device, model_dir=model_dir, default_version=default_version)
        
        logger.info("EmbeddingService initialized")
    
    def generate_embedding(self, 
                          text: str, 
                          features: Dict,
                          version: str = None) -> np.ndarray:
        """
        生成单个嵌入
        
        Args:
            text: 文本内容
            features: 数值特征字典
            version: 模型版本（None 使用默认版本）
            
        Returns:
            嵌入向量 (dim,)
        """
        # 1. 编码文本
        text_emb = self.text_encoder.encode(text)
        
        # 2. 编码数值特征
        numeric_emb = self.numeric_encoder.encode(features)
        
        # 3. 获取模型并生成嵌入
        model = self.model_manager.get_model(version)
        embedding = model.generate_embedding(text_emb, numeric_emb)
        
        return embedding
    
    def generate_embeddings_batch(self,
                                  texts: List[str],
                                  features_list: List[Dict],
                                  version: str = None) -> np.ndarray:
        """
        批量生成嵌入
        
        Args:
            texts: 文本列表
            features_list: 特征字典列表
            version: 模型版本
            
        Returns:
            嵌入向量数组 (N, dim)
        """
        if len(texts) != len(features_list):
            raise ValueError("texts and features_list must have same length")
        
        # 1. 批量编码文本
        text_embs = self.text_encoder.encode(texts)
        
        # 2. 批量编码数值特征
        numeric_embs = self.numeric_encoder.encode(features_list)
        
        # 3. 获取模型并生成嵌入
        model = self.model_manager.get_model(version)
        embeddings = model.generate_embedding(text_embs, numeric_embs)
        
        return embeddings
    
    def convert_version(self,
                       text: str,
                       features: Dict,
                       from_version: str,
                       to_version: str) -> np.ndarray:
        """
        转换嵌入版本
        
        注意：需要原始文本和特征，不支持从嵌入向量直接转换
        
        Args:
            text: 原始文本
            features: 数值特征
            from_version: 源版本（用于验证）
            to_version: 目标版本
            
        Returns:
            新版本的嵌入向量
        """
        # 验证版本升级顺序
        version_order = {'v1': 1, 'v2': 2, 'v3': 3}
        if to_version in version_order and from_version in version_order:
            if version_order[to_version] <= version_order[from_version]:
                raise ValueError("Only upgrade is supported (v1->v2->v3)")
        
        # 直接生成目标版本的嵌入
        return self.generate_embedding(text, features, to_version)
    
    def get_service_info(self) -> Dict:
        """获取服务信息"""
        return {
            'text_encoder': self.text_encoder.get_info(),
            'numeric_encoder': self.numeric_encoder.get_info(),
            'supported_versions': self.model_manager.get_supported_versions(),
            'default_version': self.model_manager.default_version,
            'models': self.model_manager.get_model_info(),
        }
    
    def validate_version(self, version: str) -> bool:
        """验证版本"""
        return self.model_manager.validate_version(version)
    
    def preload_models(self, versions: list = None):
        """预加载模型"""
        self.model_manager.preload_models(versions)

