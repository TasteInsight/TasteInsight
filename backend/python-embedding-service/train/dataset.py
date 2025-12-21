"""
数据集加载和预处理
"""

import psycopg2
import numpy as np
from typing import List, Dict, Tuple
import logging

logger = logging.getLogger(__name__)


class DishDataset:
    """菜品数据集加载器"""
    
    def __init__(self, 
                 db_config: Dict,
                 min_interactions: int = 5,
                 test_ratio: float = 0.2):
        """
        Args:
            db_config: 数据库配置
            min_interactions: 最少交互数（过滤低频菜品）
            test_ratio: 测试集比例
        """
        self.db_config = db_config
        self.min_interactions = min_interactions
        self.test_ratio = test_ratio
        
        self.dishes = []
        self.interactions = []
        
    def connect_db(self):
        """连接数据库"""
        return psycopg2.connect(**self.db_config)
    
    def load_dishes(self) -> List[Dict]:
        """
        从数据库加载菜品数据
        
        Returns:
            菜品列表，每个菜品包含:
            - id: 菜品ID
            - text: 文本描述
            - features: 数值特征字典
        """
        logger.info("Loading dishes from database...")
        
        conn = self.connect_db()
        cursor = conn.cursor()
        
        query = """
        SELECT 
            d.id,
            d.name,
            d.description,
            d.price,
            d."spicyLevel",
            d.sweetness,
            d.saltiness,
            d.sourness,
            d.bitterness,
            d.oiliness,
            d."averageRating",
            d."reviewCount"
        FROM "Dish" d
        WHERE d."reviewCount" >= %s
        ORDER BY d."reviewCount" DESC
        """
        
        cursor.execute(query, (self.min_interactions,))
        rows = cursor.fetchall()
        
        dishes = []
        for row in rows:
            dish = {
                'id': row[0],
                'text': f"{row[1]} {row[2] or ''}".strip(),
                'features': {
                    'price': float(row[3]) if row[3] else 0.0,
                    'spicyLevel': int(row[4]) if row[4] else 0,
                    'sweetness': int(row[5]) if row[5] else 0,
                    'saltiness': int(row[6]) if row[6] else 0,
                    'sourness': int(row[7]) if row[7] else 0,
                    'bitterness': int(row[8]) if row[8] else 0,
                    'oiliness': int(row[9]) if row[9] else 0,
                    'averageRating': float(row[10]) if row[10] else 0.0,
                    'reviewCount': int(row[11]) if row[11] else 0,
                }
            }
            dishes.append(dish)
        
        cursor.close()
        conn.close()
        
        logger.info(f"Loaded {len(dishes)} dishes")
        self.dishes = dishes
        return dishes
    
    def load_interactions(self) -> List[Tuple[int, int, float]]:
        """
        加载用户-菜品交互数据（评分、收藏等）
        
        Returns:
            交互三元组列表: (user_id, dish_id, score)
        """
        logger.info("Loading user interactions...")
        
        conn = self.connect_db()
        cursor = conn.cursor()
        
        # 评论作为正样本（评分 >= 3.5）
        query_reviews = """
        SELECT 
            r."userId",
            r."dishId",
            r.rating
        FROM "Review" r
        WHERE r.rating >= 3.5
        """
        
        cursor.execute(query_reviews)
        reviews = cursor.fetchall()
        
        # 收藏作为正样本
        query_favorites = """
        SELECT 
            mp."userId",
            mp."dishId",
            5.0 as score
        FROM "MealPlanItem" mp
        """
        
        cursor.execute(query_favorites)
        favorites = cursor.fetchall()
        
        # 合并
        interactions = reviews + favorites
        
        cursor.close()
        conn.close()
        
        logger.info(f"Loaded {len(interactions)} interactions")
        logger.info(f"  - Reviews: {len(reviews)}")
        logger.info(f"  - Favorites: {len(favorites)}")
        
        self.interactions = interactions
        return interactions
    
    def generate_triplets(self, num_negatives: int = 1) -> List[Tuple]:
        """
        生成三元组训练数据 (anchor, positive, negative)
        
        Args:
            num_negatives: 每个正样本对应的负样本数
            
        Returns:
            三元组列表
        """
        logger.info("Generating training triplets...")
        
        if not self.dishes or not self.interactions:
            raise ValueError("Must load dishes and interactions first")
        
        # 构建用户交互字典
        user_dishes = {}
        for user_id, dish_id, score in self.interactions:
            if user_id not in user_dishes:
                user_dishes[user_id] = set()
            user_dishes[user_id].add(dish_id)
        
        # 所有菜品ID集合
        all_dish_ids = {dish['id'] for dish in self.dishes}
        dish_id_to_idx = {dish['id']: i for i, dish in enumerate(self.dishes)}
        
        triplets = []
        
        for user_id, positive_dish_ids in user_dishes.items():
            positive_list = list(positive_dish_ids)
            negative_pool = list(all_dish_ids - positive_dish_ids)
            
            if len(negative_pool) == 0:
                continue
            
            # 为每个正样本生成负样本
            for pos_dish_id in positive_list:
                if pos_dish_id not in dish_id_to_idx:
                    continue
                
                # 随机采样负样本
                neg_samples = np.random.choice(
                    negative_pool, 
                    size=min(num_negatives, len(negative_pool)),
                    replace=False
                )
                
                for neg_dish_id in neg_samples:
                    if neg_dish_id not in dish_id_to_idx:
                        continue
                    
                    triplets.append((
                        dish_id_to_idx[pos_dish_id],  # anchor (使用正样本作为anchor)
                        dish_id_to_idx[pos_dish_id],  # positive (相同)
                        dish_id_to_idx[neg_dish_id],  # negative
                    ))
        
        logger.info(f"Generated {len(triplets)} triplets")
        return triplets
    
    def split_data(self, triplets: List[Tuple]) -> Tuple[List, List]:
        """
        划分训练集和测试集
        
        Args:
            triplets: 三元组列表
            
        Returns:
            (train_triplets, test_triplets)
        """
        n = len(triplets)
        n_test = int(n * self.test_ratio)
        
        # 随机打乱
        indices = np.random.permutation(n)
        
        test_indices = indices[:n_test]
        train_indices = indices[n_test:]
        
        train_triplets = [triplets[i] for i in train_indices]
        test_triplets = [triplets[i] for i in test_indices]
        
        logger.info(f"Split: {len(train_triplets)} train, {len(test_triplets)} test")
        
        return train_triplets, test_triplets


def get_db_config_from_env() -> Dict:
    """从环境变量获取数据库配置"""
    import os
    
    return {
        'host': os.getenv('DB_HOST', 'localhost'),
        'port': int(os.getenv('DB_PORT', 5432)),
        'database': os.getenv('DB_NAME', 'tasteinsight'),
        'user': os.getenv('DB_USER', 'postgres'),
        'password': os.getenv('DB_PASSWORD', ''),
    }

