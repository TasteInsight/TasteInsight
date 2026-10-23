"""从实际运行的权重、编码器文件和实现计算模型身份。"""
import hashlib
import importlib.metadata
import json
from pathlib import Path


def source_digest(*paths):
    digest = hashlib.sha256()
    for path in paths:
        digest.update(Path(path).read_bytes())
    return digest.hexdigest()


def state_digest(state):
    digest = hashlib.sha256()
    for name, tensor in sorted(state.items()):
        value = tensor.detach().cpu().contiguous()
        digest.update(name.encode())
        digest.update(str(value.dtype).encode())
        digest.update(str(tuple(value.shape)).encode())
        digest.update(value.numpy().tobytes())
    return digest.hexdigest()


def identity_digest(parts):
    versions = {}
    for package in ('torch', 'numpy', 'transformers', 'sentence-transformers'):
        try:
            versions[package] = importlib.metadata.version(package)
        except importlib.metadata.PackageNotFoundError:
            pass
    return 'sha256:' + hashlib.sha256(json.dumps(
        {'components': parts, 'libraries': versions}, sort_keys=True,
        separators=(',', ':')).encode()).hexdigest()
