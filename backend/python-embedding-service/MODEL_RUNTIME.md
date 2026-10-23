# 版本模型部署与排序训练

## 部署身份

`GET /model-info/<version>` 返回 `ready/version/kind/artifactDigest/featureSchemaVersion/parameterSchema`；嵌入模型附带 `dimension`。管理平台登记该端点的完整身份，再执行验证。`v2` 为文本与数值拼接；`v3` 需要 `MODEL_DIR/fusion_v3.pt` 的完整且有限的权重。权重缺失、结构不匹配与加载失败均返回未就绪。

嵌入摘要来自已加载文本编码器的权重、分词器与 pooling 配置快照，融合网络的实际参数、编码实现和运行库版本。排序摘要来自实际线性网络参数、数值特征实现和运行库版本。checkpoint 的自报摘要不参与身份认证。进程首次加载后固定模型，部署新产物使用新服务版本并重启进程，向管理平台登记新摘要。身份文件记录部署查询结果与离线评估，服务端计算结果为验证依据。

设置 `PYTHON_EMBEDDING_TOKEN` 启用模型 API 的 Bearer 认证；`/health` 保留为容器探针，检查默认嵌入模型或排序专用部署的模型就绪状态。在后端的 `RECOMMENDATION_MODEL_DEPLOYMENTS` 配置部署 ID：

```json
{"ml-prod":{"url":"http://embedding:5001","token":"replace-with-secret","timeoutMs":5000}}
```

`POST /embed` 使用 `text/features/version/artifactDigest/featureSchemaVersion`。响应包含同一身份及 `dimension/embedding`。旧客户端可省略摘要和 schema；平台运行时始终显式发送全部身份。`POST /rank` 必须发送完整身份以及 `user`、`candidates`，响应 `scores:[{dishId,score}]`。调用方要求每个候选恰有一个有限分数。

排序输入契约 `ranking-numeric-v1`：`user` 与每个候选均含 `price/spicyLevel/sweetness/saltiness/oiliness/averageRating/reviewCount`；候选另含 `dishId`。服务共用训练和推理特征函数，将七项菜品属性与七项用户差值输入 `torch.nn.Linear(14,1)`，经 sigmoid 输出点击概率估计。

仅部署排序时设置 `PYTHON_EMBEDDING_ENABLED=false`，无需加载文本模型。设置 `PYTHON_RANKING_VERSION` 和 `PYTHON_RANKING_CHECKPOINT` 选择版本与训练文件。默认值分别为 `rank-v1`、`saved_models/rank_v1.pt`。健康与就绪请查询具体版本的 `/model-info/<version>`。

## 模型推理参数

`parameterSchema` 由具体模型声明，采用扁平 JSON Schema 对象；每个属性包含类型、中文名称、默认值和数值范围。参数声明、参数计算实现及校验库版本均参与 `artifactDigest`。管理平台读取服务声明，发布后的模型契约固定保存。

| 模型 | 参数 | 类型 | 默认值 | 范围 | 计算位置 |
| --- | --- | --- | --- | --- | --- |
| v2 | `numericWeight` | number | 1 | 0–5 | 文本与数值特征拼接前，数值向量乘以该值，再统一 L2 归一化 |
| 排序线性模型 | `temperature` | number | 1 | 0.25–4 | sigmoid 前的分数除以该值 |
| 排序线性模型 | `pricePenalty` | number | 0 | 0–2 | sigmoid 前扣减该值乘以菜品价格 / 50 |

v3 的声明为 `{"type":"object","additionalProperties":false,"properties":{}}`。排序公式为 `sigmoid((logit - pricePenalty * price / 50) / temperature)`；温度越大，概率越接近 0.5，价格惩罚可以改变候选顺序。

`POST /embed`、`POST /embed-batch`（兼容 `/embed_batch`）、`POST /convert_version` 与 `POST /rank` 接收顶层 `parameters` 对象。服务补齐省略的默认值，在成功响应中返回 `parameterSchema` 和完整的 `appliedParameters`。省略 `parameters` 或传入 `{}` 使用模型默认值。未知字段、类型错误、越界、非有限数值和显式 `null` 返回 HTTP 400。布尔值与数值严格区分，显式 `0` 保留。

单条 v2 请求示例：

```json
{"version":"v2","text":"米饭","features":{"price":10,"averageRating":4.5},"parameters":{"numericWeight":0}}
```

该请求返回 `appliedParameters: {"numericWeight":0}`，788 维向量的最后 20 维为零。文本向量需包含有效特征，最终向量通过平台的有限值与非零校验后进入索引。批量请求将相同的 `parameters` 放在 `items` 外层，对整批生效。

排序请求在完整模型身份、`user` 和 `candidates` 之外增加 `"parameters":{"pricePenalty":2}`，响应补全为 `{"temperature":1,"pricePenalty":2}`。排序策略固定保存完整参数；向量索引固定保存嵌入参数，构建与在线查询使用相同配置。

测试通过真实 PyTorch 线性模型验证分数变化与价格惩罚导致的顺序翻转，通过本地 SentenceTransformer BoW 编码器验证数值权重、零值、单条与批量一致性，并对默认兼容、参数拒绝和身份摘要变化进行回归验证。测试权重与文本编码器用于协议和计算路径验收，模型质量仍需真实数据评估。

## 从真实曝光导出训练样本

在已安装后端依赖、生成 Prisma Client 且配置业务库 `DATABASE_URL` 的环境运行：

```sh
node train/export_ranking_samples.cjs /secure/samples.jsonl 2026-10-01T00:00:00Z
```

导出器读取 `RecommendationDelivery.featureSnapshot` 的下发时特征，关联 `RecommendationFeedback`，只输出发生过 `impression` 的菜品。`click` 为标签 1，其余真实曝光为 0；每个下发与菜品只出现一次。标签采用下发后 24 小时内的曝光与点击，只导出在截止时间前已完成整个观察期的交付。每行保存 `labelWindowEnd`，复现时保存原始导出文件。导出文件包含用户行为特征，应使用受控路径与访问权限。

JSONL 每行：

```json
{"deliveryId":"delivery-id","deliveredAt":"2026-09-01T12:00:00Z","user":{"price":20,"spicyLevel":2,"sweetness":1,"saltiness":2,"oiliness":2,"averageRating":0,"reviewCount":0},"candidate":{"dishId":"dish-id","price":18,"spicyLevel":3,"sweetness":1,"saltiness":2,"oiliness":2,"averageRating":4.2,"reviewCount":30},"label":1}
```

按下发时间切分训练与验证：

```sh
python train/train_ranker.py /secure/samples.jsonl \
  --split-at 2026-09-20T00:00:00Z \
  --version rank-20261001 --output saved_models/rank_20261001.pt
```

同一交付始终归属于一个时间分区。训练集要求标签观察窗结束时间早于切分点，跨越切分点的观察窗进入隔离区，验证集从切分点之后的交付开始。脚本拒绝重复交付菜品、冲突时间戳、缺少任一分区以及训练集只有单一标签。输出 checkpoint 与 `.identity.json`；身份文件记录样本 SHA-256、切分时间、样本量及验证集 log loss。训练脚本使用全批量 Adam，适合小型基线数据。

离线点击预测受曝光策略与样本选择影响。验证 log loss 衡量该时间切分上的预测误差；线上收益通过小流量实验确认。合成样本和测试权重仅作为训练、加载、接口和身份验证材料。

## 验证

```sh
python -m unittest test_config test_model_contract test_model_parameters -v
```

测试覆盖缺失/损坏/非有限的融合权重、排序权重结构和版本、伪造摘要、时间切分、Bearer 认证、重复候选，以及实际本地 SentenceTransformer 编码器的摘要稳定性与输出身份。测试使用临时合成 PyTorch checkpoint 和 768 维 BoW 文本编码器，生产文本模型与真实用户训练数据需单独验收。

## 影子预测与独立时间段评估

`POST /admin/recommendation/shadow` 对相同用户特征执行 2 至 5 个策略，输入最多 20 个用户和每次最多 100 个结果。每个查询包含共享的 `queryId/userId/featureAsOf/predictedAt`，记录各策略实际候选、排序结果、标签、候选目录规模、耗时和回退原因。影子运行采用 preview 路径，保留在线分组、曝光与交付记录的原状态。

在 backend 目录保存请求 `shadow-request.json`：

```json
{"userIds":["user-id"],"strategyRevisionIds":["published-baseline-id","published-candidate-id"],"filter":{},"pageSize":100}
```

由环境变量提供管理员访问令牌，采集脚本保存原始 API 响应。输出文件采用独占创建和 0600 权限，已有文件保持原状。

```sh
node scripts/recommendation-evaluate.cjs collect \
  --url https://admin.example.com/admin/recommendation/shadow \
  --request shadow-request.json --output shadow-runs.json
```

`ADMIN_TOKEN` 通过运行环境提供。采集脚本的输出只显示保存路径。也可以自行保存影子 API 的完整 JSON 响应，或将 `data.runs` 的每项保存为一行 JSONL。

等待预先规定的观察窗口结束后，准备独立正反馈标签 JSONL。每行包含用户、菜品与真实发生时间：

```json
{"userId":"user-id","dishId":"dish-id","eventAt":"2026-09-22T12:30:00Z"}
```

训练截止、验证截止和独立测试区间严格递增。示例：

```sh
node scripts/recommendation-evaluate.cjs \
  --runs shadow-runs.json --labels heldout-labels.jsonl \
  --train-until 2026-09-01T00:00:00Z \
  --validation-until 2026-09-15T00:00:00Z \
  --test-start 2026-09-20T00:00:00Z \
  --test-end 2026-09-30T00:00:00Z \
  --label-window-hours 24 --k 10 --output evaluation.json
```

评估器要求 `featureAsOf <= predictedAt`、预测位于测试区间且完整观察窗口在测试结束前成熟。相关性标签取同一用户的 `(predictedAt, predictedAt + window]`；同一菜品为二元相关项，重复事件不会增加权重。同一个 queryId 的用户、特征时间、预测时间、历史数量和目录规模必须一致，每个查询须包含相同策略版本集合，每个查询与策略只能有一条预测。标签文件仅包含独立测试区间内的事件。

报告按策略分别给出总体、`historyCount=0` 冷启动和已有历史用户三组指标：

- `candidateRecallAtK`：候选记录前 K 项命中的未来相关菜品数 / 未来相关菜品总数；`candidateRecallAll` 使用完整候选集合。
- `ndcgAtK`：最终排序前 K 项的二元 NDCG；`hitRateAtK`：前 K 项至少命中一个未来相关菜品的查询比例。
- `coverageAtK`：该组前 K 项出现过的不同菜品数 / 固定目录规模。比较数据须使用相同目录快照；评估器校验目录规模一致，目录成员一致性由采集过程保证。
- `diversityAtK`：结果列表内菜品标签的两两 Jaccard 距离均值。双方标签均空的配对跳过；不足两项有效标签的列表跳过。标签丰富度会影响该指标。
- 平均、P50、P95 延迟及回退比例；分位数使用 nearest-rank。

缺少未来相关项的查询单独计数，并进入覆盖、多样性、耗时和回退统计；相关性均值仅统计存在相关项的查询。某分层缺少可计算样本时返回 `null`。正反馈缺失代表相关性未被观察，受原有曝光策略和用户活跃度影响。

这套流程评价事先保存的预测与后续观察事件。切分参数声明数据边界，训练产物的来源与实际训练截止需要实验记录佐证；单凭参数与文件时间无法证明训练历史。离线结果用于策略筛选，线上增益通过独立实验验证。合成标签与测试服务仅验证指标计算及运行协议。

执行评价器测试：

```sh
node --test scripts/recommendation-evaluate.test.cjs
```
