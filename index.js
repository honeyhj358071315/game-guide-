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
                    await db.prepare(
                        'UPDATE posts SET like_count = GREATEST(0, like_count - 1) WHERE id = ?'
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
            return jsonResponse({ errno: 1, errmsg: 'Not found' }, 404);
        } catch (error) {
            return jsonResponse({ errno: 1, errmsg: 'Server error: ' + error.message }, 500);
        }
    }
};

