// config.js - Dynamic API configuration for SecureTag
const CONFIG = {
    // This will automatically use localhost for local development
    // and Railway URL for production
    API_BASE_URL: window.location.hostname === 'localhost' 
        ? 'http://localhost:3000/api'
        : 'https://securetag.onrender.com', // Your render URL
    
    APP_NAME: 'SecureTag',
    VERSION: '1.0.0',
    
    // Test QR codes for demo
    TEST_QR_CODES: {
        verified: ['VERIFIED001', 'VERIFIED002'],
        invalid: ['INVALID001']
    }
};

// Log configuration on load
console.log('🔧 SecureTag Config loaded:', {
    environment: window.location.hostname === 'localhost' ? 'development' : 'production',
    apiUrl: CONFIG.API_BASE_URL
});
