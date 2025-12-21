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

# 第一步：单独安装 PyTorch（最大的依赖，单独一层方便缓存）
# 使用 BuildKit 缓存挂载加速下载
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --extra-index-url https://download.pytorch.org/whl/cpu torch==2.2.0+cpu

# 第二步：安装其他核心依赖（变化较少的依赖）
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install \
    flask==3.0.0 \
    gunicorn==21.2.0 \
    numpy==1.26.3 \
    transformers==4.37.2 \
    sentence-transformers==2.5.1 \
    psycopg2-binary==2.9.9 \
    tqdm==4.66.1

# 第三步：复制 requirements.txt 并安装剩余依赖（如果有）
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt || true

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

# 预下载 Sentence-BERT 模型（可选，通过构建参数控制）
# - CI 构建：PRELOAD_MODEL=false（快速验证，减少构建时间）
# - CD 构建：PRELOAD_MODEL=true（生产镜像，首次启动更快）
# 模型会被烧录到镜像层，增加约 400MB 镜像大小
ARG PRELOAD_MODEL=false
RUN if [ "$PRELOAD_MODEL" = "true" ]; then \
        echo "⬇️ Preloading Sentence-BERT model into image..."; \
        python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/paraphrase-multilingual-mpnet-base-v2')" && \
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
# -w 2: 2 个 worker 进程
# -b 0.0.0.0:5001: 绑定到所有网络接口
# --timeout 120: 请求超时 120 秒（嵌入生成可能较慢）
# --preload: 预加载应用代码
CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:5001", "--timeout", "120", "--preload", "app:app"]
