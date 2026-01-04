/**
 * 场景 1：干饭人的一天 (Browsing & Searching)
 * 
 * 模拟学生用户的浏览和搜索行为：
 * 登录 -> 浏览推荐菜品 -> 搜索菜品 -> 查看菜品详情 -> 收藏菜品
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { BASE_URL, DEFAULT_HEADERS, THRESHOLDS } from '../config.js';
import { createClientSession, getAuthHeaders } from './client-auth.js';

// 自定义指标
const browsingErrors = new Counter('client_browsing_errors');
const recommendDuration = new Trend('client_recommend_duration', true);
const searchDuration = new Trend('client_search_duration', true);
const dishDetailDuration = new Trend('client_dish_detail_duration', true);

export const options = {
    scenarios: {
        client_browsing: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '15s', target: 5 },   // 预热
                { duration: '1m', target: 10 },   // 正常负载
                { duration: '30s', target: 15 },  // 峰值
                { duration: '15s', target: 0 },   // 冷却
            ],
            gracefulRampDown: '10s',
        },
    },
    thresholds: {
        'http_req_duration': ['p(95)<1000'],
        'http_req_duration{name:client_get_dishes}': ['p(95)<500'],
        'http_req_duration{name:client_get_dish_detail}': ['p(95)<300'],
        'http_req_duration{name:client_recommend}': ['p(95)<800'],
        'http_req_duration{name:client_favorite}': ['p(95)<300'],
        'http_req_failed': ['rate<0.05'],
    },
};

// 搜索关键词列表
const SEARCH_KEYWORDS = ['鸡', '面', '饭', '汤', '堡', '粉', '饺', '包'];

export default function() {
    // 1. 登录
    const session = createClientSession('baseline');
    if (!session) {
        browsingErrors.add(1);
        console.error('登录失败，跳过本次迭代');
        return;
    }
    
    const headers = session.headers;
    let dishIds = [];
    let selectedDishId = null;

    // 2. 获取推荐菜品
    group('获取推荐菜品', () => {
        const recommendPayload = JSON.stringify({
            scene: 'home',
            filter: {},
            pagination: {
                page: 1,
                pageSize: 20
            }
        });

        const res = http.post(`${BASE_URL}/recommend`, recommendPayload, {
            headers,
            tags: { name: 'client_recommend' }
        });

        recommendDuration.add(res.timings.duration);

        const success = check(res, {
            '推荐接口 - 状态码 200': (r) => r.status === 200,
            '推荐接口 - 有数据返回': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    return body.code === 200 && body.data !== undefined;
                } catch {
                    return false;
                }
            }
        });

        if (!success) {
            browsingErrors.add(1);
            console.error(`推荐接口失败: ${res.status}`);
        }
    });

    sleep(0.5);

    // 3. 搜索菜品（模拟用户搜索）
    group('搜索菜品', () => {
        const keyword = SEARCH_KEYWORDS[Math.floor(Math.random() * SEARCH_KEYWORDS.length)];
        
        const searchPayload = JSON.stringify({
            filter: {},
            search: {
                keyword: keyword
            },
            sort: {
                field: 'averageRating',
                order: 'desc'
            },
            pagination: {
                page: 1,
                pageSize: 20
            }
        });

        const res = http.post(`${BASE_URL}/dishes`, searchPayload, {
            headers,
            tags: { name: 'client_get_dishes' }
        });

        searchDuration.add(res.timings.duration);

        const success = check(res, {
            '搜索菜品 - 状态码 200': (r) => r.status === 200,
            '搜索菜品 - 返回列表': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    if (body.code === 200 && body.data?.items) {
                        dishIds = body.data.items.map(d => d.id);
                        return true;
                    }
                    return false;
                } catch {
                    return false;
                }
            }
        });

        if (!success) {
            browsingErrors.add(1);
        } else {
            console.log(`搜索 "${keyword}" 返回 ${dishIds.length} 个菜品`);
        }
    });

    sleep(0.3);

    // 4. 查看菜品详情
    if (dishIds.length > 0) {
        group('查看菜品详情', () => {
            // 随机选择一个菜品
            selectedDishId = dishIds[Math.floor(Math.random() * dishIds.length)];

            const res = http.get(`${BASE_URL}/dishes/${selectedDishId}`, {
                headers,
                tags: { name: 'client_get_dish_detail' }
            });

            dishDetailDuration.add(res.timings.duration);

            const success = check(res, {
                '菜品详情 - 状态码 200': (r) => r.status === 200,
                '菜品详情 - 返回数据': (r) => {
                    try {
                        const body = JSON.parse(r.body);
                        return body.code === 200 && body.data?.id !== undefined;
                    } catch {
                        return false;
                    }
                }
            });

            if (!success) {
                browsingErrors.add(1);
            } else {
                console.log(`查看菜品详情: ${selectedDishId}`);
            }
        });

        sleep(0.3);

        // 5. 收藏菜品
        group('收藏菜品', () => {
            const res = http.post(`${BASE_URL}/dishes/${selectedDishId}/favorite`, null, {
                headers,
                tags: { name: 'client_favorite' }
            });

            check(res, {
                '收藏菜品 - 状态码 200': (r) => r.status === 200 || r.status === 400  // 400=已收藏
            });

            // 取消收藏（清理）
            http.del(`${BASE_URL}/dishes/${selectedDishId}/favorite`, null, {
                headers,
                tags: { name: 'client_unfavorite' }
            });
        });
    }

    sleep(1);
}
