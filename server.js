const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:8080', 'http://127.0.0.1:8080', 'file://'],
    credentials: true
}));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Mock database - In production, use a real database
const mockDatabase = {
    // Authorized QR codes with their data
    qrCodes: {
        'EMP001-SECURE-2024': {
            name: 'John Doe',
            department: 'Engineering',
            accessLevel: 'Level 3',
            validUntil: new Date('2024-12-31').toISOString(),
            secureToken: crypto.randomBytes(32).toString('hex'),
            createdAt: new Date().toISOString()
        },
        'EMP002-SECURE-2024': {
            name: 'Jane Smith',
            department: 'Security',
            accessLevel: 'Level 5',
            validUntil: new Date('2024-12-31').toISOString(),
            secureToken: crypto.randomBytes(32).toString('hex'),
            createdAt: new Date().toISOString()
        },
        'VISITOR-TEMP-001': {
            name: 'Mike Johnson',
            department: 'Visitor',
            accessLevel: 'Level 1',
            validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Valid for 24 hours
            secureToken: crypto.randomBytes(32).toString('hex'),
            createdAt: new Date().toISOString()
        },
        'https://example.com/secure': {
            name: 'External Link',
            department: 'Web Access',
            accessLevel: 'Level 2',
            validUntil: new Date('2024-12-31').toISOString(),
            secureToken: crypto.randomBytes(32).toString('hex'),
            createdAt: new Date().toISOString()
        }
    },
    
    // NFC tags database
    nfcTags: {
        '04:A3:B2:C1:D4:E5:F6': {
            name: 'Sarah Wilson',
            department: 'HR',
            accessLevel: 'Level 2',
            validUntil: new Date('2024-12-31').toISOString(),
            tagType: 'NTAG213',
            content: 'Employee Access Card'
        }
    },
    
    // Audit log
    auditLog: []
};

// Helper function to log activities
function logActivity(type, data, result) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        type: type,
        data: data,
        result: result,
        ip: data.ip || 'unknown'
    };
    mockDatabase.auditLog.push(logEntry);
    
    // Keep only last 1000 entries
    if (mockDatabase.auditLog.length > 1000) {
        mockDatabase.auditLog = mockDatabase.auditLog.slice(-1000);
    }
    
    console.log(`[${logEntry.timestamp}] ${type}:`, result.verified ? 'VERIFIED' : 'FAILED', '-', data.qrCode || data.nfcTag);
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0',
        endpoints: {
            'POST /api/verify-qr': 'Verify QR codes',
            'POST /api/verify-nfc': 'Verify NFC tags',
            'POST /api/admin/generate-qr': 'Generate new QR codes',
            'GET /api/admin/audit-logs': 'View audit logs',
            'GET /api/admin/stats': 'System statistics'
        }
    });
});

// QR Code verification endpoint
app.post('/api/verify-qr', (req, res) => {
    const { qrCode } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (!qrCode) {
        return res.status(400).json({
            verified: false,
            message: 'Invalid request',
            description: 'QR code data is required'
        });
    }
    
    // Check if QR code exists in our database
    const qrData = mockDatabase.qrCodes[qrCode];
    
    if (!qrData) {
        const result = {
            verified: false,
            message: 'Unauthorized QR Code',
            description: 'This QR code is not registered in our system',
            qrCode: qrCode
        };
        
        logActivity('QR_VERIFICATION', { qrCode, ip: clientIP }, result);
        return res.json(result);
    }
    
    // Check if QR code is still valid
    const now = new Date();
    const validUntil = new Date(qrData.validUntil);
    
    if (now > validUntil) {
        const result = {
            verified: false,
            message: 'Expired QR Code',
            description: `This QR code expired on ${validUntil.toLocaleDateString()}`,
            qrCode: qrCode
        };
        
        logActivity('QR_VERIFICATION', { qrCode, ip: clientIP }, result);
        return res.json(result);
    }
    
    // QR code is valid
    const result = {
        verified: true,
        message: 'QR Code Verified Successfully',
        qrCode: qrCode,
        data: {
            ...qrData,
            verifiedAt: new Date().toISOString()
        }
    };
    
    logActivity('QR_VERIFICATION', { qrCode, ip: clientIP }, result);
    res.json(result);
});

// NFC Tag verification endpoint
app.post('/api/verify-nfc', (req, res) => {
    const { tagId, tagData } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (!tagId) {
        return res.status(400).json({
            verified: false,
            message: 'Invalid request',
            description: 'NFC tag ID is required'
        });
    }
    
    // Check if NFC tag exists in our database
    const nfcData = mockDatabase.nfcTags[tagId];
    
    if (!nfcData) {
        const result = {
            verified: false,
            message: 'Unauthorized NFC Tag',
            description: 'This NFC tag is not registered in our system',
            tagId: tagId
        };
        
        logActivity('NFC_VERIFICATION', { nfcTag: tagId, ip: clientIP }, result);
        return res.json(result);
    }
    
    // Check if NFC tag is still valid
    const now = new Date();
    const validUntil = new Date(nfcData.validUntil);
    
    if (now > validUntil) {
        const result = {
            verified: false,
            message: 'Expired NFC Tag',
            description: `This NFC tag expired on ${validUntil.toLocaleDateString()}`,
            tagId: tagId
        };
        
        logActivity('NFC_VERIFICATION', { nfcTag: tagId, ip: clientIP }, result);
        return res.json(result);
    }
    
    // NFC tag is valid
    const result = {
        verified: true,
        message: 'NFC Tag Verified Successfully',
        tagId: tagId,
        data: {
            ...nfcData,
            verifiedAt: new Date().toISOString()
        }
    };
    
    logActivity('NFC_VERIFICATION', { nfcTag: tagId, ip: clientIP }, result);
    res.json(result);
});

// Generate new QR codes (admin endpoint)
app.post('/api/admin/generate-qr', (req, res) => {
    const { name, department, accessLevel, validDays = 30 } = req.body;
    
    if (!name || !department || !accessLevel) {
        return res.status(400).json({
            success: false,
            message: 'Missing required fields: name, department, accessLevel'
        });
    }
    
    // Generate unique QR code
    const qrCode = `${department.toUpperCase()}-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const validUntil = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000);
    
    const qrData = {
        name,
        department,
        accessLevel,
        validUntil: validUntil.toISOString(),
        secureToken: crypto.randomBytes(32).toString('hex'),
        createdAt: new Date().toISOString()
    };
    
    // Store in database
    mockDatabase.qrCodes[qrCode] = qrData;
    
    res.json({
        success: true,
        qrCode: qrCode,
        data: qrData,
        message: 'QR code generated successfully'
    });
});

// Get audit logs (admin endpoint)
app.get('/api/admin/audit-logs', (req, res) => {
    const { limit = 50, type } = req.query;
    
    let logs = mockDatabase.auditLog;
    
    if (type) {
        logs = logs.filter(log => log.type === type);
    }
    
    // Get latest logs
    logs = logs.slice(-parseInt(limit)).reverse();
    
    res.json({
        success: true,
        logs: logs,
        total: mockDatabase.auditLog.length
    });
});

// Get system statistics
app.get('/api/admin/stats', (req, res) => {
    const totalQRCodes = Object.keys(mockDatabase.qrCodes).length;
    const totalNFCTags = Object.keys(mockDatabase.nfcTags).length;
    const totalScans = mockDatabase.auditLog.length;
    
    const last24Hours = mockDatabase.auditLog.filter(log => {
        const logTime = new Date(log.timestamp);
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return logTime > oneDayAgo;
    });
    
    const successfulScans = last24Hours.filter(log => log.result.verified).length;
    const failedScans = last24Hours.filter(log => !log.result.verified).length;
    
    res.json({
        success: true,
        stats: {
            totalQRCodes,
            totalNFCTags,
            totalScans,
            last24Hours: {
                total: last24Hours.length,
                successful: successfulScans,
                failed: failedScans,
                successRate: last24Hours.length > 0 ? (successfulScans / last24Hours.length * 100).toFixed(2) + '%' : '0%'
            }
        }
    });
});

// Serve static files (for serving index.html)
app.use(express.static('.'));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 SecureTag Backend Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🌐 Frontend: http://localhost:${PORT}`);
    console.log('\n📋 Sample QR Codes to test:');
    Object.keys(mockDatabase.qrCodes).forEach(qr => {
        console.log(`   - ${qr} (${mockDatabase.qrCodes[qr].name})`);
    });
    console.log('\n💡 Generate QR codes at: https://qr-code-generator.com/');
});

module.exports = app;