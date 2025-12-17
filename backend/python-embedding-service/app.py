"""
TasteInsight 嵌入服务

版本说明：
- v2: concat 模式 - 文本+数值拼接（788维，无需训练）
- v3: fusion 模式 - 神经网络融合（256维，需要训练）

架构：
- models/: 模型定义（base, concat, fusion）
- encoders/: 编码器（text, numeric）
- services/: 服务层（model_manager, embedding_service）
- config.py: 配置管理
- app.py: Flask 应用入口
"""

from flask import Flask, request, jsonify
import logging
import traceback

from config import Config
from services import EmbeddingService

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 创建 Flask 应用
app = Flask(__name__)

# 全局嵌入服务实例
embedding_service: EmbeddingService = None


def init_service():
    """初始化嵌入服务"""
    global embedding_service
    
    logger.info("=" * 60)
    logger.info("TasteInsight Embedding Service")
    logger.info("=" * 60)
    logger.info(f"Configuration: {Config.get_info()}")
    
    # 创建嵌入服务
    embedding_service = EmbeddingService(
        text_model_name=Config.TEXT_MODEL,
        device=Config.DEVICE,
        model_dir=Config.MODEL_DIR,
        default_version=Config.DEFAULT_VERSION
    )
    
    # 预加载模型
    if Config.PRELOAD_MODELS:
        logger.info(f"Preloading models: {Config.PRELOAD_MODELS}")
        embedding_service.preload_models(Config.PRELOAD_MODELS)
    
    logger.info("=" * 60)
    logger.info("Service ready!")
    logger.info("=" * 60)


@app.route('/health', methods=['GET'])
def health_check():
    """健康检查"""
    try:
        service_info = embedding_service.get_service_info()
        
        return jsonify({
            'status': 'healthy',
            'service': 'TasteInsight Embedding Service',
            'config': Config.get_info(),
            **service_info
        }), 200
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({
            'status': 'unhealthy',
            'error': str(e)
        }), 503


@app.route('/embed', methods=['POST'])
def embed_single():
    """
    生成单个嵌入
    
    请求体：
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
        "version": "v3"  // 可选，默认使用配置的默认版本
    }
    
    响应：
    {
        "embedding": [...],
        "dimension": 256,
        "version": "v3"
    }
    """
    try:
        data = request.get_json()
        
        # 验证必需字段
        if not data or 'text' not in data:
            return jsonify({'error': 'Missing required field: text'}), 400
        
        text = data['text']
        features = data.get('features', {})
        version = data.get('version')  # None 使用默认版本
        
        # 验证版本
        if version and not embedding_service.validate_version(version):
            return jsonify({
                'error': f'Invalid version: {version}',
                'supported_versions': embedding_service.model_manager.get_supported_versions()
            }), 400
        
        # 生成嵌入
        embedding = embedding_service.generate_embedding(text, features, version)
        
        # 使用的版本
        used_version = version or embedding_service.model_manager.default_version
        
        return jsonify({
            'embedding': embedding.tolist(),
            'dimension': len(embedding),
            'version': used_version,
        }), 200
        
    except Exception as e:
        logger.error(f"Embedding generation failed: {e}\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500


@app.route('/embed_batch', methods=['POST'])
def embed_batch():
    """
    批量生成嵌入
    
    请求体：
    {
        "items": [
            {
                "text": "宫保鸡丁",
                "features": {...}
            },
            {
                "text": "麻婆豆腐",
                "features": {...}
            }
        ],
        "version": "v3"
    }
    
    响应：
    {
        "embeddings": [[...], [...]],
        "count": 2,
        "dimension": 256,
        "version": "v3"
    }
    """
    try:
        data = request.get_json()
        
        # 验证必需字段
        if not data or 'items' not in data:
            return jsonify({'error': 'Missing required field: items'}), 400
        
        items = data['items']
        version = data.get('version')
        
        if not isinstance(items, list) or not items:
            return jsonify({'error': 'items must be a non-empty list'}), 400
        
        # 验证版本
        if version and not embedding_service.validate_version(version):
            return jsonify({
                'error': f'Invalid version: {version}',
                'supported_versions': embedding_service.model_manager.get_supported_versions()
            }), 400
        
        # 提取文本和特征
        texts = [item.get('text', '') for item in items]
        features_list = [item.get('features', {}) for item in items]
        
        # 批量生成嵌入
        embeddings = embedding_service.generate_embeddings_batch(texts, features_list, version)
        
        # 使用的版本
        used_version = version or embedding_service.model_manager.default_version
        
        return jsonify({
            'embeddings': embeddings.tolist(),
            'count': len(embeddings),
            'dimension': embeddings.shape[1],
            'version': used_version,
        }), 200
        
    except Exception as e:
        logger.error(f"Batch embedding generation failed: {e}\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500


@app.route('/convert_version', methods=['POST'])
def convert_version():
    """
    转换嵌入版本
    
    注意：需要原始文本和特征，不支持从嵌入向量直接转换
    
    请求体：
    {
        "text": "宫保鸡丁",
        "features": {...},
        "from_version": "v1",
        "to_version": "v3"
    }
    
    响应：
    {
        "embedding": [...],
        "dimension": 256,
        "from_version": "v1",
        "to_version": "v3"
    }
    """
    try:
        data = request.get_json()
        
        # 验证必需字段
        if not data or 'text' not in data:
            return jsonify({'error': 'Missing required field: text'}), 400
        
        text = data['text']
        features = data.get('features', {})
        from_version = data.get('from_version')
        to_version = data.get('to_version')
        
        if not from_version or not to_version:
            return jsonify({'error': 'Missing from_version or to_version'}), 400
        
        # 转换
        embedding = embedding_service.convert_version(text, features, from_version, to_version)
        
        return jsonify({
            'embedding': embedding.tolist(),
            'dimension': len(embedding),
            'from_version': from_version,
            'to_version': to_version,
        }), 200
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Version conversion failed: {e}\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500


@app.route('/models', methods=['GET'])
def list_models():
    """
    列出所有支持的模型版本
    
    响应：
    {
        "default_version": "v3",
        "supported_versions": ["v2", "v3"],
        "models": {
            "v2": {...},
            "v3": {...}
        }
    }
    """
    try:
        info = embedding_service.get_service_info()
        
        return jsonify({
            'default_version': info['default_version'],
            'supported_versions': info['supported_versions'],
            'models': info['models'],
        }), 200
    except Exception as e:
        logger.error(f"Failed to list models: {e}")
        return jsonify({'error': str(e)}), 500



if __name__ == '__main__':
    # 初始化服务
    init_service()
    
    # 启动 Flask 服务
    app.run(
        host=Config.HOST,
        port=Config.PORT,
        debug=Config.DEBUG,
        threaded=True
    )
