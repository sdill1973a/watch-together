const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3333;

// Rooms: { roomCode: { leader: ws, clients: Set<ws>, videoUrl: string, state: {playing, currentTime} } }
const rooms = new Map();

// Generate 4-char room code
function generateRoomCode() {
    return crypto.randomBytes(2).toString('hex').toUpperCase();
}

// HTTP server for static files
const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
        fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading page');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } else if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', rooms: rooms.size }));
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

// WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    ws.roomCode = null;
    ws.isLeader = false;
    ws.username = 'Anonymous';

    ws.on('message', (data) => {
        let msg;
        try {
            msg = JSON.parse(data);
        } catch (e) {
            return;
        }

        switch (msg.type) {
            case 'create':
                handleCreate(ws, msg);
                break;
            case 'join':
                handleJoin(ws, msg);
                break;
            case 'sync':
                handleSync(ws, msg);
                break;
            case 'chat':
                handleChat(ws, msg);
                break;
            case 'setVideo':
                handleSetVideo(ws, msg);
                break;
        }
    });

    ws.on('close', () => {
        if (ws.roomCode && rooms.has(ws.roomCode)) {
            const room = rooms.get(ws.roomCode);
            room.clients.delete(ws);

            // If leader left, promote someone or close room
            if (ws.isLeader) {
                if (room.clients.size > 0) {
                    const newLeader = room.clients.values().next().value;
                    newLeader.isLeader = true;
                    room.leader = newLeader;
                    broadcast(room, { type: 'newLeader', username: newLeader.username });
                } else {
                    rooms.delete(ws.roomCode);
                }
            } else {
                broadcast(room, { type: 'userLeft', username: ws.username });
            }
        }
    });
});

function handleCreate(ws, msg) {
    const roomCode = generateRoomCode();
    const room = {
        leader: ws,
        clients: new Set([ws]),
        videoUrl: msg.videoUrl || '',
        state: { playing: false, currentTime: 0 }
    };
    rooms.set(roomCode, room);

    ws.roomCode = roomCode;
    ws.isLeader = true;
    ws.username = msg.username || 'Host';

    ws.send(JSON.stringify({
        type: 'created',
        roomCode,
        isLeader: true
    }));

    console.log(`Room ${roomCode} created by ${ws.username}`);
}

function handleJoin(ws, msg) {
    const roomCode = msg.roomCode?.toUpperCase();
    if (!roomCode || !rooms.has(roomCode)) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
        return;
    }

    const room = rooms.get(roomCode);
    room.clients.add(ws);

    ws.roomCode = roomCode;
    ws.isLeader = false;
    ws.username = msg.username || 'Guest';

    ws.send(JSON.stringify({
        type: 'joined',
        roomCode,
        isLeader: false,
        videoUrl: room.videoUrl,
        state: room.state,
        users: Array.from(room.clients).map(c => c.username)
    }));

    broadcast(room, { type: 'userJoined', username: ws.username }, ws);
    console.log(`${ws.username} joined room ${roomCode}`);
}

function handleSync(ws, msg) {
    if (!ws.isLeader || !ws.roomCode) return;

    const room = rooms.get(ws.roomCode);
    if (!room) return;

    room.state = {
        playing: msg.playing,
        currentTime: msg.currentTime
    };

    // Broadcast to all non-leaders
    broadcast(room, {
        type: 'sync',
        playing: msg.playing,
        currentTime: msg.currentTime,
        serverTime: Date.now()
    }, ws);
}

function handleChat(ws, msg) {
    if (!ws.roomCode) return;
    const room = rooms.get(ws.roomCode);
    if (!room) return;

    broadcast(room, {
        type: 'chat',
        username: ws.username,
        message: msg.message
    });
}

function handleSetVideo(ws, msg) {
    if (!ws.isLeader || !ws.roomCode) return;

    const room = rooms.get(ws.roomCode);
    if (!room) return;

    room.videoUrl = msg.videoUrl;
    room.state = { playing: false, currentTime: 0 };

    broadcast(room, {
        type: 'videoChanged',
        videoUrl: msg.videoUrl
    });
}

function broadcast(room, msg, exclude = null) {
    const data = JSON.stringify(msg);
    room.clients.forEach(client => {
        if (client !== exclude && client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

server.listen(PORT, () => {
    console.log(`Watch Together server running on http://localhost:${PORT}`);
});
