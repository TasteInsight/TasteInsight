# TasteInsight 嵌入服务

基于深度学习的菜品嵌入向量生成服务，支持文本和数值特征融合。

## 🚀 快速开始

### 启动服务

使用 Python 3.9–3.12，与固定依赖版本兼容；容器使用 Python 3.10。完整项目从仓库根目录准备独立 Python 环境，再进入后端启动。以下命令适用于 Linux/macOS shell，激活环境后 `pnpm start:embedding` 使用该环境的 Python：

```bash
cd backend
python3 -m venv python-embedding-service/.venv
. python-embedding-service/.venv/bin/activate
python -m pip install -r python-embedding-service/requirements.txt
pnpm run start:embedding
```

独立运行时，在 `backend/python-embedding-service` 目录创建并激活虚拟环境，安装同一份 `requirements.txt`，在 shell 中设置所需 `PYTHON_EMBEDDING_*` 和 `HF_ENDPOINT`，然后执行 `python app.py`。默认监听 `http://localhost:5001`。

PyTorch 固定为 `2.2.0`：Linux x86_64 可从配置的官方 CPU 索引选择对应 CPU 构建，macOS / ARM64 使用适配本机平台的发行包。

默认文本模型为 `sentence-transformers/paraphrase-multilingual-mpnet-base-v2`。首次启动需要下载预训练权重，后续启动复用本地 Hugging Face 缓存。`HF_ENDPOINT` 默认使用 `https://huggingface.co`；自定义模型源需兼容 Hugging Face SDK 的文件元数据及重定向协议，并使用空缓存验证首次下载。

### 测试服务

另开终端进入 `backend/python-embedding-service` 并激活 `.venv`。以下测试、训练和 Make 命令均从该目录执行；请求地址使用服务的实际监听端口。

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

服务测试覆盖健康检查、单条与批量嵌入、模型列表和 v3 运行路径。v2 应输出 788 维有限值向量，v3 应输出 256 维向量，两者均进行 L2 归一化。接口成功、维度正确和归一化结果只能验证运行及数据契约，推荐质量需要单独评估。

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
| **v3 (Fusion)** | 256 | ✅ | 已训练并评估融合权重的场景 |

v2 使用预训练文本模型与数值特征拼接，无需额外训练融合层。v3 需要在 `PYTHON_EMBEDDING_MODEL_DIR` 中提供 `fusion_v3.pt`；当前实现缺少该文件时会运行随机初始化的融合网络。此时 `/health` 和嵌入接口仍可成功响应，但不能视为完成训练或达到可用的推荐质量。

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
export PYTHON_EMBEDDING_HOST=0.0.0.0
export PYTHON_EMBEDDING_PORT=5001
export PYTHON_EMBEDDING_DEFAULT_VERSION=v2
export PYTHON_EMBEDDING_DEVICE=cpu
export HF_ENDPOINT=https://huggingface.co

# 启动
python app.py
```

配置示例见 `env.example`，包含推理默认值、可选训练配置和安全说明；Python 不会自动读取该文件。切换到 v3 前应准备训练权重；使用 GPU 时将 `PYTHON_EMBEDDING_DEVICE` 设置为 `cuda`，未设置或留空时自动选择设备。

完整 Compose 仅转发模型名称、嵌入版本、设备、预加载版本和模型下载源。文本模型与版本的默认值由 `config.py` 管理；未设置或留空使用默认值。镜像中的 Gunicorn 固定监听 `5001`，工作目录 `/app` 下的 `saved_models` 对应挂载卷 `/app/saved_models`。单独使用 `python app.py` 时仍可通过 `PYTHON_EMBEDDING_HOST`、`PYTHON_EMBEDDING_PORT` 和 `PYTHON_EMBEDDING_DEBUG` 调整开发服务器。

独立 Python 启动默认预加载 `v2,v3`；Compose 默认不预加载这两个版本，需要时设置 `PYTHON_EMBEDDING_PRELOAD_MODELS`。文本编码器仍会在服务启动时加载，缺少缓存时下载权重。镜像构建默认 `PRELOAD_MODEL=false`；显式启用时使用同一份 `Config.TEXT_MODEL` 默认值。

## 🐳 Docker 部署

```bash
# 构建
docker build --platform linux/amd64 -t tasteinsight-embedding .

# 运行
docker run -d \
  --platform linux/amd64 \
  -p 5001:5001 \
  -e PYTHON_EMBEDDING_DEFAULT_VERSION=v2 \
  -e PYTHON_EMBEDDING_PRELOAD_MODELS=v2 \
  -e HF_ENDPOINT=https://huggingface.co \
  -v tasteinsight-embedding-cache:/app/.cache/huggingface \
  -v $(pwd)/saved_models:/app/saved_models \
  tasteinsight-embedding
```

模型缓存卷可避免重建容器后重复下载。完整项目的 Compose 使用 `huggingface_cache` 保存预训练模型，使用 `embedding_models` 保存 v3 训练权重。

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
A: 服务使用 `export PYTHON_EMBEDDING_DEVICE=cuda`；直接运行训练 Python 程序时使用 `--device cuda`。

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
