# Live CCTV - RTSP Streaming Management

A web-based application for managing and streaming CCTV cameras via RTSP protocol. This application allows administrators to add RTSP camera feeds, automatically convert them to browser-compatible streams, and share live viewing URLs.

## Features

### 🎥 Camera Management
- Add unlimited CCTV cameras with RTSP URLs
- View all cameras in a responsive grid layout
- Start/stop streaming for each camera
- Delete cameras when no longer needed
- Real-time status monitoring (LIVE/OFFLINE)

### 📡 Live Streaming
- Automatic RTSP to MJPEG conversion using FFmpeg
- WebSocket-based real-time video streaming
- Browser-compatible video display using HTML5 Canvas
- Fullscreen viewing mode
- Shareable public URLs for each camera

### 🎨 Modern UI
- Dark-themed responsive interface built with TailwindCSS
- Real-time statistics dashboard
- Empty state for better UX
- Modal-based camera addition
- Copy-to-clipboard for stream URLs

### 🔄 Real-time Updates
- WebSocket connections for live video frames
- Auto-refresh camera list every 5 seconds
- Real-time status indicators
- Smooth animations and transitions

## Screenshots

### Admin Panel
The main dashboard shows all cameras with their status, controls, and generated URLs.

### Live Stream Page
Full-screen streaming page with minimal controls for optimal viewing experience.

## Prerequisites

Before running this application, ensure you have the following installed:

- **Node.js** (v14 or higher)
- **npm** (comes with Node.js)
- **FFmpeg** (required for RTSP to MJPEG conversion)

### Installing FFmpeg

#### Ubuntu/Debian:
```bash
sudo apt-get update
sudo apt-get install ffmpeg
```

#### macOS:
```bash
brew install ffmpeg
```

#### Windows:
Download from [FFmpeg official website](https://ffmpeg.org/download.html) and add to PATH.

Verify installation:
```bash
ffmpeg -version
```

## Installation

1. **Clone the repository:**
```bash
git clone https://github.com/RizkyFauzy0/livecctv.git
cd livecctv
```

2. **Install dependencies:**
```bash
npm install
```

3. **Start the server:**
```bash
npm start
```

The application will be available at `http://localhost:3000`

## Usage

### Adding a Camera

1. Open the admin panel at `http://localhost:3000`
2. Click the **"Add Camera"** button in the header
3. Fill in the camera details:
   - **Camera Name**: A friendly name for your camera (e.g., "Front Door Camera")
   - **RTSP URL**: The RTSP stream URL from your camera
4. Click **"Add Camera"** to save

### RTSP URL Format

The RTSP URL typically follows this format:
```
rtsp://username:password@ip_address:port/path
```

**Examples:**
```
rtsp://admin:admin123@192.168.1.100:554/stream1
rtsp://admin:password@10.0.0.50:554/cam/realmonitor?channel=1&subtype=0
rtsp://192.168.1.64:554/user=admin&password=&channel=1&stream=0.sdp
```

### Starting/Stopping Streams

- Click the **"Start"** button on a camera card to begin streaming
- The status will change to **"LIVE"** with a green indicator
- Video will appear in the preview canvas
- Click **"Stop"** to end the stream

### Viewing Live Stream

1. **Option 1 - Fullscreen Button:**
   - Click the fullscreen icon on any camera card
   - Opens the live stream in a new tab

2. **Option 2 - Shareable URL:**
   - Copy the generated URL from the camera card
   - Share the URL with anyone who needs access
   - Format: `http://your-server:3000/live/{camera-id}`

### Deleting a Camera

1. Click the **trash icon** on the camera card
2. Confirm the deletion
3. The camera and its stream (if active) will be removed

## API Endpoints

The application provides RESTful API endpoints:

### Camera Management

#### Add Camera
```http
POST /api/cameras
Content-Type: application/json

{
  "name": "Camera Name",
  "rtspUrl": "rtsp://..."
}
```

#### Get All Cameras
```http
GET /api/cameras
```

#### Delete Camera
```http
DELETE /api/cameras/:id
```

### Stream Control

#### Start Stream
```http
POST /api/cameras/:id/start
```

#### Stop Stream
```http
POST /api/cameras/:id/stop
```

### Health Check
```http
GET /health
```

## Configuration

### Port Configuration
By default, the server runs on port 3000. You can change this by setting the `PORT` environment variable:

```bash
PORT=8080 npm start
```

### FFmpeg Options
The FFmpeg conversion settings can be adjusted in `server.js`:
- `-q:v 5`: JPEG quality (1-31, lower is better)
- `-r 15`: Frame rate (frames per second)
- `-vf scale=1280:720`: Video resolution

## Troubleshooting

### Problem: Stream won't start

**Possible causes:**
1. FFmpeg not installed or not in PATH
2. Invalid RTSP URL
3. Network connectivity issues to camera
4. Camera requires authentication

**Solutions:**
- Verify FFmpeg installation: `ffmpeg -version`
- Check RTSP URL format and credentials
- Test RTSP URL with VLC Media Player first
- Check firewall settings

### Problem: Video is laggy or choppy

**Solutions:**
- Reduce frame rate in FFmpeg settings (e.g., `-r 10`)
- Lower video resolution (e.g., `-vf scale=640:360`)
- Check network bandwidth
- Reduce JPEG quality (higher `-q:v` value)

### Problem: "Camera not found" error

**Solutions:**
- Ensure the camera was added successfully
- Check if the camera ID in the URL is correct
- Refresh the camera list

### Problem: WebSocket connection fails

**Solutions:**
- Check if the server is running
- Ensure WebSocket connections are not blocked by firewall
- Try using a different browser
- Check browser console for specific error messages

### Problem: Cannot access stream from external network

**Solutions:**
- Configure port forwarding on your router
- Update WebSocket URL to use external IP/domain
- Ensure firewall allows incoming connections on the server port

## Technical Details

### Architecture
- **Backend**: Node.js with Express framework
- **WebSocket**: ws library for real-time communication
- **Video Processing**: FFmpeg for RTSP to MJPEG conversion
- **Frontend**: Vanilla JavaScript with TailwindCSS
- **Storage**: In-memory Map (data lost on server restart)

### File Structure
```
livecctv/
├── server.js           # Backend server
├── package.json        # Dependencies
├── public/
│   ├── index.html      # Admin panel
│   └── live.html       # Live streaming page
├── .gitignore         # Git ignore rules
└── README.md          # Documentation
```

### How It Works
1. Admin adds camera with RTSP URL
2. When stream starts, FFmpeg spawns a child process
3. FFmpeg converts RTSP stream to MJPEG frames
4. Frames are broadcast to connected WebSocket clients
5. Browser receives frames and renders on Canvas element
6. Process continues until stream is stopped

## Security Considerations

⚠️ **Important Security Notes:**

1. **Authentication**: This application does not include built-in authentication. Consider adding authentication middleware before deploying to production.

2. **RTSP Credentials**: Be careful when sharing URLs that contain camera credentials.

3. **Network Security**: Run behind a reverse proxy (nginx, Apache) with HTTPS in production.

4. **Input Validation**: The application performs basic validation, but additional sanitization may be needed for production use.

5. **Rate Limiting**: Consider implementing rate limiting to prevent abuse.

## Production Deployment

For production use, consider:

1. **Use a process manager** (PM2, systemd):
```bash
npm install -g pm2
pm2 start server.js --name livecctv
pm2 startup
pm2 save
```

2. **Set up reverse proxy** with nginx for HTTPS

3. **Use persistent storage** (database) instead of in-memory storage

4. **Implement authentication** and authorization

5. **Add logging and monitoring**

6. **Configure proper error handling**

## Development

To run in development mode with auto-restart on changes:

```bash
npm install -g nodemon
nodemon server.js
```

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues, questions, or suggestions, please open an issue on the GitHub repository.

## Acknowledgments

- Built with [Express.js](https://expressjs.com/)
- Styled with [TailwindCSS](https://tailwindcss.com/)
- Video processing by [FFmpeg](https://ffmpeg.org/)
- WebSocket support by [ws](https://github.com/websockets/ws)
