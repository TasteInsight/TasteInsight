"""
训练 Fusion 模型 (v3)
使用三元组损失（Triplet Loss）训练神经网络融合模型
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import numpy as np
from typing import List, Tuple
import logging
from tqdm import tqdm
import argparse
from datetime import datetime

from encoders import TextEncoder, NumericEncoder
from models.fusion import FeatureFusionMLP
from train.dataset import DishDataset, get_db_config_from_env

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class TripletDataset(Dataset):
    """三元组数据集"""
    
    def __init__(self, 
                 triplets: List[Tuple[int, int, int]],
                 text_embeddings: np.ndarray,
                 numeric_embeddings: np.ndarray):
        """
        Args:
            triplets: (anchor_idx, positive_idx, negative_idx)
            text_embeddings: 文本嵌入矩阵 [N, 768]
            numeric_embeddings: 数值嵌入矩阵 [N, 20]
        """
        self.triplets = triplets
        self.text_embs = text_embeddings
        self.numeric_embs = numeric_embeddings
    
    def __len__(self):
        return len(self.triplets)
    
    def __getitem__(self, idx):
        anchor_idx, pos_idx, neg_idx = self.triplets[idx]
        
        return {
            'anchor_text': self.text_embs[anchor_idx],
            'anchor_numeric': self.numeric_embs[anchor_idx],
            'positive_text': self.text_embs[pos_idx],
            'positive_numeric': self.numeric_embs[pos_idx],
            'negative_text': self.text_embs[neg_idx],
            'negative_numeric': self.numeric_embs[neg_idx],
        }


class TripletLoss(nn.Module):
    """三元组损失"""
    
    def __init__(self, margin=0.5):
        super().__init__()
        self.margin = margin
    
    def forward(self, anchor, positive, negative):
        """
        Args:
            anchor: [batch, dim]
            positive: [batch, dim]
            negative: [batch, dim]
        """
        # 计算距离
        pos_dist = torch.sum((anchor - positive) ** 2, dim=1)
        neg_dist = torch.sum((anchor - negative) ** 2, dim=1)
        
        # 三元组损失
        loss = torch.relu(pos_dist - neg_dist + self.margin)
        
        return loss.mean()


def encode_all_dishes(dishes: List[dict], 
                      text_encoder: TextEncoder,
                      numeric_encoder: NumericEncoder) -> Tuple[np.ndarray, np.ndarray]:
    """
    批量编码所有菜品
    
    Returns:
        (text_embeddings, numeric_embeddings)
    """
    logger.info("Encoding all dishes...")
    
    texts = [dish['text'] for dish in dishes]
    features = [dish['features'] for dish in dishes]
    
    # 批量编码
    text_embs = text_encoder.encode(texts)
    numeric_embs = numeric_encoder.encode(features)
    
    logger.info(f"Encoded {len(dishes)} dishes")
    logger.info(f"  Text embeddings: {text_embs.shape}")
    logger.info(f"  Numeric embeddings: {numeric_embs.shape}")
    
    return text_embs, numeric_embs


def train_epoch(model: nn.Module,
                dataloader: DataLoader,
                criterion: nn.Module,
                optimizer: optim.Optimizer,
                device: str) -> float:
    """训练一个 epoch"""
    model.train()
    total_loss = 0.0
    
    pbar = tqdm(dataloader, desc="Training")
    for batch in pbar:
        # 移动到设备
        anchor_text = batch['anchor_text'].to(device)
        anchor_numeric = batch['anchor_numeric'].to(device)
        positive_text = batch['positive_text'].to(device)
        positive_numeric = batch['positive_numeric'].to(device)
        negative_text = batch['negative_text'].to(device)
        negative_numeric = batch['negative_numeric'].to(device)
        
        # 前向传播
        anchor_emb = model(anchor_text, anchor_numeric)
        positive_emb = model(positive_text, positive_numeric)
        negative_emb = model(negative_text, negative_numeric)
        
        # 归一化
        anchor_emb = torch.nn.functional.normalize(anchor_emb, p=2, dim=1)
        positive_emb = torch.nn.functional.normalize(positive_emb, p=2, dim=1)
        negative_emb = torch.nn.functional.normalize(negative_emb, p=2, dim=1)
        
        # 计算损失
        loss = criterion(anchor_emb, positive_emb, negative_emb)
        
        # 反向传播
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        
        total_loss += loss.item()
        pbar.set_postfix({'loss': f'{loss.item():.4f}'})
    
    return total_loss / len(dataloader)


def evaluate(model: nn.Module,
             dataloader: DataLoader,
             criterion: nn.Module,
             device: str) -> Tuple[float, float]:
    """评估模型"""
    model.eval()
    total_loss = 0.0
    correct = 0
    total = 0
    
    with torch.no_grad():
        for batch in tqdm(dataloader, desc="Evaluating"):
            # 移动到设备
            anchor_text = batch['anchor_text'].to(device)
            anchor_numeric = batch['anchor_numeric'].to(device)
            positive_text = batch['positive_text'].to(device)
            positive_numeric = batch['positive_numeric'].to(device)
            negative_text = batch['negative_text'].to(device)
            negative_numeric = batch['negative_numeric'].to(device)
            
            # 前向传播
            anchor_emb = model(anchor_text, anchor_numeric)
            positive_emb = model(positive_text, positive_numeric)
            negative_emb = model(negative_text, negative_numeric)
            
            # 归一化
            anchor_emb = torch.nn.functional.normalize(anchor_emb, p=2, dim=1)
            positive_emb = torch.nn.functional.normalize(positive_emb, p=2, dim=1)
            negative_emb = torch.nn.functional.normalize(negative_emb, p=2, dim=1)
            
            # 损失
            loss = criterion(anchor_emb, positive_emb, negative_emb)
            total_loss += loss.item()
            
            # 准确率：正样本距离 < 负样本距离
            pos_dist = torch.sum((anchor_emb - positive_emb) ** 2, dim=1)
            neg_dist = torch.sum((anchor_emb - negative_emb) ** 2, dim=1)
            correct += (pos_dist < neg_dist).sum().item()
            total += len(anchor_emb)
    
    avg_loss = total_loss / len(dataloader)
    accuracy = correct / total
    
    return avg_loss, accuracy


def main():
    parser = argparse.ArgumentParser(description='Train Fusion Model')
    parser.add_argument('--output', type=str, default='saved_models/fusion_v3.pt',
                        help='Output model path')
    parser.add_argument('--epochs', type=int, default=50,
                        help='Number of training epochs')
    parser.add_argument('--batch_size', type=int, default=256,
                        help='Batch size')
    parser.add_argument('--lr', type=float, default=0.001,
                        help='Learning rate')
    parser.add_argument('--margin', type=float, default=0.5,
                        help='Triplet loss margin')
    parser.add_argument('--num_negatives', type=int, default=2,
                        help='Number of negative samples per positive')
    parser.add_argument('--min_interactions', type=int, default=5,
                        help='Minimum interactions for a dish')
    parser.add_argument('--device', type=str, default=None,
                        help='Device (cuda/cpu), None for auto')
    
    args = parser.parse_args()
    
    # 设备
    if args.device:
        device = args.device
    else:
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
    
    logger.info(f"Using device: {device}")
    
    # 1. 加载数据
    logger.info("=" * 60)
    logger.info("Loading data from database...")
    logger.info("=" * 60)
    
    db_config = get_db_config_from_env()
    dataset = DishDataset(
        db_config=db_config,
        min_interactions=args.min_interactions,
        test_ratio=0.2
    )
    
    dishes = dataset.load_dishes()
    interactions = dataset.load_interactions()
    
    if len(dishes) < 100:
        logger.error(f"Too few dishes: {len(dishes)}. Need at least 100.")
        return
    
    # 2. 编码菜品
    logger.info("=" * 60)
    logger.info("Encoding dishes...")
    logger.info("=" * 60)
    
    text_encoder = TextEncoder(device=device)
    numeric_encoder = NumericEncoder()
    
    text_embs, numeric_embs = encode_all_dishes(dishes, text_encoder, numeric_encoder)
    
    # 3. 生成三元组
    logger.info("=" * 60)
    logger.info("Generating triplets...")
    logger.info("=" * 60)
    
    triplets = dataset.generate_triplets(num_negatives=args.num_negatives)
    train_triplets, test_triplets = dataset.split_data(triplets)
    
    # 4. 创建数据加载器
    train_dataset = TripletDataset(train_triplets, text_embs, numeric_embs)
    test_dataset = TripletDataset(test_triplets, text_embs, numeric_embs)
    
    train_loader = DataLoader(train_dataset, batch_size=args.batch_size, shuffle=True)
    test_loader = DataLoader(test_dataset, batch_size=args.batch_size, shuffle=False)
    
    # 5. 创建模型
    logger.info("=" * 60)
    logger.info("Creating model...")
    logger.info("=" * 60)
    
    model = FeatureFusionMLP(text_dim=768, numeric_dim=20, output_dim=256)
    model.to(device)
    
    logger.info(f"Model parameters: {sum(p.numel() for p in model.parameters())}")
    
    # 6. 训练配置
    criterion = TripletLoss(margin=args.margin)
    optimizer = optim.Adam(model.parameters(), lr=args.lr)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode='min', factor=0.5, patience=5, verbose=True
    )
    
    # 7. 训练循环
    logger.info("=" * 60)
    logger.info("Training...")
    logger.info("=" * 60)
    
    best_loss = float('inf')
    best_accuracy = 0.0
    
    for epoch in range(args.epochs):
        logger.info(f"\nEpoch {epoch + 1}/{args.epochs}")
        
        # 训练
        train_loss = train_epoch(model, train_loader, criterion, optimizer, device)
        
        # 评估
        test_loss, test_accuracy = evaluate(model, test_loader, criterion, device)
        
        # 学习率调度
        scheduler.step(test_loss)
        
        logger.info(f"Train Loss: {train_loss:.4f}")
        logger.info(f"Test Loss: {test_loss:.4f}, Accuracy: {test_accuracy:.4f}")
        
        # 保存最佳模型
        if test_loss < best_loss:
            best_loss = test_loss
            best_accuracy = test_accuracy
            
            # 保存检查点
            checkpoint = {
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'train_loss': train_loss,
                'test_loss': test_loss,
                'test_accuracy': test_accuracy,
                'args': vars(args),
                'timestamp': datetime.now().isoformat(),
            }
            
            os.makedirs(os.path.dirname(args.output), exist_ok=True)
            torch.save(checkpoint, args.output)
            logger.info(f"✓ Saved best model to {args.output}")
    
    # 8. 训练完成
    logger.info("=" * 60)
    logger.info("Training completed!")
    logger.info("=" * 60)
    logger.info(f"Best Test Loss: {best_loss:.4f}")
    logger.info(f"Best Test Accuracy: {best_accuracy:.4f}")
    logger.info(f"Model saved to: {args.output}")


if __name__ == '__main__':
    main()

