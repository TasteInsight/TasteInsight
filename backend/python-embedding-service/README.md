# TasteInsight 嵌入服务

基于深度学习的菜品嵌入向量生成服务，支持文本和数值特征融合。

## 🚀 5 分钟快速开始

### 启动服务

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 启动服务
python app.py

# 服务在 http://localhost:5001 启动
```

### 测试服务

```bash
# 健康检查
curl http://localhost:5001/health

# 生成嵌入
curl -X POST http://localhost:5001/embed \
  -H "Content-Type: application/json" \
  -d '{
    "text": "宫保鸡丁 麻辣鲜香",
    "features": {"price": 18.0, "spicyLevel": 4},
    "version": "v2"
  }'

# 运行测试脚本
python test_service.py
```

### 训练模型（可选）

```bash
# 1. 设置数据库连接
export DB_HOST=localhost
export DB_NAME=tasteinsight
export DB_USER=postgres
export DB_PASSWORD=your_password

# 2. 快速训练
bash train/train.sh

# 或使用 Make
make train
```


## 🏗️ 架构概览

```
输入数据
  ├─ 文本: "宫保鸡丁 麻辣鲜香"
  └─ 数值特征: {price: 18.0, spicyLevel: 4, ...}
        ↓
编码层
  ├─ TextEncoder (Sentence-BERT) → [768]
  └─ NumericEncoder (标准化) → [20]
        ↓
模型层
  ├─ v2 (Concat): 简单拼接 → [788]
  └─ v3 (Fusion): 神经网络融合 → [256]
        ↓
输出: L2 归一化嵌入向量
```

## 📦 支持的模型

| 版本 | 维度 | 需要训练 | 适用场景 |
|------|------|----------|----------|
| **v2 (Concat)** | 788 | ❌ | 快速部署、无训练数据 |
| **v3 (Fusion)** | 256 | ✅ | 生产环境、有训练数据（推荐）|

## 🔧 常用命令

```bash
# 启动服务
python app.py                    # 开发模式
make run                         # 使用 Make
make prod                        # 生产模式 (gunicorn)

# 训练模型
make train                       # 标准训练
make train-quick                 # 快速测试 (20轮)
DEVICE=cuda make train           # 使用 GPU

# 测试
python test_service.py           # 测试服务
make test                        # 使用 Make
make health                      # 健康检查

# 其他
make models                      # 查看模型信息
make clean                       # 清理缓存
```

## 📂 项目结构

```
python-embedding-service/
├── app.py                    # Flask 服务入口
├── config.py                 # 配置管理
├── requirements.txt          # Python 依赖
│
├── encoders/                 # 编码器
│   ├── text_encoder.py      # 文本编码 (Sentence-BERT)
│   └── numeric_encoder.py   # 数值特征编码
│
├── models/                   # 模型架构定义（Python 代码）
│   ├── base.py              # 基类接口
│   ├── concat.py            # v2 拼接模型
│   └── fusion.py            # v3 融合模型
│
├── saved_models/             # 训练好的模型文件（.pt 文件）
│   └── fusion_v3.pt         # v3 训练权重
│
├── services/                 # 服务层
│   ├── model_manager.py     # 模型管理
│   └── embedding_service.py # 嵌入生成服务
│
├── train/                    # 训练脚本
│   ├── dataset.py           # 数据加载
│   ├── train_fusion.py      # v3 训练脚本
│   └── train.sh             # 快速启动
│
├── API_GUIDE.md              # API 和模型文档
├── TRAINING_GUIDE.md         # 训练指南
└── README.md                 # 本文件
```

## 🎯 核心 API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/embed` | POST | 生成单个嵌入 |
| `/embed_batch` | POST | 批量生成嵌入 |
| `/models` | GET | 列出支持的模型 |

详细 API 文档见 [API_GUIDE.md](API_GUIDE.md)

## ⚙️ 配置

通过环境变量配置服务：

```bash
# 基础配置
export HOST=0.0.0.0
export PORT=5001
export DEFAULT_EMBEDDING_VERSION=v3
export DEVICE=cuda

# 启动
python app.py
```

配置示例见 `env.example`

## 🐳 Docker 部署

```bash
# 构建
docker build -t tasteinsight-embedding .

# 运行
docker run -d \
  -p 5001:5001 \
  -e DEFAULT_EMBEDDING_VERSION=v3 \
  -v $(pwd)/saved_models:/app/saved_models \
  tasteinsight-embedding
```

## 📊 性能指标

| 指标 | CPU | GPU |
|------|-----|-----|
| 单个嵌入 | ~50ms | ~10ms |
| 批量 100 个 | ~500ms | ~100ms |
| 模型加载 | ~2s | ~1s |

## ❓ 常见问题

**Q: 训练需要多少数据？**  
A: 建议至少 1,000 菜品和 10,000 用户交互。

**Q: 如何使用 GPU？**  
A: `export DEVICE=cuda` 或训练时 `--device cuda`

**Q: 如何添加新模型？**  
A: 参考 [API_GUIDE.md - 添加新模型](API_GUIDE.md#如何添加新模型)

**Q: 训练太慢怎么办？**  
A: 使用 GPU、增加 batch_size、减少负样本数。详见 [TRAINING_GUIDE.md](TRAINING_GUIDE.md)

## 🔗 相关文档

- **主项目**: [../](../)

## 🤝 贡献

### 添加新模型

1. 继承 `BaseEmbeddingModel` 创建模型类
2. 在 `ModelManager` 中注册
3. 编写训练脚本（如需训练）
4. 更新文档

详细步骤见 [API_GUIDE.md](API_GUIDE.md)

## 📝 版本历史

- **v3** (2025-12) - Fusion 神经网络融合模型
- **v2** (2025-12) - Concat 简单拼接模型

## 📄 许可证

MIT License

---

**需要帮助？** 查看 [API_GUIDE.md](API_GUIDE.md) 或 [TRAINING_GUIDE.md](TRAINING_GUIDE.md)
