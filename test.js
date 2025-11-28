// Automated test for Watch Together sync
const WebSocket = require('ws');

const SERVER = 'ws://localhost:3333';

console.log('=== Watch Together Sync Test ===\n');

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
    let roomCode = null;
    let leader = null;
    let follower1 = null;
    let follower2 = null;
    let testsPassed = 0;
    let testsFailed = 0;

    // Test 1: Create room
    console.log('TEST 1: Create Room');
    leader = new WebSocket(SERVER);

    await new Promise((resolve, reject) => {
        leader.on('open', () => {
            leader.send(JSON.stringify({
                type: 'create',
                username: 'TestLeader'
            }));
        });

        leader.on('message', (data) => {
            const msg = JSON.parse(data);
            if (msg.type === 'created') {
                roomCode = msg.roomCode;
                console.log(`  ✓ Room created: ${roomCode}`);
                testsPassed++;
                resolve();
            }
        });

        leader.on('error', reject);
        setTimeout(() => reject(new Error('Timeout')), 5000);
    });

    await sleep(500);

    // Test 2: Join room
    console.log('\nTEST 2: Join Room');
    follower1 = new WebSocket(SERVER);

    await new Promise((resolve, reject) => {
        follower1.on('open', () => {
            follower1.send(JSON.stringify({
                type: 'join',
                roomCode: roomCode,
                username: 'Follower1'
            }));
        });

        follower1.on('message', (data) => {
            const msg = JSON.parse(data);
            if (msg.type === 'joined') {
                console.log(`  ✓ Follower1 joined room ${roomCode}`);
                testsPassed++;
                resolve();
            } else if (msg.type === 'error') {
                console.log(`  ✗ Error: ${msg.message}`);
                testsFailed++;
                reject(new Error(msg.message));
            }
        });

        setTimeout(() => reject(new Error('Timeout')), 5000);
    });

    await sleep(500);

    // Test 3: Second follower joins
    console.log('\nTEST 3: Second Follower Joins');
    follower2 = new WebSocket(SERVER);

    await new Promise((resolve, reject) => {
        follower2.on('open', () => {
            follower2.send(JSON.stringify({
                type: 'join',
                roomCode: roomCode,
                username: 'Follower2'
            }));
        });

        follower2.on('message', (data) => {
            const msg = JSON.parse(data);
            if (msg.type === 'joined') {
                console.log(`  ✓ Follower2 joined, users: ${msg.users.join(', ')}`);
                testsPassed++;
                resolve();
            }
        });

        setTimeout(() => reject(new Error('Timeout')), 5000);
    });

    await sleep(500);

    // Test 4: Sync messages
    console.log('\nTEST 4: Sync Broadcast');
    let syncReceived = 0;

    const syncPromise = new Promise((resolve) => {
        const handleSync = (data) => {
            const msg = JSON.parse(data);
            if (msg.type === 'sync') {
                syncReceived++;
                if (syncReceived >= 2) {
                    console.log(`  ✓ Both followers received sync (time: ${msg.currentTime}, playing: ${msg.playing})`);
                    testsPassed++;
                    resolve();
                }
            }
        };

        follower1.on('message', handleSync);
        follower2.on('message', handleSync);
    });

    // Leader sends sync
    leader.send(JSON.stringify({
        type: 'sync',
        playing: true,
        currentTime: 42.5
    }));

    await Promise.race([
        syncPromise,
        sleep(3000).then(() => {
            if (syncReceived < 2) {
                console.log(`  ✗ Only ${syncReceived}/2 followers received sync`);
                testsFailed++;
            }
        })
    ]);

    await sleep(500);

    // Test 5: Chat message
    console.log('\nTEST 5: Chat Broadcast');
    let chatReceived = 0;

    const chatPromise = new Promise((resolve) => {
        const handleChat = (data) => {
            const msg = JSON.parse(data);
            if (msg.type === 'chat' && msg.message === 'Hello everyone!') {
                chatReceived++;
                if (chatReceived >= 3) { // All 3 (including sender) should get it
                    console.log(`  ✓ All users received chat message`);
                    testsPassed++;
                    resolve();
                }
            }
        };

        leader.on('message', handleChat);
        follower1.on('message', handleChat);
        follower2.on('message', handleChat);
    });

    follower1.send(JSON.stringify({
        type: 'chat',
        message: 'Hello everyone!'
    }));

    await Promise.race([
        chatPromise,
        sleep(3000).then(() => {
            if (chatReceived < 3) {
                console.log(`  ✗ Only ${chatReceived}/3 users received chat`);
                testsFailed++;
            }
        })
    ]);

    await sleep(500);

    // Test 6: Set video URL
    console.log('\nTEST 6: Video URL Broadcast');
    let videoReceived = 0;

    const videoPromise = new Promise((resolve) => {
        const handleVideo = (data) => {
            const msg = JSON.parse(data);
            if (msg.type === 'videoChanged') {
                videoReceived++;
                if (videoReceived >= 2) {
                    console.log(`  ✓ Followers received video URL: ${msg.videoUrl.substring(0, 40)}...`);
                    testsPassed++;
                    resolve();
                }
            }
        };

        follower1.on('message', handleVideo);
        follower2.on('message', handleVideo);
    });

    leader.send(JSON.stringify({
        type: 'setVideo',
        videoUrl: 'http://example.com/video.mp4'
    }));

    await Promise.race([
        videoPromise,
        sleep(3000).then(() => {
            if (videoReceived < 2) {
                console.log(`  ✗ Only ${videoReceived}/2 followers received video URL`);
                testsFailed++;
            }
        })
    ]);

    await sleep(500);

    // Test 7: User disconnect handling
    console.log('\nTEST 7: User Disconnect');
    let leftReceived = false;

    const leftPromise = new Promise((resolve) => {
        const handleLeft = (data) => {
            const msg = JSON.parse(data);
            if (msg.type === 'userLeft' && msg.username === 'Follower2') {
                leftReceived = true;
                console.log(`  ✓ User left notification received`);
                testsPassed++;
                resolve();
            }
        };

        leader.on('message', handleLeft);
        follower1.on('message', handleLeft);
    });

    follower2.close();

    await Promise.race([
        leftPromise,
        sleep(3000).then(() => {
            if (!leftReceived) {
                console.log(`  ✗ User left notification not received`);
                testsFailed++;
            }
        })
    ]);

    // Cleanup
    leader.close();
    follower1.close();

    await sleep(500);

    // Results
    console.log('\n=== RESULTS ===');
    console.log(`Passed: ${testsPassed}`);
    console.log(`Failed: ${testsFailed}`);
    console.log(testsFailed === 0 ? '\n✓ ALL TESTS PASSED!' : '\n✗ SOME TESTS FAILED');

    // Check health endpoint
    console.log('\n=== Health Check ===');
    const http = require('http');
    http.get('http://localhost:3333/health', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log('Health:', data);
            process.exit(testsFailed === 0 ? 0 : 1);
        });
    });
}

runTests().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
