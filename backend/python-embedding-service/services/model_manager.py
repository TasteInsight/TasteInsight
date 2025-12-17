"""
模型管理器 - 统一管理所有嵌入模型
"""

import os
import torch
import logging
from typing import Dict, Optional
from models import BaseEmbeddingModel, ConcatModel, FusionModel

logger = logging.getLogger(__name__)


class ModelManager:
    """模型管理器 - 负责加载、缓存和管理不同版本的模型"""
    
    def __init__(self, 
                 device: str = None,
                 model_dir: str = 'saved_models',
                 default_version: str = 'v2'):
        """
        初始化模型管理器
        
        Args:
            device: 计算设备
            model_dir: 模型文件目录
            default_version: 默认版本
        """
        self.device = device if device else ('cuda' if torch.cuda.is_available() else 'cpu')
        self.model_dir = model_dir
        self.default_version = default_version
        self._models: Dict[str, BaseEmbeddingModel] = {}
        self._model_config = self._get_model_config()
        
        logger.info(f"ModelManager initialized (device: {self.device}, default: {default_version})")
    
    def _get_model_config(self) -> Dict:
        """获取模型配置"""
        return {
            'v2': {
                'class': ConcatModel,
                'params': {'text_dim': 768, 'numeric_dim': 20},
                'checkpoint': None,  # 不需要
            },
            'v3': {
                'class': FusionModel,
                'params': {'text_dim': 768, 'numeric_dim': 20, 'output_dim': 256, 'device': self.device},
                'checkpoint': os.path.join(self.model_dir, 'fusion_v3.pt'),
            },
            # 未来可以添加更多版本
        }
    
    def get_model(self, version: str = None) -> BaseEmbeddingModel:
        """
        获取指定版本的模型（带缓存）
        
        Args:
            version: 模型版本，None 使用默认版本
            
        Returns:
            模型实例
        """
        if version is None:
            version = self.default_version
        
        # 检查缓存
        if version in self._models:
            return self._models[version]
        
        # 加载模型
        model = self._load_model(version)
        self._models[version] = model
        
        return model
    
    def _load_model(self, version: str) -> BaseEmbeddingModel:
        """
        加载模型
        
        Args:
            version: 模型版本
            
        Returns:
            模型实例
        """
        if version not in self._model_config:
            raise ValueError(f"Unsupported version: {version}. Available: {list(self._model_config.keys())}")
        
        config = self._model_config[version]
        
        logger.info(f"Loading model: {version}")
        
        # 创建模型实例
        model_class = config['class']
        model = model_class(**config['params'])
        
        # 加载权重（如果有）
        checkpoint_path = config.get('checkpoint')
        if checkpoint_path and os.path.exists(checkpoint_path):
            if hasattr(model, 'load_weights'):
                try:
                    model.load_weights(checkpoint_path)
                    logger.info(f"✓ Loaded checkpoint: {checkpoint_path}")
                except Exception as e:
                    logger.warning(f"Failed to load checkpoint: {e}")
        elif checkpoint_path:
            logger.warning(f"Checkpoint not found: {checkpoint_path}")
        
        logger.info(f"Model {version} ready: {model.get_info()}")
        
        return model
    
    def get_supported_versions(self) -> list:
        """获取支持的版本列表"""
        return list(self._model_config.keys())
    
    def get_model_info(self, version: str = None) -> Dict:
        """获取模型信息"""
        if version is None:
            # 返回所有版本信息
            return {
                ver: self._model_config[ver]['class'](**self._model_config[ver]['params']).get_info()
                for ver in self._model_config.keys()
            }
        else:
            model = self.get_model(version)
            return model.get_info()
    
    def validate_version(self, version: str) -> bool:
        """验证版本是否支持"""
        return version in self._model_config
    
    def preload_models(self, versions: list = None):
        """预加载模型"""
        if versions is None:
            versions = self.get_supported_versions()
        
        for version in versions:
            try:
                self.get_model(version)
            except Exception as e:
                logger.error(f"Failed to preload {version}: {e}")

