"""
配置管理
"""

import os


class Config:
    """服务配置"""
    
    # Flask 配置
    HOST = os.getenv('PYTHON_EMBEDDING_HOST', '0.0.0.0')
    PORT = int(os.getenv('PYTHON_EMBEDDING_PORT', 5001))
    DEBUG = os.getenv('PYTHON_EMBEDDING_DEBUG', 'false').lower() == 'true'
    
    # 模型配置
    TEXT_MODEL = os.getenv('PYTHON_EMBEDDING_TEXT_MODEL', 'sentence-transformers/paraphrase-multilingual-mpnet-base-v2')
    DEFAULT_VERSION = os.getenv('PYTHON_EMBEDDING_DEFAULT_VERSION', 'v2')
    MODEL_DIR = os.getenv('PYTHON_EMBEDDING_MODEL_DIR', 'saved_models')  # 训练好的模型文件目录
    
    # 设备配置
    DEVICE = os.getenv('PYTHON_EMBEDDING_DEVICE', None)  # None = 自动检测
    
    # 预加载模型
    PRELOAD_MODELS = os.getenv('PYTHON_EMBEDDING_PRELOAD_MODELS', 'v2,v3').split(',')
    
    @classmethod
    def get_info(cls) -> dict:
        """获取配置信息"""
        return {
            'host': cls.HOST,
            'port': cls.PORT,
            'text_model': cls.TEXT_MODEL,
            'default_version': cls.DEFAULT_VERSION,
            'model_dir': cls.MODEL_DIR,
            'device': cls.DEVICE or 'auto',
            'preload_models': cls.PRELOAD_MODELS,
        }

