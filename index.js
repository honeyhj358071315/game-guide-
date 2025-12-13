/**
 * 贴吧式论坛系统 - 完整版
 */
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Admin-Key'
};
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}
function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
        }
    });
}
export default {
    async fetch(request, env, ctx) {
        const db = env.DB;
        const url = new URL(request.url);
        const path = url.pathname;
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }
        try {
            // 帖子列表
            if (path === '/posts' && request.method === 'GET') {
                const posts = await db.prepare(
                    'SELECT * FROM posts ORDER BY created DESC LIMIT 20'
                ).all();
                return jsonResponse({ 
                    errno: 0, 
                    data: posts.results || [] 
                });
            }
            // 创建帖子
            if (path === '/posts' && request.method === 'POST') {
                const body = await request.json();
                const { title, content, author } = body;
                if (!title || !content || !author) {
                    return jsonResponse({ errno: 1, errmsg: 'Missing required fields' }, 400);
                }
                const postId = generateId();
                const now = Date.now();
                const result = await db.prepare(
                    'INSERT INTO posts (id, title, content, author, created, updated, view_count, comment_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
                ).bind(postId, title, content, author, now, now, 0, 0).run();
                if (result.success) {
                    return jsonResponse({ 
                        errno: 0, 
                        data: { 
                            id: postId,
                            title: title,
                            content: content,
                            author: author,
                            created: now,
                            updated: now,
                            view_count: 0,
                            comment_count: 0
                        } 
                    });
                } else {
                    return jsonResponse({ errno: 1, errmsg: 'Database insert failed' }, 500);
                }
            }
            // 获取单个帖子
            if (path.startsWith('/posts/') && request.method === 'GET') {
                const postId = path.split('/')[2];
                // 更新浏览量
                await db.prepare(
                    'UPDATE posts SET view_count = view_count + 1 WHERE id = ?'
                ).bind(postId).run();
                const post = await db.prepare(
                    'SELECT * FROM posts WHERE id = ?'
                ).bind(postId).first();
                // 获取帖子的评论
                const postComments = await db.prepare(
                    'SELECT * FROM comments WHERE url = ? AND status = \"approved\" ORDER BY created ASC'
                ).bind('/post/' + postId).all();
                if (post) {
                    return jsonResponse({ 
                        errno: 0, 
                        data: {
                            post: post,
                            comments: postComments.results || []
                        } 
                    });
                } else {
                    return jsonResponse({ errno: 1, errmsg: 'Post not found' }, 404);
                }
            }
            // 为帖子添加评论
            if (path.startsWith('/posts/') && path.endsWith('/comments') && request.method === 'POST') {
                const postId = path.split('/')[2];
                const body = await request.json();
                const { comment, nick, mail, link, pid = '', rid = '' } = body;
                if (!comment || !nick) {
                    return jsonResponse({ errno: 1, errmsg: 'Missing required fields' }, 400);
                }
                // 检查帖子是否存在
                const post = await db.prepare('SELECT * FROM posts WHERE id = ?').bind(postId).first();
                if (!post) {
                    return jsonResponse({ errno: 1, errmsg: 'Post not found' }, 404);
                }
                const commentId = generateId();
                const now = Date.now();
                const userAgent = request.headers.get('user-agent') || '';
                const ip = request.headers.get('cf-connecting-ip') || '127.0.0.1';
                const commentUrl = '/post/' + postId;
                // 插入评论
                const result = await db.prepare(
                    'INSERT INTO comments (_id, comment, created, updated, nick, mail, link, url, pid, rid, status, userAgent, ip, objectId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                ).bind(commentId, comment, now, now, nick, mail || '', link || '', commentUrl, pid, rid, 'approved', userAgent, ip, commentId).run();
                if (result.success) {
                    // 更新帖子评论数
                    await db.prepare(
                        'UPDATE posts SET comment_count = comment_count + 1, updated = ? WHERE id = ?'
                    ).bind(now, postId).run();
                    return jsonResponse({ 
                        errno: 0, 
                        data: { 
                            _id: commentId,
                            objectId: commentId,
                            comment: comment,
                            created: now,
                            nick: nick,
                            mail: mail,
                            link: link,
                            url: commentUrl
                        } 
                    });
                } else {
                    return jsonResponse({ errno: 1, errmsg: 'Database insert failed' }, 500);
                }
            }
            // 删除帖子
            if (path.startsWith('/posts/') && request.method === 'DELETE') {
                const postId = path.split('/')[2];
                const adminKey = request.headers.get('X-Admin-Key');
                const ADMIN_KEY = 'a358071315';
                if (!adminKey || adminKey !== ADMIN_KEY) {
                    return jsonResponse({ errno: 1, errmsg: 'Permission denied' }, 403);
                }
                const result = await db.prepare(
                    'DELETE FROM posts WHERE id = ?'
                ).bind(postId).run();
                if (result.success) {
                    return jsonResponse({ errno: 0, data: { msg: 'Post deleted successfully' } });
                } else {
                    return jsonResponse({ errno: 1, errmsg: 'Delete failed' }, 500);
                }
            }
                        // 帖子点赞
            if (path.startsWith('/posts/') && path.endsWith('/like') && request.method === 'POST') {
                const postId = path.split('/')[2];
                const userIp = request.headers.get('cf-connecting-ip') || '127.0.0.1';
                // 检查是否已经点赞
                const existingLike = await db.prepare(
                    'SELECT * FROM post_likes WHERE post_id = ? AND user_ip = ?'
                ).bind(postId, userIp).first();
                if (existingLike) {
                    // 取消点赞
                    await db.prepare(
                        'DELETE FROM post_likes WHERE post_id = ? AND user_ip = ?'
                    ).bind(postId, userIp).run();
                    // 更新帖子点赞数
                    // 使用SQLite支持的方式确保点赞数不会小于0
                    await db.prepare(
                        'UPDATE posts SET like_count = CASE WHEN like_count > 0 THEN like_count - 1 ELSE 0 END WHERE id = ?'
                    ).bind(postId).run();
                    return jsonResponse({ errno: 0, data: { liked: false } });
                } else {
                    // 添加点赞
                    const likeId = generateId();
                    const now = Date.now();
                    await db.prepare(
                        'INSERT INTO post_likes (id, post_id, user_ip, created) VALUES (?, ?, ?, ?)'
                    ).bind(likeId, postId, userIp, now).run();
                    // 更新帖子点赞数
                    await db.prepare(
                        'UPDATE posts SET like_count = COALESCE(like_count, 0) + 1 WHERE id = ?'
                    ).bind(postId).run();
                    return jsonResponse({ errno: 0, data: { liked: true } });
                }
            }
            // 获取帖子点赞状态
            if (path.startsWith('/posts/') && path.endsWith('/like') && request.method === 'GET') {
                const postId = path.split('/')[2];
                const userIp = request.headers.get('cf-connecting-ip') || '127.0.0.1';
                const likeCount = await db.prepare(
                    'SELECT COUNT(*) as count FROM post_likes WHERE post_id = ?'
                ).bind(postId).first();
                const userLiked = await db.prepare(
                    'SELECT * FROM post_likes WHERE post_id = ? AND user_ip = ?'
                ).bind(postId, userIp).first();
                return jsonResponse({ 
                    errno: 0, 
                    data: { 
                        like_count: likeCount?.count || 0,
                        user_liked: !!userLiked
                    } 
                });
            }
    // 健康检查
            if (path === '/') {
                return jsonResponse({ errno: 0, data: { msg: 'Forum Service Ready' } });
        }
        // 投票相关API
        // 初始化投票表
        if (path === '/init-votes' && request.method === 'POST') {
            await db.prepare(
                `CREATE TABLE IF NOT EXISTS votes (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT,
                    options TEXT NOT NULL,
                    is_multiple INTEGER DEFAULT 0,
                    daily_limit INTEGER DEFAULT 0,
                    ip_limit INTEGER DEFAULT 0,
                    created INTEGER NOT NULL,
                    updated INTEGER NOT NULL
                )`
            ).run();
            await db.prepare(
                `CREATE TABLE IF NOT EXISTS vote_records (
                    id TEXT PRIMARY KEY,
                    vote_id TEXT NOT NULL,
                    option_id INTEGER NOT NULL,
                    ip TEXT NOT NULL,
                    user_agent TEXT,
                    created INTEGER NOT NULL,
                    FOREIGN KEY (vote_id) REFERENCES votes(id)
                )`
            ).run();
            return jsonResponse({ errno: 0, data: { msg: 'Tables initialized' } });
        }
        // 创建新投票
        if (path === '/votes' && request.method === 'POST') {
            const body = await request.json();
            const { title, description, options, is_multiple = 0, daily_limit = 0, ip_limit = 0 } = body;
            if (!title || !options || !Array.isArray(options) || options.length < 2) {
                return jsonResponse({ errno: 1, errmsg: 'Invalid parameters' }, 400);
            }
            const voteId = generateId();
            const now = Date.now();
            const result = await db.prepare(
                'INSERT INTO votes (id, title, description, options, is_multiple, daily_limit, ip_limit, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            ).bind(voteId, title, description, JSON.stringify(options), is_multiple, daily_limit, ip_limit, now, now).run();
            if (result.success) {
                return jsonResponse({ errno: 0, data: { vote_id: voteId } });
            } else {
                return jsonResponse({ errno: 1, errmsg: 'Failed to create vote' }, 500);
            }
        }
        // 获取投票信息
        if (path.startsWith('/votes/') && request.method === 'GET') {
            const voteId = path.split('/')[2];
            const vote = await db.prepare('SELECT * FROM votes WHERE id = ?').bind(voteId).first();
            if (!vote) {
                return jsonResponse({ errno: 1, errmsg: 'Vote not found' }, 404);
            }
            // 解析选项
            vote.options = JSON.parse(vote.options);
            return jsonResponse({ errno: 0, data: vote });
        }
        // 提交投票
        if (path.startsWith('/votes/') && path.endsWith('/submit') && request.method === 'POST') {
            const voteId = path.split('/')[2];
            const body = await request.json();
            const { option_ids } = body;
            const ip = request.headers.get('cf-connecting-ip') || '127.0.0.1';
            const userAgent = request.headers.get('user-agent') || '';
            
            // 检查投票是否存在
            const vote = await db.prepare('SELECT * FROM votes WHERE id = ?').bind(voteId).first();
            if (!vote) {
                return jsonResponse({ errno: 1, errmsg: 'Vote not found' }, 404);
            }
            
            // 检查投票类型
            const isMultiple = vote.is_multiple;
            if (!Array.isArray(option_ids)) {
                return jsonResponse({ errno: 1, errmsg: 'Invalid option_ids' }, 400);
            }
            if (!isMultiple && option_ids.length > 1) {
                return jsonResponse({ errno: 1, errmsg: 'Single choice only' }, 400);
            }
            
            // 检查IP限制
            if (vote.ip_limit) {
                const existingVote = await db.prepare(
                    'SELECT * FROM vote_records WHERE vote_id = ? AND ip = ?'
                ).bind(voteId, ip).first();
                if (existingVote) {
                    return jsonResponse({ errno: 1, errmsg: 'IP already voted' }, 403);
                }
            }
            
            // 检查每日限制
            if (vote.daily_limit) {
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);
                const todayVotes = await db.prepare(
                    'SELECT COUNT(*) as count FROM vote_records WHERE vote_id = ? AND ip = ? AND created >= ?'
                ).bind(voteId, ip, todayStart.getTime()).first();
                if (todayVotes?.count >= vote.daily_limit) {
                    return jsonResponse({ errno: 1, errmsg: 'Daily limit reached' }, 403);
                }
            }
            
            // 保存投票记录
            const now = Date.now();
            for (const optionId of option_ids) {
                const recordId = generateId();
                await db.prepare(
                    'INSERT INTO vote_records (id, vote_id, option_id, ip, user_agent, created) VALUES (?, ?, ?, ?, ?, ?)'
                ).bind(recordId, voteId, optionId, ip, userAgent, now).run();
            }
            
            return jsonResponse({ errno: 0, data: { msg: 'Vote submitted' } });
        }
        // 获取投票结果
        if (path.startsWith('/votes/') && path.endsWith('/results') && request.method === 'GET') {
            const voteId = path.split('/')[2];
            
            // 检查投票是否存在
            const vote = await db.prepare('SELECT * FROM votes WHERE id = ?').bind(voteId).first();
            if (!vote) {
                return jsonResponse({ errno: 1, errmsg: 'Vote not found' }, 404);
            }
            
            // 获取投票记录
            const records = await db.prepare(
                'SELECT option_id, COUNT(*) as count FROM vote_records WHERE vote_id = ? GROUP BY option_id'
            ).bind(voteId).all();
            
            // 解析选项
            const options = JSON.parse(vote.options);
            const results = options.map((option, index) => {
                const record = records.results.find(r => r.option_id === index);
                return {
                    id: index,
                    text: option,
                    count: record?.count || 0
                };
            });
            
            return jsonResponse({ errno: 0, data: { results, total: records.results.reduce((sum, r) => sum + r.count, 0) } });
        }
        
        // 获取所有投票列表
        if (path === '/votes' && request.method === 'GET') {
            const votes = await db.prepare(
                'SELECT id, title, description, created FROM votes ORDER BY created DESC'
            ).all();
            
            // 处理每个投票的选项数量
            const processedVotes = votes.results.map(vote => ({
                ...vote,
                options_count: JSON.parse(vote.options).length
            }));
            
            return jsonResponse({ errno: 0, data: processedVotes });
        }
        
        // 删除投票
        if (path.startsWith('/votes/') && request.method === 'DELETE') {
            const voteId = path.split('/')[2];
            
            // 先检查投票是否存在
            const vote = await db.prepare('SELECT * FROM votes WHERE id = ?').bind(voteId).first();
            if (!vote) {
                return jsonResponse({ errno: 1, errmsg: 'Vote not found' }, 404);
            }
            
            // 开始事务
            await db.batch([
                // 删除相关的投票记录
                db.prepare('DELETE FROM vote_records WHERE vote_id = ?').bind(voteId),
                // 删除投票
                db.prepare('DELETE FROM votes WHERE id = ?').bind(voteId)
            ]);
            
            return jsonResponse({ errno: 0, data: { msg: 'Vote deleted successfully' } });
        }
        
        // 更新投票
        if (path.startsWith('/votes/') && request.method === 'PUT') {
            const voteId = path.split('/')[2];
            
            // 解析请求体
            const body = await request.json();
            const { title, description, options, is_multiple, allow_anonymous, ip_limit, daily_limit } = body;
            
            // 验证必填字段
            if (!title || !options || !Array.isArray(options) || options.length < 2) {
                return jsonResponse({ errno: 1, errmsg: 'Invalid parameters' }, 400);
            }
            
            // 检查投票是否存在
            const vote = await db.prepare('SELECT * FROM votes WHERE id = ?').bind(voteId).first();
            if (!vote) {
                return jsonResponse({ errno: 1, errmsg: 'Vote not found' }, 404);
            }
            
            // 更新投票
            await db.prepare(
                `UPDATE votes SET title = ?, description = ?, options = ?, is_multiple = ?, 
                 allow_anonymous = ?, ip_limit = ?, daily_limit = ? WHERE id = ?`
            ).bind(
                title, description || '', JSON.stringify(options), is_multiple ? 1 : 0, 
                allow_anonymous ? 1 : 0, ip_limit ? 1 : 0, daily_limit ? 1 : 0, voteId
            ).run();
            
            return jsonResponse({ errno: 0, data: { msg: 'Vote updated successfully' } });
        }
        
        return jsonResponse({ errno: 1, errmsg: 'Not found' }, 404);
    } catch (error) {
            return jsonResponse({ errno: 1, errmsg: 'Server error: ' + error.message }, 500);
        }
    }
};



