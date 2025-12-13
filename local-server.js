const http = require('http');
const fs = require('fs');
const path = require('path');

// 处理API请求的简单服务器
const server = http.createServer((req, res) => {
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Admin-Key');
    
    // 处理OPTIONS请求
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    
    // 解析请求路径
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    
    // 模拟投票API响应
    if (pathname === '/votes' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const voteData = JSON.parse(body);
                console.log('收到创建投票请求:', voteData);
                
                // 返回成功响应
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    errno: 0,
                    data: { vote_id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9) }
                }));
            } catch (error) {
                console.error('解析请求体失败:', error);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ errno: 1, errmsg: 'Invalid JSON' }));
            }
        });
    } else if (pathname === '/votes' && req.method === 'GET') {
        // 返回空的投票列表
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ errno: 0, data: [] }));
    } else {
        // 提供静态文件
        const filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
        const extname = String(path.extname(filePath)).toLowerCase();
        
        const contentType = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.wav': 'audio/wav',
            '.mp4': 'video/mp4',
            '.woff': 'application/font-woff',
            '.ttf': 'application/font-ttf',
            '.eot': 'application/vnd.ms-fontobject',
            '.otf': 'application/font-otf',
            '.wasm': 'application/wasm'
        }[extname] || 'application/octet-stream';
        
        fs.readFile(filePath, (error, content) => {
            if (error) {
                if (error.code === 'ENOENT') {
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    res.end('<h1>404 Not Found</h1>', 'utf-8');
                } else {
                    res.writeHead(500);
                    res.end('Server Error: ' + error.code, 'utf-8');
                }
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content, 'utf-8');
            }
        });
    }
});

const PORT = process.env.PORT || 8787;
server.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log('API端点: http://localhost:${PORT}/votes');
});
