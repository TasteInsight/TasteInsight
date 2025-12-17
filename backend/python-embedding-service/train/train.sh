#!/bin/bash
# 训练脚本 - 快速启动 Fusion 模型训练

set -e

echo "=================================="
echo "TasteInsight 模型训练"
echo "=================================="

# 检查环境变量
if [ -z "$DB_HOST" ]; then
    echo "⚠ 警告: DB_HOST 未设置，使用默认值 localhost"
    export DB_HOST=localhost
fi

if [ -z "$DB_NAME" ]; then
    echo "⚠ 警告: DB_NAME 未设置，使用默认值 tasteinsight"
    export DB_NAME=tasteinsight
fi

if [ -z "$DB_USER" ]; then
    echo "⚠ 警告: DB_USER 未设置，使用默认值 postgres"
    export DB_USER=postgres
fi

echo ""
echo "数据库配置:"
echo "  Host: $DB_HOST"
echo "  Port: ${DB_PORT:-5432}"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""

# 检测 GPU
if command -v nvidia-smi &> /dev/null; then
    echo "✓ 检测到 NVIDIA GPU"
    nvidia-smi --query-gpu=name,memory.total --format=csv,noheader
    DEVICE="cuda"
else
    echo "✗ 未检测到 GPU，使用 CPU"
    DEVICE="cpu"
fi

echo ""
echo "开始训练..."
echo ""

# 默认参数
EPOCHS=${EPOCHS:-50}
BATCH_SIZE=${BATCH_SIZE:-256}
LR=${LR:-0.001}
MARGIN=${MARGIN:-0.5}
NUM_NEGATIVES=${NUM_NEGATIVES:-2}
MIN_INTERACTIONS=${MIN_INTERACTIONS:-5}
OUTPUT=${OUTPUT:-saved_models/fusion_v3.pt}

# 运行训练
python train/train_fusion.py \
    --output "$OUTPUT" \
    --epochs "$EPOCHS" \
    --batch_size "$BATCH_SIZE" \
    --lr "$LR" \
    --margin "$MARGIN" \
    --num_negatives "$NUM_NEGATIVES" \
    --min_interactions "$MIN_INTERACTIONS" \
    --device "$DEVICE"

echo ""
echo "=================================="
echo "训练完成！"
echo "模型已保存到: $OUTPUT"
echo "=================================="

