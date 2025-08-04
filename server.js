const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.get('/healthz', (req, res) => {
    res.status(200).send('OK');
});
app.use(cors({
    origin: '*', // Allow all origins for simplicity
    credentials: true
}));
app.use(express.json());

// Serve static files
app.use(express.static('.'));

// Your 3 QR codes configuration
const QR_CODES = {
    'VERIFIED001': {
        verified: true,
        name: 'John Employee',
        department: 'Engineering',
        accessLevel: 'Level 3',
        validUntil: '2024-12-31',
        type: 'Employee Access',
        description: 'Full access employee badge'
    },
    'VERIFIED002': {
        verified: true,
        name: 'Sarah Visitor',
        department: 'Guest',
        accessLevel: 'Level 1',
        validUntil: '2024-12-31',
        type: 'Visitor Pass',
        description: 'Temporary visitor access'
    },
    'INVALID001': {
        verified: false,
        reason: 'Expired/Invalid QR Code',
        description: 'This QR code has expired or is not valid'
    }
};

// Simple verification log (in-memory storage)
const verificationLog = [];

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        message: 'SecureTag Backend Running!',
        environment: process.env.NODE_ENV || 'development',
        testQRCodes: Object.keys(QR_CODES),
        totalScans: verificationLog.length
    });
});

// QR Code verification endpoint
app.post('/api/verify-qr', (req, res) => {
    const { qrCode } = req.body;
    const timestamp = new Date().toISOString();
    
    console.log(`[${timestamp}] 🔍 Verifying QR Code:`, qrCode);
    
    // Log the verification attempt
    const logEntry = {
        qrCode,
        timestamp,
        ip: req.ip || req.connection.remoteAddress || 'unknown'
    };
    
    verificationLog.push(logEntry);
    
    // Keep only last 100 logs to prevent memory issues
    if (verificationLog.length > 100) {
        verificationLog.shift();
    }
    
    // Check if QR code exists
    const qrData = QR_CODES[qrCode];
    
    if (!qrData) {
        console.log(`[${timestamp}] ❌ Unknown QR Code:`, qrCode);
        return res.json({
            verified: false,
            qrCode: qrCode,
            message: 'Unknown QR Code',
            description: 'This QR code is not registered in our system. Please contact admin.'
        });
    }
    
    // Return verification result
    if (qrData.verified) {
        console.log(`[${timestamp}] ✅ Verified QR Code:`, qrCode, '-', qrData.name);
        res.json({
            verified: true,
            qrCode: qrCode,
            message: 'QR Code Verified Successfully',
            data: {
                ...qrData,
                verifiedAt: timestamp,
                secureToken: 'DEMO-TOKEN-' + Date.now().toString(36).toUpperCase()
            }
        });
    } else {
        console.log(`[${timestamp}] ❌ Invalid QR Code:`, qrCode);
        res.json({
            verified: false,
            qrCode: qrCode,
            message: 'Invalid QR Code',
            description: qrData.description || qrData.reason || 'This QR code is not authorized'
        });
    }
});

// Simple stats endpoint
app.get('/api/stats', (req, res) => {
    const last24Hours = verificationLog.filter(log => {
        const logTime = new Date(log.timestamp);
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return logTime > oneDayAgo;
    });
    
    res.json({
        totalScans: verificationLog.length,
        scansLast24Hours: last24Hours.length,
        lastScans: verificationLog.slice(-10).reverse(),
        qrCodesConfigured: Object.keys(QR_CODES).length,
        serverUptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
    });
});

// Start server with 0.0.0.0 binding for Railway
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('\n🚀 SecureTag Backend Server Started!');
    console.log('📍 Port:', PORT);
    console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
    console.log('🔗 Local URL: http://localhost:' + PORT);
    
    if (process.env.RAILWAY_STATIC_URL) {
        console.log('🚂 Railway URL:', process.env.RAILWAY_STATIC_URL);
    }
    
    console.log('\n📋 Test QR Codes:');
    console.log('   ✅ VERIFIED001 - John Employee (Engineering)');
    console.log('   ✅ VERIFIED002 - Sarah Visitor (Guest)');
    console.log('   ❌ INVALID001 - Invalid/Expired Code');
    console.log('\n💡 Generate QR codes at: https://qr-code-generator.com/');
    console.log('📊 Stats available at: /api/stats');
    console.log('❤️  Health check at: /api/health\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

// Keep process alive and handle errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Don't exit on uncaught exceptions in production
    if (process.env.NODE_ENV !== 'production') {
        process.exit(1);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit on unhandled rejections in production
    if (process.env.NODE_ENV !== 'production') {
        process.exit(1);
    }
});

// For Railway health checks
if (process.env.RAILWAY_ENVIRONMENT) {
    console.log('🚂 Running on Railway!');
}
