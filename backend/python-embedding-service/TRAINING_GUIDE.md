# 模型训练指南

完整的模型训练教程，从数据准备到部署上线。

## 📋 目录

- [快速开始](#快速开始)
- [训练准备](#训练准备)
- [训练流程](#训练流程)
- [超参数调优](#超参数调优)
- [模型部署](#模型部署)
- [故障排查](#故障排查)

---

## 快速开始

### 最小化训练（3 步）

```bash
# 1. 设置数据库
export DB_HOST=localhost
export DB_NAME=tasteinsight
export DB_USER=postgres
export DB_PASSWORD=your_password

# 2. 运行训练
bash train/train.sh

# 3. 模型保存到 saved_models/fusion_v3.pt
```

### 使用 Make

```bash
make train              # 标准训练
make train-quick        # 快速测试（20轮）
DEVICE=cuda make train  # 使用 GPU
```

### 预期输出

```
Epoch 50/50
Training: 100%|████| 156/156 [00:12<00:00, loss=0.0234]
Test Loss: 0.0198, Accuracy: 0.9423
✓ Saved best model to saved_models/fusion_v3.pt
```

---

## 训练准备

### 1. 环境要求

```bash
# Python 依赖（requirements.txt）
torch==2.2.0
sentence-transformers==2.5.1
psycopg2-binary==2.9.9
tqdm==4.66.1
```

### 2. 硬件要求

| 组件 | 最低 | 推荐 |
|------|------|------|
| CPU | 4 核 | 8+ 核 |
| 内存 | 8 GB | 16+ GB |
| GPU | 无（可用CPU）| NVIDIA 6GB+ VRAM |
| 存储 | 5 GB | 10+ GB |

### 3. 数据要求

**最小数据量**:
- **菜品**: 1,000+ 条
- **交互**: 10,000+ 条（评论 + 收藏）

**数据来源**:
- `Dish` 表: 菜品信息
- `Review` 表: 用户评分（rating >= 3.5）
- `MealPlanItem` 表: 用户收藏

### 4. 验证数据

```sql
-- 检查菜品数量
SELECT COUNT(*) FROM "Dish" WHERE "reviewCount" >= 5;

-- 检查交互数量
SELECT COUNT(*) FROM "Review" WHERE rating >= 3.5;
SELECT COUNT(*) FROM "MealPlanItem";
```

### 5. 配置数据库

```bash
# 方式 1: 环境变量
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=tasteinsight
export DB_USER=postgres
export DB_PASSWORD=your_password

# 方式 2: 使用 .env 文件
cp env.example .env
# 编辑 .env 填入实际值
source .env
```

---

## 训练流程

### 完整命令参数

```bash
python train/train_fusion.py \
  --output models/fusion_v3.pt \    # 输出路径
  --epochs 50 \                     # 训练轮数
  --batch_size 256 \                # 批次大小
  --lr 0.001 \                      # 学习率
  --margin 0.5 \                    # 三元组损失边界
  --num_negatives 2 \               # 负样本数
  --min_interactions 5 \            # 最少交互数
  --device cuda                     # 设备 (cuda/cpu)
```

### 训练步骤详解

#### 步骤 1: 加载数据

```
Loading dishes from database...
Loaded 2547 dishes
Loaded 45621 interactions
  - Reviews: 38456
  - Favorites: 7165
```

从数据库加载：
- 菜品的文本和特征
- 用户的评分和收藏记录

#### 步骤 2: 编码菜品

```
Encoding all dishes...
Text embeddings: (2547, 768)
Numeric embeddings: (2547, 20)
```

使用预训练模型编码：
- **TextEncoder**: Sentence-BERT → 768 维
- **NumericEncoder**: 标准化 → 20 维

#### 步骤 3: 生成三元组

```
Generating triplets...
Generated 89342 triplets
Split: 71473 train, 17869 test
```

**三元组结构**:
- **Anchor**: 用户喜欢的菜品
- **Positive**: 同一菜品
- **Negative**: 用户未交互的菜品（随机采样）

**目标**: 让 `dist(anchor, positive) < dist(anchor, negative)`

#### 步骤 4: 训练模型

```
Training with Triplet Loss...
loss = max(0, ||a - p||² - ||a - n||² + margin)
```

神经网络学习文本和数值特征的融合方式。

#### 步骤 5: 保存模型

自动保存测试集上损失最低的模型：

```python
checkpoint = {
    'model_state_dict': {...},      # 模型权重
    'test_loss': 0.0198,            # 测试损失
    'test_accuracy': 0.9423,        # 测试准确率
    'epoch': 49,
    'args': {...}                   # 训练参数
}
```

---

## 超参数调优

### 推荐配置

#### 小数据集 (< 5K 菜品)

```bash
python train/train_fusion.py \
  --epochs 30 \
  --batch_size 128 \
  --lr 0.001 \
  --margin 0.5 \
  --num_negatives 2
```

#### 中等数据集 (5K-20K 菜品)

```bash
python train/train_fusion.py \
  --epochs 50 \
  --batch_size 256 \
  --lr 0.001 \
  --margin 0.5 \
  --num_negatives 3
```

#### 大数据集 (> 20K 菜品)

```bash
python train/train_fusion.py \
  --epochs 100 \
  --batch_size 512 \
  --lr 0.0005 \
  --margin 0.3 \
  --num_negatives 4
```

### 参数说明

| 参数 | 说明 | 典型值 | 调优建议 |
|------|------|--------|----------|
| `epochs` | 训练轮数 | 50 | 增加直到收敛 |
| `batch_size` | 批次大小 | 256 | GPU 大可增加，内存小可减少 |
| `lr` | 学习率 | 0.001 | 损失震荡降低，收敛慢提高 |
| `margin` | 分离边界 | 0.5 | 准确率低可减小（更严格）|
| `num_negatives` | 负样本数 | 2 | 增加可能提高泛化 |
| `min_interactions` | 最少交互 | 5 | 数据少可降低 |

### 监控训练

**正常训练**:
```
Epoch 1:  Train=0.325, Test=0.299, Acc=0.723
Epoch 10: Train=0.088, Test=0.082, Acc=0.877
Epoch 20: Train=0.023, Test=0.020, Acc=0.942
```
→ 损失平稳下降，准确率提升

**过拟合**:
```
Epoch 1:  Train=0.325, Test=0.299
Epoch 10: Train=0.012, Test=0.123  # ⚠️ 测试损失上升
Epoch 20: Train=0.005, Test=0.157
```
→ **解决**: 增加 dropout、减少 epochs、更多数据

**欠拟合**:
```
Epoch 1:  Train=0.325, Test=0.320
Epoch 20: Train=0.299, Test=0.295  # ⚠️ 下降缓慢
Epoch 50: Train=0.288, Test=0.283
```
→ **解决**: 增加模型容量、调整学习率、更多 epochs

---

## 模型部署

### 1. 验证训练结果

```python
import torch

# 加载检查点
checkpoint = torch.load('saved_models/fusion_v3.pt')
print(f"Test Loss: {checkpoint['test_loss']:.4f}")
print(f"Test Accuracy: {checkpoint['test_accuracy']:.4f}")

# 预期: Loss < 0.05, Accuracy > 0.90
```

### 2. 更新服务配置

模型会自动从 `saved_models/fusion_v3.pt` 加载（已配置）。

```python
# services/model_manager.py (已配置好)
'v3': {
    'checkpoint': 'saved_models/fusion_v3.pt',  # 训练输出路径
}
```

### 3. 启动服务

```bash
# 开发模式
python app.py

# 生产模式
make prod

# Docker
docker-compose up -d
```

### 4. 验证部署

```bash
# 测试 v3 模型
curl -X POST http://localhost:5001/embed \
  -H "Content-Type: application/json" \
  -d '{
    "text": "宫保鸡丁",
    "features": {"price": 18.0},
    "version": "v3"
  }'

# 或使用测试脚本
python test_service.py
```

### 5. A/B 测试

```bash
# 保留旧模型
cp saved_models/fusion_v3.pt saved_models/fusion_v3_old.pt

# 训练新模型
python train/train_fusion.py --output saved_models/fusion_v3_new.pt

# 在代码中注册两个版本进行对比
```

---

## 故障排查

### 常见问题

#### Q1: 数据库连接失败

```
Error: could not connect to server
```

**解决**:
```bash
# 检查数据库配置
echo $DB_HOST $DB_NAME $DB_USER

# 测试连接
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1"
```

#### Q2: 数据不足

```
Error: Too few dishes: 234. Need at least 1000.
```

**解决**:
```bash
# 降低最少交互数
python train/train_fusion.py --min_interactions 1

# 或准备更多数据
```

#### Q3: 内存不足

```
RuntimeError: CUDA out of memory
```

**解决**:
```bash
# 减小批次
python train/train_fusion.py --batch_size 64

# 或使用 CPU
python train/train_fusion.py --device cpu
```

#### Q4: 训练太慢

**解决**:
```bash
# 使用 GPU
python train/train_fusion.py --device cuda

# 增加批次（如果内存够）
python train/train_fusion.py --batch_size 512

# 减少负样本
python train/train_fusion.py --num_negatives 1
```

#### Q5: 准确率不高

```
Test Accuracy: 0.65  # 太低
```

**解决**:
```bash
# 更多训练轮数
python train/train_fusion.py --epochs 100

# 更多负样本
python train/train_fusion.py --num_negatives 4

# 调整 margin
python train/train_fusion.py --margin 0.3

# 检查数据质量
```

---

## 训练脚本参考

### 文件结构

```
train/
├── __init__.py
├── dataset.py           # 数据加载和预处理
├── train_fusion.py      # v3 训练脚本
├── train.sh             # 快速启动脚本
└── train_example.sh     # 训练示例
```

### 快速启动脚本

`train.sh` 会自动：
- 检查环境变量
- 检测 GPU
- 使用合理的默认参数
- 运行训练

### 自定义训练

参考 `train/train_fusion.py` 创建自己的训练脚本：

```python
# 1. 加载数据
dataset = DishDataset(db_config, min_interactions=5)
dishes = dataset.load_dishes()
interactions = dataset.load_interactions()

# 2. 编码
text_embs, numeric_embs = encode_all_dishes(dishes, ...)

# 3. 生成三元组
triplets = dataset.generate_triplets(num_negatives=2)
train_triplets, test_triplets = dataset.split_data(triplets)

# 4. 训练
model = FeatureFusionMLP(...)
for epoch in range(epochs):
    train_loss = train_epoch(model, ...)
    test_loss, accuracy = evaluate(model, ...)

# 5. 保存
torch.save(checkpoint, output_path)
```

---

## 相关文档

- [API 指南](API_GUIDE.md) - API 和模型架构
- [主文档](README.md) - 快速开始

---

**维护者**: TasteInsight Team  
**最后更新**: 2025-12-17
