"""使用真实曝光样本训练线性点击预测基线，按下发时间切分。"""
import argparse
from datetime import datetime
import json
from pathlib import Path
import sys
import hashlib
import torch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services.ranking_service import FEATURE_SCHEMA, INPUT_DIM, RankingService, pair_features


def split_samples(rows, split_at):
    boundary = datetime.fromisoformat(split_at.replace('Z', '+00:00'))
    train, validation = [], []
    deliveries = {}
    seen = set()
    for row in rows:
        timestamp = datetime.fromisoformat(row['deliveredAt'].replace('Z', '+00:00'))
        delivery = row['deliveryId']
        if delivery in deliveries and deliveries[delivery] != timestamp:
            raise ValueError('Delivery timestamps must be consistent')
        deliveries[delivery] = timestamp
        key = (delivery, row['candidate']['dishId'])
        if key in seen:
            raise ValueError('Duplicate delivery candidate')
        seen.add(key)
        if type(row['label']) is not int or row['label'] not in (0, 1):
            raise ValueError('Labels must be binary clicks')
        window_end = datetime.fromisoformat(row.get('labelWindowEnd', row['deliveredAt']).replace('Z', '+00:00'))
        if window_end < timestamp:
            raise ValueError('Label window must end after delivery')
        if timestamp >= boundary:
            validation.append(row)
        elif window_end <= boundary:
            train.append(row)
    if not train or not validation:
        raise ValueError('Both temporal partitions require observed examples')
    return train, validation


def tensor_data(rows):
    return (torch.tensor([pair_features(row['user'], row['candidate']) for row in rows], dtype=torch.float32),
            torch.tensor([[row['label']] for row in rows], dtype=torch.float32))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('samples')
    parser.add_argument('--split-at', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--version', default='rank-v1')
    parser.add_argument('--epochs', type=int, default=200)
    args = parser.parse_args()
    if args.epochs < 1:
        raise ValueError('epochs must be positive')
    output = Path(args.output)
    if output.exists() or output.with_suffix('.identity.json').exists():
        raise FileExistsError('Choose a new model artifact path')
    raw = Path(args.samples).read_bytes()
    train, validation = split_samples([json.loads(line) for line in raw.splitlines() if line.strip()], args.split_at)
    if len({row['label'] for row in train}) < 2:
        raise ValueError('Training requires both clicked and unclicked impressions')
    train_x, train_y = tensor_data(train)
    val_x, val_y = tensor_data(validation)
    torch.manual_seed(42)
    model = torch.nn.Linear(INPUT_DIM, 1)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.01, weight_decay=0.001)
    loss_fn = torch.nn.BCEWithLogitsLoss()
    for _ in range(args.epochs):
        optimizer.zero_grad()
        loss = loss_fn(model(train_x), train_y)
        loss.backward()
        optimizer.step()
    with torch.no_grad():
        validation_loss = float(loss_fn(model(val_x), val_y))
    output.parent.mkdir(parents=True, exist_ok=True)
    torch.save({'version': args.version, 'featureSchemaVersion': FEATURE_SCHEMA, 'model_state_dict': model.state_dict()}, output)
    identity = RankingService(str(output), args.version).get_model_identity()
    report = {**identity, 'sampleDigest': hashlib.sha256(raw).hexdigest(), 'splitAt': args.split_at,
              'trainCount': len(train), 'validationCount': len(validation), 'validationLogLoss': validation_loss,
              'evaluation': 'temporal-held-out-click-prediction; online effect requires an experiment'}
    output.with_suffix('.identity.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
