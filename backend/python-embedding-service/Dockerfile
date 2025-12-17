FROM python:3.10-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 复制并安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY app.py config.py ./
COPY encoders/ ./encoders/
COPY models/ ./models/
COPY services/ ./services/

# 创建训练模型存储目录
RUN mkdir -p saved_models

# 预下载 Sentence-BERT 模型（可选，首次启动会更快）
# 取消注释以在构建时下载，会增加镜像大小 ~400MB
# RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/paraphrase-multilingual-mpnet-base-v2')"

# 暴露端口
EXPOSE 5001

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5001/health || exit 1

# 使用 gunicorn 生产服务器
# -w 2: 2 个 worker 进程
# -b 0.0.0.0:5001: 绑定到所有网络接口
# --timeout 120: 请求超时 120 秒（嵌入生成可能较慢）
# --preload: 预加载应用代码
CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:5001", "--timeout", "120", "--preload", "app:app"]
