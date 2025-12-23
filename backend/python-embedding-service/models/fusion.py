"""
Fusion 模型 (v3)
神经网络融合文本和数值特征
"""

import torch
import torch.nn as nn
import numpy as np
from typing import Dict, Any
from .base import BaseEmbeddingModel


class FeatureFusionMLP(nn.Module):
    """
    特征融合网络 (v3)
    学习文本嵌入和数值特征之间的交互
    """
    def __init__(self, text_dim=768, numeric_dim=20, output_dim=256):
        super().__init__()
        
        # 文本分支
        self.text_proj = nn.Sequential(
            nn.Linear(text_dim, 256),
            nn.LayerNorm(256),
            nn.ReLU(),
            nn.Dropout(0.1),
        )
        
        # 数值分支
        self.numeric_proj = nn.Sequential(
            nn.Linear(numeric_dim, 64),
            nn.LayerNorm(64),
            nn.ReLU(),
            nn.Dropout(0.1),
        )
        
        # 融合层
        self.fusion = nn.Sequential(
            nn.Linear(256 + 64, 512),
            nn.LayerNorm(512),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(512, output_dim),
            nn.LayerNorm(output_dim),
        )
        
    def forward(self, text_emb, numeric_emb):
        """融合文本和数值特征"""
        text_feat = self.text_proj(text_emb)
        numeric_feat = self.numeric_proj(numeric_emb)
        
        # 拼接并融合
        combined = torch.cat([text_feat, numeric_feat], dim=-1)
        output = self.fusion(combined)
        
        return output


class FusionModel(BaseEmbeddingModel):
    """融合模型包装器 - 使用神经网络融合特征"""
    
    def __init__(self, text_dim=768, numeric_dim=20, output_dim=256, device='cpu'):
        super().__init__()
        self.version = 'v3'
        self.text_dim = text_dim
        self.numeric_dim = numeric_dim
        self.dimension = output_dim
        self.requires_training = True
        self.description = '神经网络融合'
        self.device = device
        
        # 创建 PyTorch 模型
        self.model = FeatureFusionMLP(text_dim, numeric_dim, output_dim)
        self.model.to(device)
        self.model.eval()
    
    def get_info(self) -> Dict[str, Any]:
        info = super().get_info()
        info.update({
            'text_dim': self.text_dim,
            'numeric_dim': self.numeric_dim,
            'output_dim': self.dimension,
            'method': 'neural_fusion',
            'device': str(self.device),
        })
        return info
    
    def load_weights(self, checkpoint_path: str):
        """加载训练好的权重"""
        checkpoint = torch.load(checkpoint_path, map_location=self.device)
        self.model.load_state_dict(checkpoint['model_state_dict'])
        self.model.eval()
    
    def generate_embedding(self, text_emb: np.ndarray, numeric_emb: np.ndarray) -> np.ndarray:
        """
        使用神经网络融合
        
        Args:
            text_emb: (N, 768) 或 (768,)
            numeric_emb: (N, 20) 或 (20,)
            
        Returns:
            (N, 256) 或 (256,)
        """
        with torch.no_grad():
            # 转换为 tensor
            text_tensor = torch.from_numpy(text_emb).float().to(self.device)
            numeric_tensor = torch.from_numpy(numeric_emb).float().to(self.device)
            
            # 添加 batch 维度（如果需要）
            if text_tensor.dim() == 1:
                text_tensor = text_tensor.unsqueeze(0)
                numeric_tensor = numeric_tensor.unsqueeze(0)
                squeeze = True
            else:
                squeeze = False
            
            # 融合
            output = self.model(text_tensor, numeric_tensor)
            
            # L2 归一化
            output = torch.nn.functional.normalize(output, p=2, dim=-1)
            
            # 转回 numpy
            result = output.cpu().numpy()
            
            if squeeze:
                result = result.squeeze(0)
            
            return result
    
    def get_trainable_model(self):
        """返回可训练的 PyTorch 模型"""
        return self.model

