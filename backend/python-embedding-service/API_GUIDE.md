# API 与模型指南

完整的 API 调用规范、模型架构说明和扩展指南。

## 📋 目录

- [API 调用规范](#api-调用规范)
- [模型架构](#模型架构)
- [如何添加新模型](#如何添加新模型)
- [最佳实践](#最佳实践)

---

## API 调用规范

### 基础信息

- **Base URL**: `http://localhost:5001`
- **Content-Type**: `application/json`
- **默认版本**: v2（可配置）

### 1. 健康检查

**端点**: `GET /health`

**响应示例**:
```json
{
  "status": "healthy",
  "service": "TasteInsight Embedding Service",
  "config": {
    "default_version": "v3",
    "device": "cuda"
  },
  "supported_versions": ["v2", "v3"],
  "text_encoder": {
    "model_name": "paraphrase-multilingual-mpnet-base-v2",
    "dimension": 768api
  }
}
```

### 2. 生成单个嵌入

**端点**: `POST /embed`

**请求体**:
```json
{
  "text": "宫保鸡丁 麻辣鲜香",
  "features": {
    "price": 18.0,
    "spicyLevel": 4,
    "sweetness": 2,
    "saltiness": 3,
    "oiliness": 3,
    "averageRating": 4.5,
    "reviewCount": 128
  },
  "version": "v3"
}
```

**参数**:
- `text` (必需): 菜品描述文本
- `features` (可选): 数值特征字典
- `version` (可选): 模型版本，不指定则使用默认版本

**响应**:
```json
{
  "embedding": [0.123, -0.456, ...],
  "dimension": 256,
  "version": "v3"
}
```

### 3. 批量生成嵌入

**端点**: `POST /embed_batch`

**请求体**:
```json
{
  "items": [
    {"text": "宫保鸡丁", "features": {"price": 18.0}},
    {"text": "麻婆豆腐", "features": {"price": 12.0}}
  ],
  "version": "v3"
}
```

**响应**:
```json
{
  "embeddings": [[...], [...]],
  "count": 2,
  "dimension": 256,
  "version": "v3"
}
```

**性能建议**: 批量处理比单个循环快 5-10 倍。

### 4. 版本转换

**端点**: `POST /convert_version`

**请求体**:
```json
{
  "text": "宫保鸡丁",
  "features": {"price": 18.0},
  "from_version": "v2",
  "to_version": "v3"
}
```

**注意**: 需要原始文本和特征，不支持从嵌入向量直接转换。

### 5. 列出模型

**端点**: `GET /models`

**响应**:
```json
{
  "default_version": "v3",
  "supported_versions": ["v2", "v3"],
  "models": {
    "v2": {
      "dimension": 788,
      "requires_training": false,
      "description": "文本+数值简单拼接"
    },
    "v3": {
      "dimension": 256,
      "requires_training": true,
      "description": "神经网络融合"
    }
  }
}
```

### 数值特征规范

| 字段 | 类型 | 范围 | 说明 |
|------|------|------|------|
| `price` | float | 0-∞ | 价格（元）|
| `spicyLevel` | int | 0-5 | 辣度 |
| `sweetness` | int | 0-5 | 甜度 |
| `saltiness` | int | 0-5 | 咸度 |
| `sourness` | int | 0-5 | 酸度 |
| `bitterness` | int | 0-5 | 苦度 |
| `oiliness` | int | 0-5 | 油腻度 |
| `averageRating` | float | 0-5 | 平均评分 |
| `reviewCount` | int | 0-∞ | 评论数 |

**缺失值处理**: 自动使用默认值（通常为 0 或中间值）。

---

## 模型架构

### 数据流程

```
输入数据
  ├─ 文本: "宫保鸡丁 麻辣鲜香"
  └─ 特征: {price: 18.0, spicyLevel: 4, ...}
        ↓
编码层
  ├─ TextEncoder
  │   └─ Sentence-BERT (paraphrase-multilingual-mpnet-base-v2)
  │        └─ text_emb [768]
  └─ NumericEncoder
      └─ 标准化 (Z-score)
           └─ numeric_emb [20]
        ↓
模型层
  ├─ v2 (ConcatModel)
  │   └─ concat(text_emb, numeric_emb) → [788]
  │        └─ L2 归一化
  │
  └─ v3 (FusionModel)
      └─ MLP(text_emb, numeric_emb) → [256]
           └─ L2 归一化
        ↓
输出: embedding [dim]
```

### 模型对比

| 特性 | v2 (Concat) | v3 (Fusion) |
|------|-------------|-------------|
| **维度** | 788 | 256 |
| **方法** | 简单拼接 | 神经网络 |
| **训练** | 不需要 | 需要 |
| **特征交互** | ❌ | ✅ |
| **维度压缩** | ❌ | ✅ |
| **部署速度** | 快速 | 需训练 |
| **推理速度** | 快 | 快 |
| **性能** | 基础 | 更好 |
| **适用场景** | 快速原型、无训练数据 | 生产环境、有训练数据 |

### v3 模型网络结构

```python
FusionModel:
  TextBranch:
    Linear(768 → 256)
    LayerNorm + ReLU + Dropout(0.1)
  
  NumericBranch:
    Linear(20 → 64)
    LayerNorm + ReLU + Dropout(0.1)
  
  FusionLayer:
    Concat(text_feat[256], numeric_feat[64])
    Linear(320 → 512)
    LayerNorm + ReLU + Dropout(0.2)
    Linear(512 → 256)
    LayerNorm
  
  Output: L2 Normalize → [256]
```

**参数量**: ~600K  
**训练目标**: Triplet Loss（三元组损失）

---

## 如何添加新模型

### 步骤 1: 创建模型类

在 `models/` 目录创建新文件（如 `models/my_model.py`）：

```python
from models.base import BaseEmbeddingModel
import numpy as np

class MyModel(BaseEmbeddingModel):
    def __init__(self, text_dim=768, numeric_dim=20, output_dim=128):
        super().__init__()
        self.version = 'v4'  # 新版本号
        self.dimension = output_dim
        self.requires_training = True  # 是否需要训练
        self.description = '您的模型描述'
        
        # 初始化您的模型
        # ...
    
    def get_info(self):
        """返回模型信息"""
        info = super().get_info()
        info.update({
            'method': 'your_method',
            # 其他自定义信息
        })
        return info
    
    def generate_embedding(self, text_emb, numeric_emb):
        """
        生成嵌入
        
        Args:
            text_emb: np.ndarray, shape (N, 768) 或 (768,)
            numeric_emb: np.ndarray, shape (N, 20) 或 (20,)
        
        Returns:
            np.ndarray, shape (N, output_dim) 或 (output_dim,)
        """
        # 实现您的嵌入生成逻辑
        # 务必进行 L2 归一化
        pass
    
    def get_trainable_model(self):
        """返回 PyTorch 模型（如需训练）"""
        return self.pytorch_model if self.requires_training else None
```

### 步骤 2: 注册模型

在 `services/model_manager.py` 中注册：

```python
from models.my_model import MyModel

class ModelManager:
    def _get_model_config(self):
        return {
            'v2': {...},
            'v3': {...},
            'v4': {  # 新增
                'class': MyModel,
                'params': {
                    'text_dim': 768,
                    'numeric_dim': 20,
                    'output_dim': 128,
                    'device': self.device
                },
                'checkpoint': 'saved_models/my_model.pt',  # 训练后的模型文件
            },
        }
```

### 步骤 3: 编写训练脚本（如需训练）

参考 `train/train_fusion.py` 创建 `train/train_my_model.py`。

### 步骤 4: 测试

```python
# 测试新模型
import requests

response = requests.post('http://localhost:5001/embed', json={
    'text': '宫保鸡丁',
    'features': {'price': 18.0},
    'version': 'v4'
})

print(response.json())
```

### 完整示例：加权平均模型

```python
"""models/weighted_avg.py"""
import torch
import torch.nn as nn
import numpy as np
from .base import BaseEmbeddingModel

class WeightedAvgModel(BaseEmbeddingModel):
    """学习文本和数值的最优权重"""
    
    def __init__(self, text_dim=768, numeric_dim=20, device='cpu'):
        super().__init__()
        self.version = 'v4'
        self.dimension = text_dim + numeric_dim
        self.requires_training = True
        self.description = '自适应加权平均'
        self.device = device
        
        # 可学习的权重
        self.text_weight = nn.Parameter(torch.tensor(0.8))
        self.numeric_weight = nn.Parameter(torch.tensor(0.2))
    
    def generate_embedding(self, text_emb, numeric_emb):
        """加权拼接"""
        weighted_text = text_emb * self.text_weight.item()
        weighted_numeric = numeric_emb * self.numeric_weight.item()
        
        # 拼接
        if text_emb.ndim == 1:
            result = np.concatenate([weighted_text, weighted_numeric])
        else:
            result = np.concatenate([weighted_text, weighted_numeric], axis=1)
        
        # L2 归一化
        norm = np.linalg.norm(result, axis=-1, keepdims=True)
        result = result / np.maximum(norm, 1e-8)
        
        return result
    
    def get_trainable_model(self):
        return self
```

---

## 最佳实践

### 1. 性能优化

```python
# ✅ 推荐：批量处理
embeddings = service.generate_embeddings_batch(
    texts=['菜品1', '菜品2', ...],
    features_list=[{...}, {...}, ...]
)

# ❌ 避免：循环单个处理
for text, features in items:
    emb = service.generate_embedding(text, features)
```

### 2. 错误处理

```python
try:
    response = requests.post(url, json=data, timeout=30)
    response.raise_for_status()
    embedding = response.json()['embedding']
except requests.exceptions.Timeout:
    print("请求超时")
except requests.exceptions.RequestException as e:
    print(f"请求失败: {e}")
```

### 3. 版本管理

- 使用语义化版本: v1, v2, v3
- 同一数据集使用相同版本
- 提供版本转换 API
- 保留旧版本兼容性

### 4. 模型设计原则

1. **维度选择**: 推荐 128/256/512，考虑存储和计算成本
2. **归一化**: 始终对输出做 L2 归一化
3. **批处理**: 支持单个和批量输入
4. **设备管理**: 支持 CPU/GPU 切换

### 5. 测试检查清单

- [ ] 单个样本嵌入
- [ ] 批量嵌入
- [ ] 输出维度正确
- [ ] L2 归一化 (‖v‖ ≈ 1)
- [ ] CPU/GPU 兼容
- [ ] 缺失特征处理
- [ ] 错误处理
- [ ] 性能基准

---

## 常见问题

**Q: 可以混用版本吗？**  
A: 不推荐。向量检索需要使用相同版本的嵌入。

**Q: 如何处理特征缺失？**  
A: 系统自动使用默认值，无需特殊处理。

**Q: 如何迁移已有嵌入？**  
A: 使用 `/convert_version` API，需提供原始文本和特征。

**Q: 如何优化推理速度？**  
A: 使用 GPU、批量处理、减小模型维度。

---

## 相关文档

- [训练指南](TRAINING_GUIDE.md) - 如何训练模型
- [主文档](README.md) - 快速开始

---

**维护者**: TasteInsight Team  
**最后更新**: 2025-12-17

