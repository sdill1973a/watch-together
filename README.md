# Watch Together

Self-hosted synchronized video watching with friends. No accounts, no extensions, just share a link.

## Features

- **Instant Rooms**: Create a room, share the 4-character code
- **Real-time Sync**: Play, pause, seek - everyone stays in sync
- **Plex Integration**: Browse your Plex library and watch together
- **Live Chat**: Built-in chat with the room
- **Zero Friction**: No sign-up, no app download, works in any browser
- **Self-hosted**: Your server, your rules, your data

## Quick Start

### Docker (Recommended)

```bash
docker run -d -p 3333:3333 --name watch-together ghcr.io/yourusername/watch-together
```

### Docker Compose

```bash
git clone https://github.com/yourusername/watch-together.git
cd watch-together
docker-compose up -d
```

### Node.js

```bash
git clone https://github.com/yourusername/watch-together.git
cd watch-together
npm install
npm start
```

Then open `http://localhost:3333` in your browser.

## Usage

1. **Create a Room**: Enter your name, click "Create Room"
2. **Share the Code**: Give your friends the 4-character room code (or copy the link)
3. **Load a Video**: As the host, paste a video URL or browse your Plex library
4. **Watch Together**: Everyone stays in sync automatically

## Supported Sources

- **Plex**: Connect your Plex server to browse and play content
- **Direct URLs**: Any direct video URL (mp4, webm, etc.)
- **HLS/DASH**: Streaming URLs work too

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `PORT` | 3333 | Server port |

## How It Works

- One person is the "leader" (room creator)
- Leader's playback state syncs to all followers every 2 seconds
- If drift exceeds 2 seconds, followers auto-correct
- Play/pause/seek events broadcast immediately

## Roadmap

- [ ] Jellyfin/Emby integration
- [ ] YouTube URL support
- [ ] Voice chat (WebRTC)
- [ ] Reactions/emojis
- [ ] Persistent rooms
- [ ] Mobile app

## License

MIT
