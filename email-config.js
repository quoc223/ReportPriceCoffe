// Email configuration
module.exports = {
    // Gmail configuration (bạn có thể thay đổi theo nhà cung cấp email của mình)
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Thay đổi email của bạn
        pass: process.env.EMAIL_PASS     // Thay đổi app password (không phải mật khẩu thường)
    },
    
    // Email settings
    from: process.env.EMAIL_FROM,
    to: process.env.EMAIL_TO,    // Email người nhận    // Report settings
    reportInterval: 24 * 60 * 60 * 1000, // Gửi báo cáo mỗi 24 giờ (1 ngày) - chỉ để tham khảo
    dailyReportTime: 8, // Giờ gửi báo cáo hàng ngày (8 = 8:00 AM)
      // Price alert settings
    priceAlerts: {
        enabled: true,
        thresholds: {
            high: 6000,  // Cảnh báo khi giá > $6000
            low: 4000    // Cảnh báo khi giá < $4000
        }
    },
      // Login settings for report page
    login: {
        enabled: process.env.LOGIN_ENABLED === 'true',
        username: process.env.ADMIN_USERNAME || 'admin',
        password: process.env.ADMIN_PASSWORD || 'coffee2025',
        sessionTimeout: 24 * 60 * 60 * 1000 // 24 hours
    }
};

/*
Hướng dẫn cấu hình Gmail:
1. Bật 2-Factor Authentication cho tài khoản Gmail
2. Tạo App Password: 
   - Vào Google Account Settings
   - Security > 2-Step Verification > App passwords
   - Tạo password mới cho ứng dụng
3. Sử dụng App Password thay vì mật khẩu thường
*/
