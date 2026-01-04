/**
 * 场景：评价和评论审核 (Review & Comment Auditing)
 * 
 * 【测试目标】
 * 测试审核队列的高并发处理能力
 * 
 * 【业务流程】
 * 1. 管理员登录
 * 2. 获取待审核评价列表 -> 随机选择一条 -> 随机通过/拒绝
 * 3. 获取待审核评论列表 -> 随机选择一条 -> 随机通过/拒绝
 * 
 * 【代码核实】
 * 
 * === 评价审核 ===
 * Ref: src/admin-reviews/admin-reviews.controller.ts
 * - @Controller('admin/reviews')
 * - @UseGuards(AdminAuthGuard, PermissionsGuard)
 * 
 * GET /admin/reviews/pending
 *   - @RequirePermissions('review:approve')
 *   - Query: page, pageSize
 * 
 * POST /admin/reviews/:id/approve
 *   - @RequirePermissions('review:approve')
 *   - Body: 无
 * 
 * POST /admin/reviews/:id/reject
 *   - @RequirePermissions('review:approve')
 *   - Body: RejectReviewDto { reason: string } (必填)
 * 
 * DELETE /admin/reviews/:id
 *   - @RequirePermissions('review:delete')
 * 
 * === 评论审核 ===
 * Ref: src/admin-comments/admin-comments.controller.ts
 * - @Controller('admin/comments')
 * - @UseGuards(AdminAuthGuard, PermissionsGuard)
 * 
 * GET /admin/comments/pending
 *   - @RequirePermissions('comment:approve')
 *   - Query: page, pageSize
 * 
 * POST /admin/comments/:id/approve
 *   - @RequirePermissions('comment:approve')
 *   - Body: 无
 * 
 * POST /admin/comments/:id/reject
 *   - @RequirePermissions('comment:approve')
 *   - Body: RejectCommentDto { reason: string } (必填)
 * 
 * DELETE /admin/comments/:id
 *   - @RequirePermissions('comment:delete')
 * 
 * === DTO 定义 ===
 * Ref: src/admin-reviews/dto/reject-review.dto.ts
 * Ref: src/admin-comments/dto/reject-comment.dto.ts
 * 两者结构相同: { reason: string } (@IsNotEmpty, @IsString)
 */

import { check, group } from 'k6';
import { ADMIN_CREDENTIALS, API_PATHS } from '../config.js';
import {
    adminLogin,
    httpGet,
    httpPost,
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
        review_audit: {
            executor: 'ramping-vus',
            startVUs: 1,
            stages: [
                { duration: '20s', target: 5 },
                { duration: '40s', target: 10 },
                { duration: '20s', target: 5 },
                { duration: '20s', target: 0 },
            ],
            gracefulRampDown: '10s',
        },
    },
    thresholds: {
        http_req_failed: ['rate<0.05'],
        http_req_duration: ['p(95)<500'],
        'http_req_duration{name:get_pending_reviews}': ['p(95)<400'],
        'http_req_duration{name:approve_review}': ['p(95)<300'],
        'http_req_duration{name:reject_review}': ['p(95)<300'],
        'http_req_duration{name:get_pending_comments}': ['p(95)<400'],
        'http_req_duration{name:approve_comment}': ['p(95)<300'],
        'http_req_duration{name:reject_comment}': ['p(95)<300'],
    },
};

// 预定义的拒绝原因列表
const REVIEW_REJECT_REASONS = [
    '评价内容包含不当言论',
    '评价与菜品无关',
    '评价内容过于简短，无有效信息',
    '存在虚假评价嫌疑',
    '评价包含广告信息',
];

const COMMENT_REJECT_REASONS = [
    '评论内容不当',
    '评论包含人身攻击',
    '垃圾评论',
    '评论与主题无关',
    '评论包含敏感信息',
];

/**
 * 评价和评论审核主测试函数
 */
export default function reviewAuditTest() {
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
    
    // ==================== Step 2: 获取待审核评价列表 ====================
    let pendingReviews = [];
    group('Step 2: 获取待审核评价列表', function () {
        // Ref: GET /admin/reviews/pending - src/admin-reviews/admin-reviews.controller.ts:24
        const response = httpGet(
            API_PATHS.ADMIN_REVIEWS.PENDING,
            token,
            'get_pending_reviews',
            { page: 1, pageSize: 50 }
        );
        
        const success = check(response, {
            '获取待审核评价 - 状态码 200': (r) => r.status === 200,
        });
        
        if (success) {
            const body = parseResponseBody(response);
            pendingReviews = extractListItems(body);
            console.log(`获取到 ${pendingReviews.length} 个待审核评价`);
        } else {
            console.error(`获取待审核评价失败: status=${response.status}`);
            requestErrors.add(1);
        }
    });
    
    // ==================== Step 2.1: 处理待审核评价 ====================
    if (pendingReviews.length > 0) {
        group('Step 2.1: 处理待审核评价', function () {
            const selectedReview = randomChoice(pendingReviews);
            const shouldApprove = Math.random() > 0.4; // 60% 通过
            
            console.log(`处理评价: id=${selectedReview.id}, action=${shouldApprove ? 'approve' : 'reject'}`);
            
            if (shouldApprove) {
                // Ref: POST /admin/reviews/:id/approve - src/admin-reviews/admin-reviews.controller.ts:35
                const response = httpPost(
                    API_PATHS.ADMIN_REVIEWS.APPROVE(selectedReview.id),
                    {},
                    token,
                    'approve_review'
                );
                
                const success = check(response, {
                    '通过评价 - 状态码 200': (r) => r.status === 200,
                });
                
                if (success) {
                    console.log('评价通过成功');
                } else {
                    // 可能已被其他并发请求处理
                    console.warn(`通过评价失败: status=${response.status}`);
                }
            } else {
                // Ref: POST /admin/reviews/:id/reject - src/admin-reviews/admin-reviews.controller.ts:42
                // Body 参考: src/admin-reviews/dto/reject-review.dto.ts
                const reason = randomChoice(REVIEW_REJECT_REASONS);
                const response = httpPost(
                    API_PATHS.ADMIN_REVIEWS.REJECT(selectedReview.id),
                    { reason: reason },
                    token,
                    'reject_review'
                );
                
                const success = check(response, {
                    '拒绝评价 - 状态码 200': (r) => r.status === 200,
                });
                
                if (success) {
                    console.log('评价拒绝成功');
                } else {
                    console.warn(`拒绝评价失败: status=${response.status}`);
                }
            }
        });
    } else {
        console.log('没有待审核的评价');
    }
    
    // 短暂等待
    sleep(0.5);
    
    // ==================== Step 3: 获取待审核评论列表 ====================
    let pendingComments = [];
    group('Step 3: 获取待审核评论列表', function () {
        // Ref: GET /admin/comments/pending - src/admin-comments/admin-comments.controller.ts:23
        const response = httpGet(
            API_PATHS.ADMIN_COMMENTS.PENDING,
            token,
            'get_pending_comments',
            { page: 1, pageSize: 50 }
        );
        
        const success = check(response, {
            '获取待审核评论 - 状态码 200': (r) => r.status === 200,
        });
        
        if (success) {
            const body = parseResponseBody(response);
            pendingComments = extractListItems(body);
            console.log(`获取到 ${pendingComments.length} 个待审核评论`);
        } else {
            console.error(`获取待审核评论失败: status=${response.status}`);
            requestErrors.add(1);
        }
    });
    
    // ==================== Step 3.1: 处理待审核评论 ====================
    if (pendingComments.length > 0) {
        group('Step 3.1: 处理待审核评论', function () {
            const selectedComment = randomChoice(pendingComments);
            const shouldApprove = Math.random() > 0.4; // 60% 通过
            
            console.log(`处理评论: id=${selectedComment.id}, action=${shouldApprove ? 'approve' : 'reject'}`);
            
            if (shouldApprove) {
                // Ref: POST /admin/comments/:id/approve - src/admin-comments/admin-comments.controller.ts:33
                const response = httpPost(
                    API_PATHS.ADMIN_COMMENTS.APPROVE(selectedComment.id),
                    {},
                    token,
                    'approve_comment'
                );
                
                const success = check(response, {
                    '通过评论 - 状态码 200': (r) => r.status === 200,
                });
                
                if (success) {
                    console.log('评论通过成功');
                } else {
                    console.warn(`通过评论失败: status=${response.status}`);
                }
            } else {
                // Ref: POST /admin/comments/:id/reject - src/admin-comments/admin-comments.controller.ts:40
                // Body 参考: src/admin-comments/dto/reject-comment.dto.ts
                const reason = randomChoice(COMMENT_REJECT_REASONS);
                const response = httpPost(
                    API_PATHS.ADMIN_COMMENTS.REJECT(selectedComment.id),
                    { reason: reason },
                    token,
                    'reject_comment'
                );
                
                const success = check(response, {
                    '拒绝评论 - 状态码 200': (r) => r.status === 200,
                });
                
                if (success) {
                    console.log('评论拒绝成功');
                } else {
                    console.warn(`拒绝评论失败: status=${response.status}`);
                }
            }
        });
    } else {
        console.log('没有待审核的评论');
    }
    
    // 模拟用户思考时间
    sleep(Math.random() * 2 + 1); // 1-3 秒
}
