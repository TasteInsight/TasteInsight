/**
 * 场景 2：社交互动 (Social Interaction)
 *
 * 模拟用户的社交互动行为：
 * 登录 -> 查看评价列表 -> 发布评价 -> 发布评论 -> 收藏菜品 -> 清理数据
 *
 * 优化说明：
 * - 每个VU使用基于VU ID的菜品选择，避免不同VU操作同一菜品导致的upsert冲突
 * - 评论只在自己创建的评价上发布，确保评价存在
 * - 删除操作接受404响应（幂等删除）
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { BASE_URL, DEFAULT_HEADERS, THRESHOLDS } from '../config.js';
import { createClientSession, getAuthHeaders } from './client-auth.js';

// 自定义指标
const socialErrors = new Counter('client_social_errors');
const getReviewsDuration = new Trend('client_get_reviews_duration', true);
const postCommentDuration = new Trend('client_post_comment_duration', true);
const favoriteDuration = new Trend('client_favorite_duration', true);

export const options = {
    scenarios: {
        client_social: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '10s', target: 3 },
                { duration: '1m', target: 8 },
                { duration: '30s', target: 12 },
                { duration: '10s', target: 0 },
            ],
            gracefulRampDown: '10s',
        },
    },
    thresholds: {
        'http_req_duration': ['p(95)<1000'],
        'http_req_duration{name:client_get_reviews}': ['p(95)<500'],
        'http_req_duration{name:client_get_comments}': ['p(95)<400'],
        'http_req_duration{name:client_post_comment}': ['p(95)<500'],
        'http_req_failed': ['rate<0.05'],
    },
};

// 评论内容模板
const COMMENT_CONTENTS = [
    '同意，这道菜确实不错！',
    '我也觉得很好吃',
    '下次试试看',
    '谢谢分享！',
    '看起来很诱人',
    '已加入收藏',
];

export default function () {
    // 1. 登录 - 使用 baseline 用户
    // 注意：client-posting.js 使用 secondary 用户，避免同一用户操作同一菜品
    const session = createClientSession('baseline');
    if (!session) {
        socialErrors.add(1);
        console.error('登录失败，跳过本次迭代');
        return;
    }

    const headers = session.headers;
    let dishes = [];
    let selectedDishId = null;
    let createdReviewId = null;
    let createdCommentId = null;

    // 2. 获取菜品列表（获取足够多的菜品供VU选择）
    group('获取菜品列表', () => {
        const payload = JSON.stringify({
            filter: {},
            search: { keyword: '' },
            sort: { field: 'createdAt', order: 'desc' },
            pagination: { page: 1, pageSize: 100 },
        });

        const res = http.post(`${BASE_URL}/dishes`, payload, {
            headers,
            tags: { name: 'client_get_dishes' },
        });

        const success = check(res, {
            '获取菜品 - 状态码 200': (r) => r.status === 200,
        });

        if (success) {
            try {
                const body = JSON.parse(res.body);
                if (body.code === 200 && body.data?.items?.length > 0) {
                    dishes = body.data.items;
                }
            } catch (e) {
                console.error('解析菜品列表失败');
            }
        }
    });

    if (dishes.length === 0) {
        console.warn('未获取到菜品，跳过本次测试');
        return;
    }

    // ===== 关键优化：VU隔离策略 =====
    // 每个VU使用唯一的菜品索引，避免多个VU对同一菜品的upsert冲突
    const vuId = __VU || 1;
    const iterNum = __ITER || 0;
    // 使用质数步长确保更好的分布
    const dishIndex = ((vuId - 1) * 7 + iterNum * 3) % dishes.length;
    selectedDishId = dishes[dishIndex].id;

    console.log(`VU${vuId} 迭代${iterNum}: 选择菜品 ${selectedDishId} (索引 ${dishIndex})`);

    sleep(0.3);

    // 3. 查看菜品评价列表
    group('查看评价列表', () => {
        const res = http.get(
            `${BASE_URL}/dishes/${selectedDishId}/reviews?page=1&pageSize=10`,
            {
                headers,
                tags: { name: 'client_get_reviews' },
            }
        );

        getReviewsDuration.add(res.timings.duration);

        check(res, {
            '获取评价 - 状态码 200': (r) => r.status === 200,
        });
    });

    sleep(0.3);

    // 4. 发布自己的评价（确保有评价可供评论）
    group('发布评价', () => {
        const reviewPayload = JSON.stringify({
            dishId: selectedDishId,
            rating: Math.floor(Math.random() * 3) + 3, // 3-5 分
            content: `VU${vuId}的测试评价 - 时间戳${Date.now()}`,
        });

        const res = http.post(`${BASE_URL}/reviews`, reviewPayload, {
            headers,
            tags: { name: 'client_create_review' },
        });

        const success = check(res, {
            '发布评价 - 状态码正确': (r) => r.status === 200 || r.status === 201,
        });

        if (success) {
            try {
                const body = JSON.parse(res.body);
                if (body.data?.id) {
                    createdReviewId = body.data.id;
                    console.log(`VU${vuId} 创建评价成功: ${createdReviewId}`);
                }
            } catch (e) {
                console.error('解析评价响应失败');
            }
        } else {
            socialErrors.add(1);
            console.error(`VU${vuId} 发布评价失败: ${res.status}`);
        }
    });

    if (!createdReviewId) {
        console.warn('未能创建评价，跳过评论测试');
        return;
    }

    sleep(0.2);

    // 5. 对自己的评价发布评论
    group('发布评论', () => {
        const content =
            COMMENT_CONTENTS[Math.floor(Math.random() * COMMENT_CONTENTS.length)];
        const commentPayload = JSON.stringify({
            reviewId: createdReviewId,
            content: `[K6测试] ${content} - VU${vuId}`,
        });

        const res = http.post(`${BASE_URL}/comments`, commentPayload, {
            headers,
            tags: { name: 'client_post_comment' },
        });

        postCommentDuration.add(res.timings.duration);

        const success = check(res, {
            '发布评论 - 状态码正确': (r) => r.status === 200 || r.status === 201,
        });

        if (success) {
            try {
                const body = JSON.parse(res.body);
                if (body.data?.id) {
                    createdCommentId = body.data.id;
                    console.log(`VU${vuId} 发布评论成功: ${createdCommentId}`);
                }
            } catch (e) {
                // 忽略解析错误
            }
        } else {
            socialErrors.add(1);
            console.error(
                `VU${vuId} 发布评论失败: reviewId=${createdReviewId}, status=${res.status}`
            );
        }
    });

    sleep(0.2);

    // 6. 查看评论列表
    group('查看评论', () => {
        const res = http.get(
            `${BASE_URL}/comments/${createdReviewId}?page=1&pageSize=10`,
            {
                headers,
                tags: { name: 'client_get_comments' },
            }
        );

        check(res, {
            '获取评论 - 状态码 200': (r) => r.status === 200,
        });
    });

    sleep(0.2);

    // 7. 收藏菜品
    group('收藏菜品', () => {
        const res = http.post(`${BASE_URL}/dishes/${selectedDishId}/favorite`, null, {
            headers,
            tags: { name: 'client_favorite' },
        });

        favoriteDuration.add(res.timings.duration);

        check(res, {
            '收藏菜品 - 状态码正确': (r) =>
                r.status === 200 || r.status === 201 || r.status === 400,  // 400=已收藏
        });
    });

    sleep(0.3);

    // 8. 清理测试数据
    group('清理测试数据', () => {
        // 8.1 删除评论
        if (createdCommentId) {
            const delCommentRes = http.del(
                `${BASE_URL}/comments/${createdCommentId}`,
                null,
                {
                    headers,
                    tags: { name: 'client_delete_comment' },
                }
            );

            check(delCommentRes, {
                '删除评论 - 成功': (r) =>
                    r.status === 200 || r.status === 204 || r.status === 404,
            });
        }

        sleep(0.1);

        // 8.2 取消收藏
        const unfavRes = http.del(
            `${BASE_URL}/dishes/${selectedDishId}/favorite`,
            null,
            {
                headers,
                tags: { name: 'client_unfavorite' },
            }
        );

        check(unfavRes, {
            '取消收藏 - 成功': (r) =>
                r.status === 200 || r.status === 204 || r.status === 400,  // 400=未收藏
        });

        sleep(0.1);

        // 8.3 删除评价
        // 由于每个VU使用独立的菜品索引，upsert不会覆盖其他VU的评价
        // 直接使用创建时获取的reviewId
        if (createdReviewId) {
            const delReviewRes = http.del(
                `${BASE_URL}/reviews/${createdReviewId}`,
                null,
                {
                    headers,
                    tags: { name: 'client_delete_review' },
                }
            );

            check(delReviewRes, {
                '删除评价 - 成功': (r) =>
                    r.status === 200 || r.status === 204 || r.status === 404,
            });

            if (delReviewRes.status === 200 || delReviewRes.status === 204) {
                console.log(`VU${vuId} 清理完成: 评价 ${createdReviewId}`);
            }
        }
    });

    sleep(0.5);
}
