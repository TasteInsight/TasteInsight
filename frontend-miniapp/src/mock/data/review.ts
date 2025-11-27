// Mock 评价和评论数据
import type { Review, Comment } from '@/types/api';

// 模拟用户数据
const mockUsers = [
  { id: 'user_001', nickname: '美食爱好者', avatar: 'https://via.placeholder.com/100' },
  { id: 'user_002', nickname: '吃货小王', avatar: 'https://via.placeholder.com/100' },
  { id: 'user_003', nickname: '校园美食家', avatar: 'https://via.placeholder.com/100' },
  { id: 'user_004', nickname: '干饭人', avatar: 'https://via.placeholder.com/100' },
  { id: 'user_005', nickname: '食堂常客', avatar: 'https://via.placeholder.com/100' },
  { id: 'user_006', nickname: '挑食达人', avatar: 'https://via.placeholder.com/100' },
  { id: 'user_007', nickname: '营养专家', avatar: 'https://via.placeholder.com/100' },
  { id: 'user_008', nickname: '美味猎手', avatar: 'https://via.placeholder.com/100' },
];

// 评价内容模板
const reviewContents = {
  positive: [
    '味道很好，量也足，性价比很高！',
    '这道菜真的太好吃了，强烈推荐！',
    '口感很棒，下次还会再来',
    '食材新鲜，做工精细，赞！',
    '今天的份量比之前多了，开心',
    '阿姨打菜很实在，好评！',
    '味道正宗，让我想起家里的味道',
    '物美价廉，学生党福音',
  ],
  neutral: [
    '味道还行，中规中矩',
    '还可以吧，没有惊喜也没有失望',
    '一般般，偶尔换换口味可以',
    '今天的口味偏咸了一点',
    '量有点少，味道还行',
  ],
  negative: [
    '今天有点咸，希望下次能改进',
    '排队太久了，菜都凉了',
    '份量变少了，有点失望',
    '油有点多，吃起来腻',
  ],
};

// 评论内容模板
const commentContents = [
  '同感！我也觉得很好吃',
  '下次一起去吃呀',
  '感谢分享，明天去试试',
  '这个窗口确实不错',
  '同学好品味！',
  '哈哈哈我也是这家常客',
  '请问这个辣吗？',
  '量确实足，吃不完',
  '性价比很高',
  '已加入必吃清单',
];

// 生成随机日期（最近30天内）
const randomDate = (daysAgo: number = 30): string => {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  date.setHours(Math.floor(Math.random() * 12) + 8); // 8:00 - 20:00
  date.setMinutes(Math.floor(Math.random() * 60));
  return date.toISOString();
};

// 根据评分选择评价内容
const getReviewContent = (rating: number): string => {
  if (rating >= 4) {
    return reviewContents.positive[Math.floor(Math.random() * reviewContents.positive.length)];
  } else if (rating >= 3) {
    return reviewContents.neutral[Math.floor(Math.random() * reviewContents.neutral.length)];
  } else {
    return reviewContents.negative[Math.floor(Math.random() * reviewContents.negative.length)];
  }
};

// 生成评价数据
export const createMockReviews = (): Review[] => {
  const reviews: Review[] = [];
  
  // 为每个菜品生成评价
  const dishReviewConfig: Record<string, { count: number; avgRating: number }> = {
    'dish_001': { count: 15, avgRating: 4.5 },  // 宫保鸡丁
    'dish_002': { count: 12, avgRating: 4.2 },  // 麻婆豆腐
    'dish_003': { count: 18, avgRating: 4.8 },  // 鱼香肉丝
    'dish_004': { count: 8, avgRating: 4.0 },   // 清炒时蔬
    'dish_005': { count: 20, avgRating: 4.8 },  // 红烧肉
    'dish_006': { count: 10, avgRating: 4.3 },  // 皮蛋瘦肉粥
  };

  let reviewId = 1;

  for (const [dishId, config] of Object.entries(dishReviewConfig)) {
    for (let i = 0; i < config.count; i++) {
      const user = mockUsers[Math.floor(Math.random() * mockUsers.length)];
      
      // 根据平均评分生成具体评分（正态分布模拟）
      let rating = Math.round(config.avgRating + (Math.random() - 0.5) * 2);
      rating = Math.max(1, Math.min(5, rating));
      
      const hasImages = Math.random() > 0.7; // 30% 概率有图片
      
      reviews.push({
        id: `review_${String(reviewId).padStart(3, '0')}`,
        dishId,
        userId: user.id,
        userNickname: user.nickname,
        userAvatar: user.avatar,
        rating,
        content: getReviewContent(rating),
        images: hasImages ? ['https://via.placeholder.com/200'] : [],
        status: 'approved',
        createdAt: randomDate(30),
      });
      
      reviewId++;
    }
  }
  
  // 按时间倒序排列
  reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  return reviews;
};

// 生成评论数据
export const createMockComments = (): Comment[] => {
  const comments: Comment[] = [];
  const reviews = createMockReviews();
  
  let commentId = 1;
  
  // 为部分评价生成评论（约40%的评价有评论）
  for (const review of reviews) {
    if (Math.random() > 0.6) {
      // 每条有评论的评价生成1-3条评论
      const commentCount = Math.floor(Math.random() * 3) + 1;
      
      for (let i = 0; i < commentCount; i++) {
        const user = mockUsers[Math.floor(Math.random() * mockUsers.length)];
        
        // 避免自己评论自己
        if (user.id === review.userId) continue;
        
        comments.push({
          id: `comment_${String(commentId).padStart(3, '0')}`,
          reviewId: review.id,
          userId: user.id,
          userNickname: user.nickname,
          userAvatar: user.avatar,
          content: commentContents[Math.floor(Math.random() * commentContents.length)],
          status: 'approved',
          createdAt: randomDate(15), // 评论在最近15天内
        });
        
        commentId++;
      }
    }
  }
  
  // 按时间倒序排列
  comments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  return comments;
};

// 根据菜品ID获取评价列表
export const getReviewsByDishId = (dishId: string): Review[] => {
  const allReviews = createMockReviews();
  return allReviews.filter(r => r.dishId === dishId);
};

// 根据评价ID获取评论列表
export const getCommentsByReviewId = (reviewId: string): Comment[] => {
  const allComments = createMockComments();
  return allComments.filter(c => c.reviewId === reviewId);
};

// 计算菜品的评分详情
export const getRatingDetailByDishId = (dishId: string): { average: number; total: number; detail: Record<string, number> } => {
  const reviews = getReviewsByDishId(dishId);
  
  const detail: Record<string, number> = {
    '1': 0,
    '2': 0,
    '3': 0,
    '4': 0,
    '5': 0,
  };
  
  let totalRating = 0;
  
  for (const review of reviews) {
    detail[String(review.rating)] = (detail[String(review.rating)] || 0) + 1;
    totalRating += review.rating;
  }
  
  const average = reviews.length > 0 ? totalRating / reviews.length : 0;
  
  return {
    average: Math.round(average * 10) / 10,
    total: reviews.length,
    detail,
  };
};
