// UMBRA API v2 - Refactored modular version
// This file now re-exports the modular API implementation
// Backward compatibility maintained for existing imports

const ApiServerV2 = require('./api-server');

// Re-export the class for backward compatibility
module.exports = ApiServerV2;

// Note: The original 1002-line file has been refactored into:
// - api-server.js      - Main server class
// - api-middleware.js  - Authentication, rate limiting, CORS
// - api-websocket.js   - WebSocket handling
// - api-router.js      - HTTP request routing

// Benefits of this refactoring:
// 1. Better separation of concerns
// 2. Easier testing of individual components
// 3. Improved maintainability
// 4. Reduced cognitive load per file
// 5. Reusable middleware components

// All existing functionality is preserved.
// The public API remains exactly the same.
