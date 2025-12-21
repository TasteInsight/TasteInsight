.PHONY: help install run train test clean

# 默认目标
help:
	@echo "TasteInsight 嵌入服务 - 可用命令:"
	@echo ""
	@echo "  make install      - 安装依赖"
	@echo "  make run          - 启动服务"
	@echo "  make train        - 训练 Fusion 模型"
	@echo "  make test         - 测试服务"
	@echo "  make clean        - 清理缓存文件"
	@echo ""
	@echo "环境变量（可选）:"
	@echo "  DEVICE=cuda       - 使用 GPU"
	@echo "  EPOCHS=100        - 训练轮数"
	@echo "  BATCH_SIZE=512    - 批次大小"
	@echo ""
	@echo "示例:"
	@echo "  make run"
	@echo "  DEVICE=cuda make train"
	@echo "  EPOCHS=100 BATCH_SIZE=512 make train"

# 安装依赖
install:
	@echo "安装 Python 依赖..."
	pip install -r requirements.txt
	@echo "✓ 依赖安装完成"

# 启动服务
run:
	@echo "启动嵌入服务..."
	python app.py

# 训练模型
train:
	@echo "开始训练 Fusion 模型..."
	@bash train/train.sh

# 快速训练（测试用）
train-quick:
	@echo "快速训练（20 轮）..."
	@EPOCHS=20 BATCH_SIZE=128 bash train/train.sh

# 测试服务
test:
	@echo "测试服务..."
	python test_service.py

# 清理缓存
clean:
	@echo "清理 Python 缓存..."
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type f -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	@echo "✓ 清理完成"

# 开发模式（自动重载）
dev:
	@echo "启动开发模式（自动重载）..."
	FLASK_DEBUG=true python app.py

# 生产模式（使用 gunicorn）
prod:
	@echo "启动生产模式（gunicorn）..."
	gunicorn -w 4 -b 0.0.0.0:5001 app:app

# 查看模型信息
models:
	@echo "支持的模型版本:"
	@curl -s http://localhost:5001/models | python -m json.tool

# 健康检查
health:
	@echo "检查服务健康状态..."
	@curl -s http://localhost:5001/health | python -m json.tool

