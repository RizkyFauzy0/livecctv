const express = require('express');
const { WebSocketServer } = require('ws');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(express.json());
app.use(express.static('public'));

// In-memory storage for cameras
const cameras = new Map();
const ffmpegProcesses = new Map();
const streamClients = new Map();

// Camera management endpoints

// Add new camera
app.post('/api/cameras', (req, res) => {
    const { name, rtspUrl } = req.body;
    
    if (!name || !rtspUrl) {
        return res.status(400).json({ error: 'Name and RTSP URL are required' });
    }
    
    const id = uuidv4();
    const camera = {
        id,
        name,
        rtspUrl,
        status: 'offline',
        streamUrl: `/live/${id}`,
        createdAt: new Date().toISOString()
    };
    
    cameras.set(id, camera);
    
    res.status(201).json(camera);
});

// Get all cameras
app.get('/api/cameras', (req, res) => {
    const cameraList = Array.from(cameras.values());
    res.json(cameraList);
});

// Delete camera
app.delete('/api/cameras/:id', (req, res) => {
    const { id } = req.params;
    
    if (!cameras.has(id)) {
        return res.status(404).json({ error: 'Camera not found' });
    }
    
    // Stop streaming if active
    if (ffmpegProcesses.has(id)) {
        stopStream(id);
    }
    
    cameras.delete(id);
    res.json({ message: 'Camera deleted successfully' });
});

// Start streaming
app.post('/api/cameras/:id/start', (req, res) => {
    const { id } = req.params;
    
    if (!cameras.has(id)) {
        return res.status(404).json({ error: 'Camera not found' });
    }
    
    const camera = cameras.get(id);
    
    if (ffmpegProcesses.has(id)) {
        return res.status(400).json({ error: 'Stream already active' });
    }
    
    try {
        startStream(id, camera.rtspUrl);
        camera.status = 'live';
        cameras.set(id, camera);
        
        res.json({ message: 'Stream started successfully', camera });
    } catch (error) {
        res.status(500).json({ error: 'Failed to start stream', details: error.message });
    }
});

// Stop streaming
app.post('/api/cameras/:id/stop', (req, res) => {
    const { id } = req.params;
    
    if (!cameras.has(id)) {
        return res.status(404).json({ error: 'Camera not found' });
    }
    
    if (!ffmpegProcesses.has(id)) {
        return res.status(400).json({ error: 'Stream not active' });
    }
    
    stopStream(id);
    
    const camera = cameras.get(id);
    camera.status = 'offline';
    cameras.set(id, camera);
    
    res.json({ message: 'Stream stopped successfully', camera });
});

// Stream management functions

function startStream(cameraId, rtspUrl) {
    // FFmpeg command to convert RTSP to MJPEG
    const ffmpeg = spawn('ffmpeg', [
        '-rtsp_transport', 'tcp',
        '-i', rtspUrl,
        '-f', 'mjpeg',
        '-q:v', '5',
        '-r', '15',
        '-vf', 'scale=1280:720',
        '-'
    ]);
    
    ffmpegProcesses.set(cameraId, ffmpeg);
    streamClients.set(cameraId, new Set());
    
    ffmpeg.stdout.on('data', (data) => {
        // Broadcast frame to all connected clients for this camera
        const clients = streamClients.get(cameraId);
        if (clients) {
            clients.forEach((client) => {
                if (client.readyState === 1) { // WebSocket.OPEN
                    client.send(data);
                }
            });
        }
    });
    
    ffmpeg.stderr.on('data', (data) => {
        console.log(`FFmpeg [${cameraId}]: ${data.toString()}`);
    });
    
    ffmpeg.on('close', (code) => {
        console.log(`FFmpeg process for camera ${cameraId} exited with code ${code}`);
        ffmpegProcesses.delete(cameraId);
        
        // Update camera status
        const camera = cameras.get(cameraId);
        if (camera) {
            camera.status = 'offline';
            cameras.set(cameraId, camera);
        }
        
        // Close all client connections for this camera
        const clients = streamClients.get(cameraId);
        if (clients) {
            clients.forEach((client) => {
                client.close();
            });
            streamClients.delete(cameraId);
        }
    });
    
    ffmpeg.on('error', (error) => {
        console.error(`FFmpeg error for camera ${cameraId}:`, error);
    });
}

function stopStream(cameraId) {
    const ffmpeg = ffmpegProcesses.get(cameraId);
    if (ffmpeg) {
        ffmpeg.kill('SIGTERM');
        ffmpegProcesses.delete(cameraId);
    }
    
    // Close all client connections
    const clients = streamClients.get(cameraId);
    if (clients) {
        clients.forEach((client) => {
            client.close();
        });
        streamClients.delete(cameraId);
    }
}

// WebSocket server for video streaming
wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const cameraId = url.searchParams.get('cameraId');
    
    if (!cameraId || !cameras.has(cameraId)) {
        ws.close(1008, 'Camera not found');
        return;
    }
    
    console.log(`Client connected to camera ${cameraId}`);
    
    // Add client to camera's client set
    if (!streamClients.has(cameraId)) {
        streamClients.set(cameraId, new Set());
    }
    streamClients.get(cameraId).add(ws);
    
    ws.on('close', () => {
        console.log(`Client disconnected from camera ${cameraId}`);
        const clients = streamClients.get(cameraId);
        if (clients) {
            clients.delete(ws);
        }
    });
    
    ws.on('error', (error) => {
        console.error(`WebSocket error for camera ${cameraId}:`, error);
    });
});

// Serve live streaming page
app.get('/live/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'live.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok',
        cameras: cameras.size,
        activeStreams: ffmpegProcesses.size
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Live CCTV Server running on http://localhost:${PORT}`);
    console.log(`Admin Panel: http://localhost:${PORT}`);
});

// Graceful shutdown handler
function gracefulShutdown(signal) {
    console.log(`${signal} received, shutting down gracefully...`);
    
    // Stop all streams
    ffmpegProcesses.forEach((ffmpeg, cameraId) => {
        stopStream(cameraId);
    });
    
    // Close WebSocket server
    wss.close(() => {
        console.log('WebSocket server closed');
    });
    
    // Close HTTP server
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
