#!/bin/bash
#
# K6 性能测试运行脚本 - 生产环境
#
# 用法:
#   ./run-prod-test.sh connectivity   # 连通性测试
#   ./run-prod-test.sh full           # 完整测试套件
#   ./run-prod-test.sh scenario <name> # 单场景测试
#
# 示例:
#   ./run-prod-test.sh connectivity
#   ./run-prod-test.sh full
#   ./run-prod-test.sh scenario dish-status
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../../.env"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}   K6 性能测试 - 生产环境${NC}"
echo -e "${YELLOW}========================================${NC}"

# 检查 .env 文件
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}错误: 找不到 .env 文件: $ENV_FILE${NC}"
    echo "请确保 backend/.env 文件存在并包含以下变量:"
    echo "  INITIAL_ADMIN_USERNAME=xxx"
    echo "  INITIAL_ADMIN_PASSWORD=xxx"
    exit 1
fi

# 加载环境变量
echo -e "\n${GREEN}[1/3] 加载环境变量...${NC}"
set -a
source "$ENV_FILE"
set +a

# 验证必要变量
if [ -z "$INITIAL_ADMIN_USERNAME" ] || [ -z "$INITIAL_ADMIN_PASSWORD" ]; then
    echo -e "${RED}错误: .env 文件中缺少 INITIAL_ADMIN_USERNAME 或 INITIAL_ADMIN_PASSWORD${NC}"
    exit 1
fi

echo "  ├─ 用户名: $INITIAL_ADMIN_USERNAME"
echo "  └─ 密码: ********"

# 检查 K6
echo -e "\n${GREEN}[2/3] 检查 K6 安装...${NC}"
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}错误: K6 未安装${NC}"
    echo "请先安装 K6: https://k6.io/docs/get-started/installation/"
    exit 1
fi
echo "  └─ K6 版本: $(k6 version)"

# 执行测试
echo -e "\n${GREEN}[3/3] 执行测试...${NC}"
cd "$SCRIPT_DIR"

case "${1:-connectivity}" in
    connectivity|conn|c)
        echo "  └─ 运行连通性测试..."
        k6 run -e ENV=production \
            -e INITIAL_ADMIN_USERNAME="$INITIAL_ADMIN_USERNAME" \
            -e INITIAL_ADMIN_PASSWORD="$INITIAL_ADMIN_PASSWORD" \
            connectivity-test.js
        ;;
    full|all|f)
        echo "  └─ 运行完整测试套件..."
        TIMESTAMP=$(date +%Y%m%d_%H%M%S)
        k6 run -e ENV=production \
            -e INITIAL_ADMIN_USERNAME="$INITIAL_ADMIN_USERNAME" \
            -e INITIAL_ADMIN_PASSWORD="$INITIAL_ADMIN_PASSWORD" \
            --out json="prod_result_${TIMESTAMP}.json" \
            main.js 2>&1 | tee "prod_run_${TIMESTAMP}.log"
        echo -e "\n${GREEN}测试完成！${NC}"
        echo "  ├─ 日志: prod_run_${TIMESTAMP}.log"
        echo "  └─ 结果: prod_result_${TIMESTAMP}.json"
        ;;
    scenario|s)
        if [ -z "$2" ]; then
            echo -e "${RED}请指定场景名称，例如: ./run-prod-test.sh scenario dish-status${NC}"
            echo "可用场景:"
            ls -1 scenarios/*.js | xargs -n1 basename | sed 's/.js$//'
            exit 1
        fi
        SCENARIO_FILE="scenarios/${2}.js"
        if [ ! -f "$SCENARIO_FILE" ]; then
            echo -e "${RED}错误: 找不到场景文件 $SCENARIO_FILE${NC}"
            exit 1
        fi
        echo "  └─ 运行单场景: $2..."
        k6 run -e ENV=production \
            -e INITIAL_ADMIN_USERNAME="$INITIAL_ADMIN_USERNAME" \
            -e INITIAL_ADMIN_PASSWORD="$INITIAL_ADMIN_PASSWORD" \
            --iterations 3 --vus 1 \
            "$SCENARIO_FILE"
        ;;
    *)
        echo "用法: $0 {connectivity|full|scenario <name>}"
        echo ""
        echo "命令:"
        echo "  connectivity  - 连通性测试（默认）"
        echo "  full          - 完整测试套件"
        echo "  scenario <name> - 单场景测试"
        exit 1
        ;;
esac

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}   测试执行完毕${NC}"
echo -e "${GREEN}========================================${NC}"
