/**
 * 场景：评价和评论管理 (Management & Moderation)
 * 
 * 【测试目标】
 * 测试已发布内容的管理操作，包括搜索、查看详情和删除
 * 
 * 【业务流程】
 * 1. 管理员登录
 * 2. 获取菜品列表（作为入口获取评价）
 * 3. 随机选择一个菜品，获取其评价列表
 * 4. 如果有评价，获取评价详情及其评论
 * 5. 模拟管理阶段删除违规评价/评论（非审核阶段）
 * 
 * 【代码核实】
 * 
 * === 获取菜品评价 ===
 * Ref: src/admin-dishes/admin-dishes.controller.ts:84-96
 * GET /admin/dishes/:id/reviews
 *   - @RequirePermissions('dish:view')
 *   - Query: page, pageSize
 *   - 返回该菜品下的所有评价（不限状态，包括已通过、已拒绝等）
 * 
 * === 获取评价的评论 ===
 * Ref: src/admin-reviews/admin-reviews.controller.ts:51-62
 * GET /admin/reviews/:reviewId/comments
 *   - @RequirePermissions('review:approve')
 *   - Query: page, pageSize
 * 
 * === 删除评价 ===
 * Ref: src/admin-reviews/admin-reviews.controller.ts:66-71
 * DELETE /admin/reviews/:id
 *   - @RequirePermissions('review:delete')
 *   - 软删除（设置 deletedAt）
 * 
 * === 删除评论 ===
 * Ref: src/admin-comments/admin-comments.controller.ts:47-52
 * DELETE /admin/comments/:id
 *   - @RequirePermissions('comment:delete')
 * 
 * 【⚠️ 重要说明】
 * 1. 管理端没有独立的"搜索所有评价"接口，需要通过菜品ID间接获取
 * 2. 此场景主要测试已通过审核的内容的事后管理（如发现违规后删除）
 * 3. 与 moderation.js (举报处理) 和 review-audit.js (审核) 不同
 * 
 * 【设计决策】
 * 为避免删除真实数据导致测试污染，此场景采用以下策略：
 * - 读取操作：正常执行
 * - 删除操作：只在找到 status='rejected' 的评价时执行（已被拒绝的不影响用户体验）
 *   或者使用特定标记的测试数据
 */

import { check, group } from 'k6';
import { ADMIN_CREDENTIALS, API_PATHS } from '../config.js';
import {
    adminLogin,
    httpGet,
    httpDelete,
    checkResponse,
    parseResponseBody,
    extractListItems,
    randomChoice,
    sleep,
    requestErrors,
} from '../utils.js';

// 场景配置
export const options = {
    scenarios: {
        content_moderation: {
            executor: 'ramping-vus',
            startVUs: 1,
            stages: [
                { duration: '20s', target: 3 },
                { duration: '40s', target: 5 },
                { duration: '20s', target: 3 },
                { duration: '20s', target: 0 },
            ],
            gracefulRampDown: '10s',
        },
    },
    thresholds: {
        http_req_failed: ['rate<0.05'],
        http_req_duration: ['p(95)<500'],
        'http_req_duration{name:get_dishes_for_reviews}': ['p(95)<400'],
        'http_req_duration{name:get_dish_reviews}': ['p(95)<400'],
        'http_req_duration{name:get_review_comments}': ['p(95)<400'],
        'http_req_duration{name:delete_review}': ['p(95)<300'],
        'http_req_duration{name:delete_comment}': ['p(95)<300'],
    },
};

// 是否启用删除操作（生产环境建议关闭）
const ENABLE_DELETE = __ENV.ENABLE_DELETE === 'true' || false;

/**
 * 评价和评论管理主测试函数
 */
export default function contentModerationTest() {
    // ==================== Step 1: 管理员登录 ====================
    let token;
    group('Step 1: 管理员登录', function () {
        token = adminLogin(ADMIN_CREDENTIALS.username, ADMIN_CREDENTIALS.password);
        
        if (!token) {
            console.error('登录失败，跳过后续测试');
            return;
        }
    });
    
    if (!token) {
        sleep(1);
        return;
    }
    
    // ==================== Step 2: 获取菜品列表 ====================
    let dishes = [];
    group('Step 2: 获取菜品列表', function () {
        // Ref: GET /admin/dishes - src/admin-dishes/admin-dishes.controller.ts:36
        const response = httpGet(
            API_PATHS.ADMIN_DISHES.LIST,
            token,
            'get_dishes_for_reviews',
            { page: 1, pageSize: 20 }
        );
        
        const success = check(response, {
            '获取菜品列表 - 状态码 200': (r) => r.status === 200,
            '获取菜品列表 - 有数据': (r) => {
                const body = parseResponseBody(r);
                const items = extractListItems(body);
                return items.length > 0;
            },
        });
        
        if (success) {
            const body = parseResponseBody(response);
            dishes = extractListItems(body);
            console.log(`获取到 ${dishes.length} 个菜品`);
        } else {
            console.error(`获取菜品列表失败: status=${response.status}`);
            requestErrors.add(1);
        }
    });
    
    if (dishes.length === 0) {
        console.warn('没有可用的菜品数据，跳过后续测试');
        sleep(1);
        return;
    }
    
    // ==================== Step 3: 获取菜品评价列表 ====================
    // 随机选择一个有评价数的菜品（reviewCount > 0）
    const dishesWithReviews = dishes.filter(d => d.reviewCount > 0);
    let selectedDish = dishesWithReviews.length > 0 
        ? randomChoice(dishesWithReviews) 
        : randomChoice(dishes);
    
    let reviews = [];
    group('Step 3: 获取菜品评价列表', function () {
        console.log(`查询菜品评价: dishId=${selectedDish.id}, name=${selectedDish.name}, reviewCount=${selectedDish.reviewCount || 0}`);
        
        // Ref: GET /admin/dishes/:id/reviews - src/admin-dishes/admin-dishes.controller.ts:84
        const response = httpGet(
            `${API_PATHS.ADMIN_DISHES.BASE}/${selectedDish.id}/reviews`,
            token,
            'get_dish_reviews',
            { page: 1, pageSize: 20 }
        );
        
        const success = check(response, {
            '获取评价列表 - 状态码 200': (r) => r.status === 200,
        });
        
        if (success) {
            const body = parseResponseBody(response);
            reviews = extractListItems(body);
            console.log(`获取到 ${reviews.length} 条评价`);
        } else {
            console.error(`获取评价列表失败: status=${response.status}`);
            requestErrors.add(1);
        }
    });
    
    if (reviews.length === 0) {
        console.log('该菜品没有评价，尝试其他操作');
        sleep(1);
        return;
    }
    
    // ==================== Step 4: 获取评价的评论 ====================
    const selectedReview = randomChoice(reviews);
    let comments = [];
    
    group('Step 4: 获取评价的评论', function () {
        console.log(`查询评价评论: reviewId=${selectedReview.id}, status=${selectedReview.status}`);
        
        // Ref: GET /admin/reviews/:reviewId/comments - src/admin-reviews/admin-reviews.controller.ts:51
        const response = httpGet(
            `${API_PATHS.ADMIN_REVIEWS.BASE}/${selectedReview.id}/comments`,
            token,
            'get_review_comments',
            { page: 1, pageSize: 20 }
        );
        
        const success = check(response, {
            '获取评论列表 - 状态码 200': (r) => r.status === 200,
        });
        
        if (success) {
            const body = parseResponseBody(response);
            comments = extractListItems(body);
            console.log(`获取到 ${comments.length} 条评论`);
        } else {
            console.error(`获取评论列表失败: status=${response.status}`);
            requestErrors.add(1);
        }
    });
    
    // ==================== Step 5: 删除操作（可选） ====================
    // 只有明确启用删除且评价状态为 rejected 时才执行删除
    // 这样可以避免删除正常的用户数据
    
    if (ENABLE_DELETE) {
        // 寻找可以安全删除的评价（已被拒绝的）
        const rejectedReviews = reviews.filter(r => r.status === 'rejected');
        
        if (rejectedReviews.length > 0) {
            group('Step 5: 删除已拒绝的评价', function () {
                const reviewToDelete = randomChoice(rejectedReviews);
                console.log(`删除评价: id=${reviewToDelete.id}, status=${reviewToDelete.status}`);
                
                // Ref: DELETE /admin/reviews/:id - src/admin-reviews/admin-reviews.controller.ts:66
                const response = httpDelete(
                    API_PATHS.ADMIN_REVIEWS.DELETE(reviewToDelete.id),
                    token,
                    'delete_review'
                );
                
                const success = check(response, {
                    '删除评价 - 状态码 200': (r) => r.status === 200,
                });
                
                if (success) {
                    console.log('评价删除成功');
                } else {
                    console.warn(`删除评价失败: status=${response.status}`);
                }
            });
        } else {
            console.log('没有已拒绝的评价可删除，跳过删除操作');
        }
        
        // 尝试删除已拒绝的评论
        const rejectedComments = comments.filter(c => c.status === 'rejected');
        
        if (rejectedComments.length > 0) {
            group('Step 5.1: 删除已拒绝的评论', function () {
                const commentToDelete = randomChoice(rejectedComments);
                console.log(`删除评论: id=${commentToDelete.id}, status=${commentToDelete.status}`);
                
                // Ref: DELETE /admin/comments/:id - src/admin-comments/admin-comments.controller.ts:47
                const response = httpDelete(
                    API_PATHS.ADMIN_COMMENTS.DELETE(commentToDelete.id),
                    token,
                    'delete_comment'
                );
                
                const success = check(response, {
                    '删除评论 - 状态码 200': (r) => r.status === 200,
                });
                
                if (success) {
                    console.log('评论删除成功');
                } else {
                    console.warn(`删除评论失败: status=${response.status}`);
                }
            });
        }
    } else {
        console.log('删除操作已禁用（设置 ENABLE_DELETE=true 启用）');
    }
    
    // 模拟用户思考时间
    sleep(Math.random() * 2 + 1); // 1-3 秒
}
