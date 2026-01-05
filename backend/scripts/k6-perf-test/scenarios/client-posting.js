/**
 * 场景 3：发布评价 (Posting Reviews)
 * 
 * 模拟用户发布评价的完整流程：
 * 登录 -> 搜索菜品 -> 查看详情 -> 发布评价 -> 查看用户发布的评价
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { BASE_URL, DEFAULT_HEADERS, THRESHOLDS } from '../config.js';
import { createClientSession, getAuthHeaders } from './client-auth.js';

// 自定义指标
const postingErrors = new Counter('client_posting_errors');
const postReviewDuration = new Trend('client_post_review_duration', true);
const userReviewsDuration = new Trend('client_user_reviews_duration', true);
const profileDuration = new Trend('client_profile_duration', true);

export const options = {
    scenarios: {
        client_posting: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '10s', target: 2 },   // 预热（写操作用较少VU）
                { duration: '1m', target: 5 },    // 正常负载
                { duration: '30s', target: 8 },   // 峰值
                { duration: '10s', target: 0 },   // 冷却
            ],
            gracefulRampDown: '10s',
        },
    },
    thresholds: {
        'http_req_duration': ['p(95)<1500'],
        'http_req_duration{name:client_post_review}': ['p(95)<800'],
        'http_req_duration{name:client_get_user_reviews}': ['p(95)<500'],
        'http_req_duration{name:client_get_profile}': ['p(95)<300'],
        'http_req_failed': ['rate<0.05'],
    },
};

// 评价内容模板
const REVIEW_CONTENTS = [
    '非常好吃！肉质鲜嫩，调味恰到好处',
    '价格实惠，分量十足，推荐！',
    '味道一般，可能不太符合我的口味',
    '食材新鲜，做工精细，值得一试',
    '性价比很高，会再来的',
    '环境整洁，服务也很好',
    '等待时间有点长，但味道不错',
    '分量够大，一个人吃足够了'
];

// 随机评分生成
function randomRating() {
    return Math.floor(Math.random() * 3) + 3; // 3-5分
}

export default function() {
    // 1. 登录（使用 secondary 用户避免与其他场景冲突）
    const session = createClientSession('secondary');
    if (!session) {
        postingErrors.add(1);
        console.error('登录失败，跳过本次迭代');
        return;
    }
    
    const headers = session.headers;
    let dishId = null;
    let createdReviewId = null;

    // 2. 搜索菜品，获取可评价的菜品
    group('搜索可评价菜品', () => {
        const searchPayload = JSON.stringify({
            filter: {},
            search: { keyword: '' },
            sort: {
                field: 'createdAt',
                order: 'desc'
            },
            pagination: {
                page: 1,
                pageSize: 50  // 获取更多菜品供选择
            }
        });

        const res = http.post(`${BASE_URL}/dishes`, searchPayload, {
            headers,
            tags: { name: 'client_search_for_review' }
        });

        const success = check(res, {
            '搜索菜品 - 状态码 200': (r) => r.status === 200,
        });

        if (success) {
            try {
                const body = JSON.parse(res.body);
                if (body.code === 200 && body.data?.items?.length > 0) {
                    // 使用 VU ID + 迭代次数 + 时间戳组合选择菜品，避免同一用户对同一菜品的 upsert 冲突
                    const dishes = body.data.items;
                    const vuId = __VU || 1;
                    const iter = __ITER || 0;
                    const index = (vuId * 11 + iter * 5 + Date.now()) % dishes.length;
                    dishId = dishes[index].id;
                }
            } catch (e) {
                console.error('解析搜索响应失败');
            }
        }
    });

    if (!dishId) {
        console.warn('未找到可评价菜品，跳过发布评价测试');
        return;
    }

    sleep(0.3);

    // 3. 查看菜品详情
    group('查看菜品详情', () => {
        const res = http.get(`${BASE_URL}/dishes/${dishId}`, {
            headers,
            tags: { name: 'client_dish_detail_for_review' }
        });

        check(res, {
            '菜品详情 - 状态码 200': (r) => r.status === 200,
        });
    });

    sleep(0.5);

    // 4. 发布评价
    group('发布评价', () => {
        const timestamp = Date.now();
        const randomContent = REVIEW_CONTENTS[Math.floor(Math.random() * REVIEW_CONTENTS.length)];
        
        const reviewPayload = JSON.stringify({
            dishId: dishId,
            rating: randomRating(),
            content: `[K6 测试评价] ${randomContent} (${timestamp})`
        });

        const res = http.post(`${BASE_URL}/reviews`, reviewPayload, {
            headers,
            tags: { name: 'client_post_review' }
        });

        postReviewDuration.add(res.timings.duration);

        const success = check(res, {
            '发布评价 - 状态码正确': (r) => r.status === 200 || r.status === 201,
            '发布评价 - 返回评价ID': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    // 响应体 code 可能是 200 或 201（创建成功）
                    if (body.code >= 200 && body.code < 300 && body.data?.id) {
                        createdReviewId = body.data.id;
                        return true;
                    }
                    return false;
                } catch {
                    return false;
                }
            }
        });

        if (!success) {
            postingErrors.add(1);
            console.error(`发布评价失败: ${res.status} - ${res.body}`);
        } else {
            console.log(`成功发布评价: ${createdReviewId} for 菜品 ${dishId}`);
        }
    });

    sleep(0.3);

    // 5. 查看用户个人资料
    group('查看个人资料', () => {
        const res = http.get(`${BASE_URL}/user/profile`, {
            headers,
            tags: { name: 'client_get_profile' }
        });

        profileDuration.add(res.timings.duration);

        check(res, {
            '个人资料 - 状态码 200': (r) => r.status === 200,
            '个人资料 - 返回用户信息': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    return body.code === 200 && body.data?.id !== undefined;
                } catch {
                    return false;
                }
            }
        });
    });

    sleep(0.3);

    // 6. 查看用户发布的评价列表
    group('查看我的评价', () => {
        const res = http.get(`${BASE_URL}/user/reviews?page=1&pageSize=10`, {
            headers,
            tags: { name: 'client_get_user_reviews' }
        });

        userReviewsDuration.add(res.timings.duration);

        check(res, {
            '我的评价 - 状态码 200': (r) => r.status === 200,
            '我的评价 - 返回列表': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    return body.code === 200;
                } catch {
                    return false;
                }
            }
        });
    });

    // 7. 清理测试数据（删除创建的评价）
    if (createdReviewId) {
        group('清理测试数据', () => {
            const res = http.del(`${BASE_URL}/reviews/${createdReviewId}`, null, {
                headers,
                tags: { name: 'client_delete_review' }
            });

            check(res, {
                '删除评价 - 成功': (r) => r.status === 200 || r.status === 204 || r.status === 404
            });

            if (res.status === 200 || res.status === 204) {
                console.log(`已清理测试评价: ${createdReviewId}`);
            }
        });
    }

    sleep(1);
}
