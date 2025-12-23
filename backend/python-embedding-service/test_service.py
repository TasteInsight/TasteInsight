"""
嵌入服务测试脚本
快速验证服务是否正常工作
"""

import requests
import json
import sys

BASE_URL = "http://localhost:5001"


def test_health():
    """测试健康检查"""
    print("=" * 60)
    print("测试 1: 健康检查")
    print("=" * 60)
    
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print("✓ 服务正常运行")
            print(f"  - 默认版本: {data.get('config', {}).get('default_version')}")
            print(f"  - 支持版本: {data.get('supported_versions')}")
            print(f"  - 设备: {data.get('config', {}).get('device')}")
            return True
        else:
            print(f"✗ 健康检查失败: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ 无法连接到服务: {e}")
        print(f"  请确保服务运行在 {BASE_URL}")
        return False


def test_single_embedding():
    """测试单个嵌入生成"""
    print("\n" + "=" * 60)
    print("测试 2: 生成单个嵌入")
    print("=" * 60)
    
    payload = {
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
        "version": "v2"  # 使用 v2 因为不需要训练
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/embed",
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print("✓ 嵌入生成成功")
            print(f"  - 版本: {data['version']}")
            print(f"  - 维度: {data['dimension']}")
            print(f"  - 嵌入向量预览: [{data['embedding'][0]:.4f}, {data['embedding'][1]:.4f}, ...]")
            return True
        else:
            print(f"✗ 嵌入生成失败: {response.status_code}")
            print(f"  错误: {response.text}")
            return False
    except Exception as e:
        print(f"✗ 请求失败: {e}")
        return False


def test_batch_embedding():
    """测试批量嵌入生成"""
    print("\n" + "=" * 60)
    print("测试 3: 批量生成嵌入")
    print("=" * 60)
    
    payload = {
        "items": [
            {
                "text": "宫保鸡丁",
                "features": {"price": 18.0, "spicyLevel": 4}
            },
            {
                "text": "麻婆豆腐",
                "features": {"price": 12.0, "spicyLevel": 5}
            },
            {
                "text": "清炒时蔬",
                "features": {"price": 8.0, "spicyLevel": 0}
            }
        ],
        "version": "v2"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/embed_batch",
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print("✓ 批量嵌入生成成功")
            print(f"  - 版本: {data['version']}")
            print(f"  - 数量: {data['count']}")
            print(f"  - 维度: {data['dimension']}")
            return True
        else:
            print(f"✗ 批量嵌入生成失败: {response.status_code}")
            print(f"  错误: {response.text}")
            return False
    except Exception as e:
        print(f"✗ 请求失败: {e}")
        return False


def test_models_list():
    """测试模型列表"""
    print("\n" + "=" * 60)
    print("测试 4: 列出支持的模型")
    print("=" * 60)
    
    try:
        response = requests.get(f"{BASE_URL}/models", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print("✓ 模型列表获取成功")
            print(f"  - 默认版本: {data['default_version']}")
            print(f"  - 支持版本: {data['supported_versions']}")
            
            for version, info in data['models'].items():
                print(f"\n  模型 {version}:")
                print(f"    - 维度: {info['dimension']}")
                print(f"    - 需要训练: {info['requires_training']}")
                print(f"    - 描述: {info['description']}")
            
            return True
        else:
            print(f"✗ 获取模型列表失败: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ 请求失败: {e}")
        return False


def test_v3_model():
    """测试 v3 模型（如果已训练）"""
    print("\n" + "=" * 60)
    print("测试 5: 测试 v3 Fusion 模型（可选）")
    print("=" * 60)
    
    payload = {
        "text": "宫保鸡丁 麻辣鲜香",
        "features": {
            "price": 18.0,
            "spicyLevel": 4,
            "sweetness": 2
        },
        "version": "v3"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/embed",
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print("✓ v3 模型可用")
            print(f"  - 维度: {data['dimension']}")
            print(f"  - 嵌入向量预览: [{data['embedding'][0]:.4f}, {data['embedding'][1]:.4f}, ...]")
            return True
        else:
            print("⚠ v3 模型未训练或加载失败")
            print("  如需使用 v3 模型，请先运行训练:")
            print("    bash train/train.sh")
            return False
    except Exception as e:
        print(f"✗ 请求失败: {e}")
        return False


def main():
    """运行所有测试"""
    print("\n" + "=" * 60)
    print("TasteInsight 嵌入服务测试")
    print("=" * 60)
    
    results = []
    
    # 必需的测试
    results.append(("健康检查", test_health()))
    
    if not results[0][1]:
        print("\n" + "=" * 60)
        print("✗ 服务未运行，终止测试")
        print("  请先启动服务: python app.py")
        print("=" * 60)
        sys.exit(1)
    
    results.append(("单个嵌入", test_single_embedding()))
    results.append(("批量嵌入", test_batch_embedding()))
    results.append(("模型列表", test_models_list()))
    
    # 可选的测试
    results.append(("v3 模型", test_v3_model()))
    
    # 总结
    print("\n" + "=" * 60)
    print("测试总结")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✓ 通过" if result else "✗ 失败"
        print(f"{status}: {name}")
    
    print("\n" + "-" * 60)
    print(f"总计: {passed}/{total} 测试通过")
    print("=" * 60)
    
    if passed == total:
        print("🎉 所有测试通过！服务运行正常。")
        return 0
    elif passed >= total - 1:  # 允许 v3 测试失败
        print("✓ 核心功能正常。v3 模型可选。")
        return 0
    else:
        print("⚠ 部分测试失败，请检查服务配置。")
        return 1


if __name__ == '__main__':
    sys.exit(main())

