"""
文本编码器
"""

from sentence_transformers import SentenceTransformer
import torch
import numpy as np
from typing import List, Union
import logging

logger = logging.getLogger(__name__)


class TextEncoder:
    """文本编码器 - 使用 Sentence Transformers"""
    
    def __init__(self, 
                 model_name: str = 'sentence-transformers/paraphrase-multilingual-mpnet-base-v2',
                 device: str = None):
        """
        初始化文本编码器
        
        Args:
            model_name: 模型名称
            device: 计算设备 ('cpu', 'cuda', None=自动检测)
        """
        self.model_name = model_name
        self.device = device if device else ('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = None
        self._load_model()
    
    def _load_model(self):
        """加载模型"""
        logger.info(f"Loading text model: {self.model_name}")
        self.model = SentenceTransformer(self.model_name)
        self.model.to(self.device)
        logger.info(f"Text model loaded (dim: {self.dimension}, device: {self.device})")
    
    @property
    def dimension(self) -> int:
        """获取嵌入维度"""
        return self.model.get_sentence_embedding_dimension()
    
    def encode(self, 
               texts: Union[str, List[str]], 
               batch_size: int = 32,
               show_progress: bool = False) -> np.ndarray:
        """
        编码文本为向量
        
        Args:
            texts: 单个文本或文本列表
            batch_size: 批处理大小
            show_progress: 是否显示进度条
            
        Returns:
            嵌入向量 (dim,) 或 (N, dim)
        """
        with torch.no_grad():
            embeddings = self.model.encode(
                texts,
                convert_to_numpy=True,
                batch_size=batch_size,
                show_progress_bar=show_progress,
                device=self.device
            )
        
        return embeddings
    
    def get_info(self) -> dict:
        """获取编码器信息"""
        return {
            'model_name': self.model_name,
            'dimension': self.dimension,
            'device': self.device,
        }

