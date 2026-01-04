/**
 * 场景 4：饮食规划 (Meal Planning)
 * 
 * 模拟用户进行饮食规划的流程：
 * 登录 -> 浏览菜品 -> 创建饮食计划 -> 查看饮食计划列表 -> 更新计划 -> 删除计划
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { BASE_URL, DEFAULT_HEADERS, THRESHOLDS } from '../config.js';
import { createClientSession, getAuthHeaders } from './client-auth.js';

// 自定义指标
const planningErrors = new Counter('client_planning_errors');
const createPlanDuration = new Trend('client_create_plan_duration', true);
const getPlansDuration = new Trend('client_get_plans_duration', true);
const updatePlanDuration = new Trend('client_update_plan_duration', true);

export const options = {
    scenarios: {
        client_planning: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '10s', target: 2 },   // 预热
                { duration: '1m', target: 5 },    // 正常负载
                { duration: '30s', target: 8 },   // 峰值
                { duration: '10s', target: 0 },   // 冷却
            ],
            gracefulRampDown: '10s',
        },
    },
    thresholds: {
        'http_req_duration': ['p(95)<1500'],
        'http_req_duration{name:client_create_meal_plan}': ['p(95)<800'],
        'http_req_duration{name:client_get_meal_plans}': ['p(95)<500'],
        'http_req_duration{name:client_update_meal_plan}': ['p(95)<600'],
        'http_req_duration{name:client_delete_meal_plan}': ['p(95)<300'],
        'http_req_failed': ['rate<0.05'],
    },
};

// 餐次类型（对应后端 MealTime 枚举）
const MEAL_TIMES = ['breakfast', 'lunch', 'dinner', 'nightsnack'];

// 生成日期字符串
function getDateString(daysOffset = 0) {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

export default function() {
    // 1. 登录
    const session = createClientSession('baseline');
    if (!session) {
        planningErrors.add(1);
        console.error('登录失败，跳过本次迭代');
        return;
    }
    
    const headers = session.headers;
    let dishIds = [];
    let createdPlanId = null;

    // 2. 获取菜品列表用于创建饮食计划
    group('获取菜品列表', () => {
        const searchPayload = JSON.stringify({
            filter: {},
            search: { keyword: '' },
            sort: {
                field: 'averageRating',
                order: 'desc'
            },
            pagination: {
                page: 1,
                pageSize: 10
            }
        });

        const res = http.post(`${BASE_URL}/dishes`, searchPayload, {
            headers,
            tags: { name: 'client_get_dishes_for_plan' }
        });

        check(res, {
            '获取菜品 - 状态码 200': (r) => r.status === 200,
        });

        try {
            const body = JSON.parse(res.body);
            if (body.code === 200 && body.data?.items) {
                dishIds = body.data.items.map(d => d.id);
            }
        } catch (e) {
            console.error('解析菜品响应失败');
        }
    });

    if (dishIds.length === 0) {
        console.warn('未找到菜品，跳过饮食规划测试');
        return;
    }

    sleep(0.3);

    // 3. 查看用户收藏夹（获取可能的菜品选择）
    group('查看收藏夹', () => {
        const res = http.get(`${BASE_URL}/user/favorites?page=1&pageSize=10`, {
            headers,
            tags: { name: 'client_get_favorites' }
        });

        check(res, {
            '收藏夹 - 状态码 200': (r) => r.status === 200,
        });
    });

    sleep(0.3);

    // 4. 创建饮食计划
    group('创建饮食计划', () => {
        const startDate = getDateString(1);  // 明天
        const endDate = getDateString(7);    // 一周后
        const mealTime = MEAL_TIMES[Math.floor(Math.random() * MEAL_TIMES.length)];
        
        // 随机选择1-3个菜品 (DTO期望 dishes 为 string[] 即 dishId 数组)
        const numDishes = Math.floor(Math.random() * 3) + 1;
        const selectedDishIds = [];
        for (let i = 0; i < numDishes && i < dishIds.length; i++) {
            const randomDishId = dishIds[Math.floor(Math.random() * dishIds.length)];
            if (!selectedDishIds.includes(randomDishId)) {
                selectedDishIds.push(randomDishId);
            }
        }

        const planPayload = JSON.stringify({
            startDate: startDate,
            endDate: endDate,
            mealTime: mealTime,
            dishes: selectedDishIds  // string[] 格式
        });

        const res = http.post(`${BASE_URL}/meal-plans`, planPayload, {
            headers,
            tags: { name: 'client_create_meal_plan' }
        });

        createPlanDuration.add(res.timings.duration);

        const success = check(res, {
            '创建计划 - 状态码 201': (r) => r.status === 201,
            '创建计划 - 返回计划ID': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    // 响应体 code 可能是 200 或 201（创建成功）
                    if (body.code >= 200 && body.code < 300 && body.data?.id) {
                        createdPlanId = body.data.id;
                        return true;
                    }
                    return false;
                } catch {
                    return false;
                }
            }
        });

        if (!success) {
            planningErrors.add(1);
            console.error(`创建饮食计划失败: ${res.status} - ${res.body}`);
        } else {
            console.log(`成功创建饮食计划: ${createdPlanId}`);
        }
    });

    sleep(0.3);

    // 5. 获取饮食计划列表（API 不支持分页参数）
    group('获取饮食计划列表', () => {
        const res = http.get(`${BASE_URL}/meal-plans`, {
            headers,
            tags: { name: 'client_get_meal_plans' }
        });

        getPlansDuration.add(res.timings.duration);

        check(res, {
            '计划列表 - 状态码 200': (r) => r.status === 200,
            '计划列表 - 返回数据': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    return body.code === 200;
                } catch {
                    return false;
                }
            }
        });
    });

    sleep(0.3);

    // 6. 更新饮食计划
    if (createdPlanId) {
        group('更新饮食计划', () => {
            const newMealTime = MEAL_TIMES[Math.floor(Math.random() * MEAL_TIMES.length)];
            
            // UpdateMealPlanDto.dishes 也是 string[] 格式
            const updatePayload = JSON.stringify({
                mealTime: newMealTime,
                dishes: [dishIds[0]]  // string[] 格式
            });

            const res = http.patch(`${BASE_URL}/meal-plans/${createdPlanId}`, updatePayload, {
                headers,
                tags: { name: 'client_update_meal_plan' }
            });

            updatePlanDuration.add(res.timings.duration);

            check(res, {
                '更新计划 - 成功': (r) => r.status === 200
            });
        });

        sleep(0.3);

        // 7. 删除饮食计划（清理）
        group('删除饮食计划', () => {
            const res = http.del(`${BASE_URL}/meal-plans/${createdPlanId}`, null, {
                headers,
                tags: { name: 'client_delete_meal_plan' }
            });

            check(res, {
                '删除计划 - 成功': (r) => r.status === 200
            });

            if (res.status === 200) {
                console.log(`已删除饮食计划: ${createdPlanId}`);
            }
        });
    }

    // 9. 查看浏览历史
    group('查看浏览历史', () => {
        const res = http.get(`${BASE_URL}/user/history?page=1&pageSize=10`, {
            headers,
            tags: { name: 'client_get_history' }
        });

        check(res, {
            '浏览历史 - 状态码 200': (r) => r.status === 200,
        });
    });

    sleep(1);
}
