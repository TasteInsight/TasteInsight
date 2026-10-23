"""模型参数默认值和 JSON Schema 校验。"""
import math
from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError

EMPTY_PARAMETER_SCHEMA = {'type': 'object', 'additionalProperties': False, 'properties': {}}


def resolve_parameters(schema, parameters):
    """校验调用参数并补齐模型声明的默认值，保留显式零值。"""
    try:
        Draft202012Validator(schema).validate(parameters)
    except ValidationError as error:
        path = '.'.join(str(item) for item in error.path)
        raise ValueError(f'Invalid parameters{("." + path) if path else ""}: {error.message}') from error
    for name, value in parameters.items():
        if isinstance(value, (int, float)) and not isinstance(value, bool) and not math.isfinite(value):
            raise ValueError(f'Invalid parameters.{name}: a finite number is required')
    return {name: parameters.get(name, definition['default'])
            for name, definition in schema['properties'].items()}
