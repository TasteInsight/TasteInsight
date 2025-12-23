from flask import Flask, request, jsonify
import numpy as np
import logging
import time

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# 模拟配置
CONFIG = {
    "default_version": "v2",
    "supported_versions": ["v1", "v2", "v3"],
    "dimensions": {
        "v1": 128,
        "v2": 788,
        "v3": 256
    },
    "device": "cpu (mock)"
}

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'service': 'TasteInsight Embedding Service (Mock)',
        'config': CONFIG
    }), 200

def generate_dummy_embedding(dimension):
    # 生成稳定的伪随机向量，基于某种哈希或固定模式，方便调试
    return np.random.uniform(-1, 1, dimension).tolist()

@app.route('/embed', methods=['POST'])
def embed_single():
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({'error': 'Missing required field: text'}), 400
    
    version = data.get('version') or CONFIG['default_version']
    dim = CONFIG['dimensions'].get(version, 768)
    
    # 模拟一点延迟
    time.sleep(0.01)
    
    return jsonify({
        'embedding': generate_dummy_embedding(dim),
        'dimension': dim,
        'version': version,
    }), 200

@app.route('/embed_batch', methods=['POST'])
def embed_batch():
    data = request.get_json()
    if not data or 'items' not in data:
        return jsonify({'error': 'Missing required field: items'}), 400
    
    items = data['items']
    version = data.get('version') or CONFIG['default_version']
    dim = CONFIG['dimensions'].get(version, 768)
    
    embeddings = [generate_dummy_embedding(dim) for _ in items]
    
    return jsonify({
        'embeddings': embeddings,
        'count': len(embeddings),
        'dimension': dim,
        'version': version,
    }), 200

@app.route('/models', methods=['GET'])
def list_models():
    models_info = {}
    for v in CONFIG['supported_versions']:
        models_info[v] = {
            'dimension': CONFIG['dimensions'][v],
            'requires_training': v == 'v3',
            'description': f'Mock version {v}'
        }
        
    return jsonify({
        'default_version': CONFIG['default_version'],
        'supported_versions': CONFIG['supported_versions'],
        'models': models_info,
    }), 200

if __name__ == '__main__':
    logger.info("Starting Mock Embedding Service...")
    app.run(host='0.0.0.0', port=5001)
