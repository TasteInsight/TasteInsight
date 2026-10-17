FROM python:3.10-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 配置 pip 使用国内镜像源加速下载
RUN pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple/ && \
    pip config set global.trusted-host pypi.tuna.tsinghua.edu.cn

# 固定依赖统一由 requirements.txt 管理，下载缓存跨构建复用。
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

# 复制应用代码
COPY app.py config.py ./
COPY encoders/ ./encoders/
COPY models/ ./models/
COPY services/ ./services/

# 创建训练模型存储目录
RUN mkdir -p saved_models

# 配置并创建 HuggingFace 缓存目录，避免重复下载模型
ENV HF_HOME=/app/.cache/huggingface
ENV TRANSFORMERS_CACHE=/app/.cache/huggingface/hub
RUN mkdir -p /app/.cache/huggingface/hub

# 预下载 Config 中的文本模型（可选，默认关闭）。
# 启用 PRELOAD_MODEL 会将模型写入镜像层，增加约 400MB 镜像大小。
ARG PRELOAD_MODEL=false
RUN if [ "$PRELOAD_MODEL" = "true" ]; then \
        echo "⬇️ Preloading Sentence-BERT model into image..."; \
        python -c "from config import Config; from sentence_transformers import SentenceTransformer; SentenceTransformer(Config.TEXT_MODEL)" && \
        echo "✅ Model preloaded and cached in image layer"; \
    else \
        echo "⏭️ Skipping model preload (will download on first run, or use volume cache)"; \
    fi

# 暴露端口
EXPOSE 5001

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=5 \
    CMD curl -f http://localhost:5001/health || exit 1

# 使用 gunicorn 生产服务器
# -w 1: 1 个 worker 进程
# -b 0.0.0.0:5001: 绑定到所有网络接口
# --timeout 120: 请求超时 120 秒（嵌入生成可能较慢）
# 不能使用 --preload 会导致 PyTorch/OpenMP 在 fork 时的死锁问题
CMD ["gunicorn", "-w", "1", "-b", "0.0.0.0:5001", "--timeout", "120", "app:app"]
