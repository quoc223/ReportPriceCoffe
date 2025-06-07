// Coffee Robusta Price Tracker với Daily Email Report
require('dotenv').config();

const { Client } = require('@mathieuc/tradingview');
const nodemailer = require('nodemailer');
const emailConfig = require('./email-config');
const http = require('http');
const url = require('url');

const client = new Client();
const PORT = process.env.PORT || 3000;

// Debug: Log email configuration at startup
console.log('📧 Email Configuration Debug:');
console.log('EMAIL_USER:', process.env.EMAIL_USER ? '✅ Set' : '❌ Missing');
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '✅ Set' : '❌ Missing');
console.log('EMAIL_FROM:', process.env.EMAIL_FROM || 'NOT SET');
console.log('EMAIL_TO:', process.env.EMAIL_TO || 'NOT SET');
console.log('emailConfig.auth.user:', emailConfig.auth.user || 'NOT SET');
console.log('emailConfig.from:', emailConfig.from || 'NOT SET');
console.log('emailConfig.to:', emailConfig.to || 'NOT SET');
console.log('═'.repeat(50));

// Tạo transporter cho email
const transporter = nodemailer.createTransport({
    service: emailConfig.service,
    auth: emailConfig.auth
});

// Biến lưu trữ dữ liệu báo cáo
let reportData = {
    startTime: new Date(),
    updates: [],
    currentPrice: null,
    highPrice: null,
    lowPrice: null,
    symbol: null,
    previousPrice: null,
    lastEmailSent: null,
    monthlyData: {} // Lưu trữ dữ liệu tháng để hiển thị xu hướng
};

// Quản lý session đơn giản
const activeSessions = new Map();

// Hàm tạo session ID
function generateSessionId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Hàm kiểm tra session
function isValidSession(sessionId) {
    if (!sessionId || !activeSessions.has(sessionId)) {
        return false;
    }
    
    const session = activeSessions.get(sessionId);
    const now = Date.now();
    
    if (now > session.expires) {
        activeSessions.delete(sessionId);
        return false;
    }
    
    // Gia hạn session
    session.expires = now + emailConfig.login.sessionTimeout;
    return true;
}

// Hàm lấy session từ cookie
function getSessionFromCookie(cookieHeader) {
    if (!cookieHeader) return null;
    
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
    }, {});
    
    return cookies.sessionId || null;
}

// Hàm tạo trang login
function generateLoginPage(error = '') {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Coffee Price Tracker - Login</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    margin: 0; 
                    padding: 0; 
                    background: linear-gradient(135deg, #2E8B57, #228B22);
                    height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                .login-container {
                    background: white;
                    padding: 40px;
                    border-radius: 10px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                    width: 100%;
                    max-width: 400px;
                    text-align: center;
                }
                .logo {
                    font-size: 48px;
                    margin-bottom: 10px;
                }
                .title {
                    color: #2E8B57;
                    margin-bottom: 30px;
                    font-size: 24px;
                    font-weight: bold;
                }
                .form-group {
                    margin-bottom: 20px;
                    text-align: left;
                }
                .form-group label {
                    display: block;
                    margin-bottom: 5px;
                    color: #333;
                    font-weight: bold;
                }
                .form-group input {
                    width: 100%;
                    padding: 12px;
                    border: 2px solid #ddd;
                    border-radius: 5px;
                    font-size: 16px;
                    box-sizing: border-box;
                }
                .form-group input:focus {
                    border-color: #2E8B57;
                    outline: none;
                }
                .login-btn {
                    width: 100%;
                    background: #2E8B57;
                    color: white;
                    padding: 12px;
                    border: none;
                    border-radius: 5px;
                    font-size: 16px;
                    cursor: pointer;
                    font-weight: bold;
                }
                .login-btn:hover {
                    background: #228B22;
                }
                .error {
                    color: #DC143C;
                    margin-top: 15px;
                    padding: 10px;
                    background: #ffebee;
                    border-radius: 5px;
                    border: 1px solid #DC143C;
                }
                .info {
                    margin-top: 20px;
                    padding: 15px;
                    background: #e3f2fd;
                    border-radius: 5px;
                    color: #1976d2;
                    font-size: 14px;
                }
            </style>
        </head>
        <body>
            <div class="login-container">
                <div class="logo">☕</div>
                <div class="title">Coffee Price Tracker</div>
                ${error ? `<div class="error">${error}</div>` : ''}
                <form method="POST" action="/login">
                    <div class="form-group">
                        <label for="username">Username:</label>
                        <input type="text" id="username" name="username" required>
                    </div>
                    <div class="form-group">
                        <label for="password">Password:</label>
                        <input type="password" id="password" name="password" required>
                    </div>
                    <button type="submit" class="login-btn">🔐 Login</button>
                </form>
        
            </div>
        </body>
        </html>
    `;
}

// Hàm tạo nội dung email
function generateEmailReport() {
    const now = new Date();
    const duration = Math.floor((now - reportData.startTime) / 1000 / 60);
    
    let html = `
    <h2>☕ Coffee Robusta Price Report</h2>
    <p><strong>Symbol:</strong> ${reportData.symbol || 'N/A'}</p>
    <p><strong>Report Time:</strong> ${now.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>
    <p><strong>Monitoring Duration:</strong> ${duration} minutes</p>
    
    <h3>📊 Current Market Data</h3>
    <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse;">
        <tr><td><strong>Current Price</strong></td><td>$${reportData.currentPrice?.toFixed(2) || 'N/A'}</td></tr>
        <tr><td><strong>High</strong></td><td>$${reportData.highPrice?.toFixed(2) || 'N/A'}</td></tr>
        <tr><td><strong>Low</strong></td><td>$${reportData.lowPrice?.toFixed(2) || 'N/A'}</td></tr>
    </table>
    `;
      // Thêm chart SVG hàng ngày nếu có dữ liệu
    if (reportData.updates.length > 1) {
        html += generateSimpleChart();
    }
    
    // Thêm biểu đồ xu hướng tháng nếu có dữ liệu
    const monthlyTrend = getMonthlyTrendData();
    if (monthlyTrend.length > 0) {
        html += generateMonthlyTrendChart();
    }
    
    html += `
    <h3>📈 Recent Updates</h3>
    <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse;">
        <tr>
            <th>Time</th>
            <th>Price</th>
            <th>Change</th>
            <th>Change %</th>
        </tr>
    `;
    
    const recentUpdates = reportData.updates.slice(-10);
    recentUpdates.forEach(update => {
        const changeColor = update.change >= 0 ? 'green' : 'red';
        html += `
        <tr>
            <td>${update.timestamp}</td>
            <td>$${update.price.toFixed(2)}</td>
            <td style="color: ${changeColor}">$${update.change.toFixed(2)}</td>
            <td style="color: ${changeColor}">${update.changePercent}%</td>
        </tr>
        `;
    });
    
    html += `
    </table>
    <p><em>Generated by Coffee Trading Bot - ${new Date().toISOString()}</em></p>
    `;
    
    return html;
}

// Hàm gửi email báo cáo
async function sendEmailReport() {
    try {
        console.log('📧 Attempting to send email report...');
        console.log(`📧 Email config - From: ${emailConfig.from}, To: ${emailConfig.to}`);
        
        const mailOptions = {
            from: emailConfig.from,
            to: emailConfig.to,
            subject: `☕ Coffee Robusta Price Report - ${new Date().toLocaleDateString('vi-VN')}`,
            html: generateEmailReport()
        };
        
        // Test transporter connection
        await transporter.verify();
        console.log('✅ SMTP connection verified successfully');
        
        const info = await transporter.sendMail(mailOptions);
        console.log('📧 Email report sent successfully:', info.messageId);
        console.log('📧 Response:', info.response);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Failed to send email:', error.message);
        console.error('❌ Full error:', error);
        return { success: false, error: error.message };
    }
}

// Hàm gửi cảnh báo giá
async function sendPriceAlert(price, type) {
    try {
        const subject = type === 'high' ? 
            `🚨 HIGH PRICE ALERT - Coffee Robusta: $${price.toFixed(2)}` :
            `⚠️ LOW PRICE ALERT - Coffee Robusta: $${price.toFixed(2)}`;
            
        const html = `
        <h2>${type === 'high' ? '🚨' : '⚠️'} Price Alert</h2>
        <p><strong>Symbol:</strong> ${reportData.symbol}</p>
        <p><strong>Current Price:</strong> $${price.toFixed(2)}</p>
        <p><strong>Alert Type:</strong> ${type.toUpperCase()} PRICE</p>
        <p><strong>Threshold:</strong> $${emailConfig.priceAlerts.thresholds[type]}</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>
        `;
        
        const mailOptions = {
            from: emailConfig.from,
            to: emailConfig.to,
            subject: subject,
            html: html
        };
        
        const info = await transporter.sendMail(mailOptions);
        console.log(`📧 Price alert sent: ${type.toUpperCase()} - $${price.toFixed(2)}`);
    } catch (error) {
        console.error('❌ Failed to send price alert:', error.message);
    }
}

// Hàm test email manual
async function testEmailReport(req, res) {
    try {
        console.log('🧪 Testing email functionality...');
        
        // Kiểm tra cấu hình email
        if (!emailConfig.from || !emailConfig.to) {
            const error = 'Email configuration missing - check EMAIL_FROM and EMAIL_TO in .env';
            console.error('❌', error);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: false, 
                error: error,
                config: {
                    from: emailConfig.from || 'NOT SET',
                    to: emailConfig.to || 'NOT SET',
                    user: emailConfig.auth.user || 'NOT SET'
                }
            }));
            return;
        }
        
        // Tạo dữ liệu mẫu nếu chưa có dữ liệu tháng thực
        if (Object.keys(reportData.monthlyData).length === 0) {
            console.log('📊 Creating sample monthly data for testing...');
            createSampleMonthlyData();
        }
        
        // Gửi email test
        const result = await sendEmailReport();
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: result.success,
            message: result.success ? 'Test email sent successfully!' : 'Failed to send test email',
            messageId: result.messageId || null,
            error: result.error || null,
            timestamp: new Date().toISOString(),
            monthlyDataCount: Object.keys(reportData.monthlyData).length,
            emailConfig: {
                from: emailConfig.from,
                to: emailConfig.to,
                service: emailConfig.service
            }
        }, null, 2));
        
    } catch (error) {
        console.error('❌ Test email error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            success: false, 
            error: error.message,
            timestamp: new Date().toISOString()
        }));
    }
}

// Hàm tạo dữ liệu tháng mẫu để test
function createSampleMonthlyData() {
    const currentDate = new Date();
    const basePrice = 4500; // Giá cơ sở cho coffee
    
    // Tạo dữ liệu cho 6 tháng gần đây
    for (let i = 5; i >= 0; i--) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        // Tạo biến động giá ngẫu nhiên
        const priceVariation = (Math.random() - 0.5) * 400; // ±200
        const open = basePrice + priceVariation;
        const close = open + (Math.random() - 0.5) * 200; // ±100
        const high = Math.max(open, close) + Math.random() * 100;
        const low = Math.min(open, close) - Math.random() * 100;
        
        reportData.monthlyData[monthKey] = {
            open: Math.round(open),
            high: Math.round(high),
            low: Math.round(low),
            close: Math.round(close),
            volume: Math.floor(Math.random() * 100) + 50, // 50-150 updates
            lastUpdate: date,
            dailyPrices: []
        };
    }
    
    console.log(`✅ Created sample monthly data for ${Object.keys(reportData.monthlyData).length} months:`, 
                Object.keys(reportData.monthlyData).sort());
}

// Hàm test dữ liệu tháng
async function handleMonthlyDataTest(req, res) {
    try {
        if (!reportData.symbol) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: 'No symbol connected yet',
                message: 'Wait for TradingView connection first',
                timestamp: new Date().toISOString()
            }));
            return;
        }

        console.log('🧪 Testing monthly data fetch...');
        const monthlyData = await fetchMonthlyHistoricalData(reportData.symbol);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            message: 'Monthly data fetched successfully',
            symbol: reportData.symbol,
            monthlyData: monthlyData,
            count: Object.keys(monthlyData).length,
            timestamp: new Date().toISOString()
        }, null, 2));
        
    } catch (error) {
        console.error('❌ Monthly data test error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: error.message,
            symbol: reportData.symbol || 'N/A',
            message: 'Failed to fetch monthly data',
            timestamp: new Date().toISOString()
        }));
    }
}

// Hàm test SMTP connection
async function testSMTPConnection(req, res) {
    try {
        console.log('🧪 Testing SMTP connection...');
        
        await transporter.verify();
        console.log('✅ SMTP connection successful');
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            message: 'SMTP connection verified successfully',
            config: {
                service: emailConfig.service,
                user: emailConfig.auth.user,
                from: emailConfig.from,
                to: emailConfig.to
            },
            timestamp: new Date().toISOString()
        }, null, 2));
        
    } catch (error) {
        console.error('❌ SMTP connection failed:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: error.message,
            message: 'SMTP connection failed',
            config: {
                service: emailConfig.service,
                user: emailConfig.auth.user || 'NOT SET',
                from: emailConfig.from || 'NOT SET',
                to: emailConfig.to || 'NOT SET'
            },
            timestamp: new Date().toISOString()        }));
    }
}

// Hàm cập nhật dữ liệu tháng
function updateMonthlyData(price) {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    if (!reportData.monthlyData[monthKey]) {
        reportData.monthlyData[monthKey] = {
            open: price,
            high: price,
            low: price,
            close: price,
            volume: 1,
            lastUpdate: now,
            dailyPrices: []
        };
    } else {
        reportData.monthlyData[monthKey].high = Math.max(reportData.monthlyData[monthKey].high, price);
        reportData.monthlyData[monthKey].low = Math.min(reportData.monthlyData[monthKey].low, price);
        reportData.monthlyData[monthKey].close = price;
        reportData.monthlyData[monthKey].volume += 1;
        reportData.monthlyData[monthKey].lastUpdate = now;
    }
    
    // Lưu giá hàng ngày để tính toán sau này
    const today = now.toISOString().split('T')[0];
    if (!reportData.monthlyData[monthKey].dailyPrices) {
        reportData.monthlyData[monthKey].dailyPrices = [];
    }
    
    const existingDay = reportData.monthlyData[monthKey].dailyPrices.find(d => d.date === today);
    if (existingDay) {
        existingDay.price = price;
        existingDay.time = now;
    } else {
        reportData.monthlyData[monthKey].dailyPrices.push({
            date: today,
            price: price,
            time: now
        });
    }
    
    // Giữ chỉ 12 tháng gần nhất
    const monthKeys = Object.keys(reportData.monthlyData).sort();
    if (monthKeys.length > 12) {
        const oldestMonth = monthKeys[0];
        delete reportData.monthlyData[oldestMonth];
    }
}

function getMonthlyTrendData() {
    const monthKeys = Object.keys(reportData.monthlyData).sort();
    return monthKeys.map(monthKey => {
        const data = reportData.monthlyData[monthKey];
        return {
            month: monthKey,
            open: data.open,
            high: data.high,
            low: data.low,
            close: data.close,
            volume: data.volume,
            change: data.close - data.open,
            changePercent: ((data.close - data.open) / data.open * 100).toFixed(2)
        };
    });
}

// Hàm lấy thời gian báo cáo tiếp theo
function getNextReportTime() {
    const now = new Date();
    const reportHour = emailConfig.dailyReportTime || 8;
    const nextReportTime = new Date();
    nextReportTime.setHours(reportHour, 0, 0, 0);
    
    if (now >= nextReportTime) {
        nextReportTime.setDate(nextReportTime.getDate() + 1);
    }
    
    return nextReportTime.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

// Hàm tạo báo cáo web
function generateWebReport() {
    const now = new Date();
    const duration = Math.floor((now - reportData.startTime) / 1000 / 60);
      // Chuẩn bị dữ liệu cho chart
    const chartData = reportData.updates.slice(-50); // Lấy 50 điểm gần nhất
    const labels = chartData.map(update => {
        // Lấy giờ:phút từ timestamp
        const timeParts = update.timestamp.split(' ');
        return timeParts[1] || timeParts[0]; // Lấy phần thời gian hoặc toàn bộ nếu không có space
    });
    const prices = chartData.map(update => update.price);
    
    let html = `
        <h1>☕ Coffee Robusta Price Tracker</h1>
        <div class="status">
            <p><strong>🟢 Service Status:</strong> Running</p>
            <p><strong>📊 Symbol:</strong> ${reportData.symbol || 'Connecting...'}</p>
            <p><strong>⏱️ Uptime:</strong> ${duration} minutes</p>
            <p><strong>🔄 Last Update:</strong> ${reportData.updates.length > 0 ? reportData.updates[reportData.updates.length - 1].timestamp : 'No updates yet'}</p>
            ${reportData.currentPrice ? `<p><strong>💰 Current Price:</strong> <span class="price">$${reportData.currentPrice.toFixed(2)}</span></p>` : ''}
        </div>
    `;
      // Thêm chart nếu có dữ liệu
    if (chartData.length > 1) {
        html += `
            <h3>📈 Daily Price Chart</h3>
            <div style="width: 100%; height: 400px; margin-bottom: 20px;">
                <canvas id="priceChart"></canvas>
            </div>
            <script>
                const ctx = document.getElementById('priceChart').getContext('2d');
                const chart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: ${JSON.stringify(labels)},
                        datasets: [{
                            label: 'Coffee Price ($)',
                            data: ${JSON.stringify(prices)},
                            borderColor: '#2E8B57',
                            backgroundColor: 'rgba(46, 139, 87, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: {
                                beginAtZero: false,
                                title: {
                                    display: true,
                                    text: 'Price ($)'
                                }
                            },
                            x: {
                                title: {
                                    display: true,
                                    text: 'Time'
                                }
                            }
                        },
                        plugins: {
                            legend: {
                                display: true,
                                position: 'top'
                            },
                            title: {
                                display: true,
                                text: 'Coffee Robusta Daily Price Movement'
                            }
                        }
                    }
                });
            </script>
        `;
    }
    
    // Thêm biểu đồ xu hướng tháng nếu có dữ liệu
    const monthlyTrend = getMonthlyTrendData();
    if (monthlyTrend.length > 0) {
        const monthLabels = monthlyTrend.map(m => m.month);
        const monthlyPrices = monthlyTrend.map(m => m.close);
        const monthlyVolumes = monthlyTrend.map(m => m.volume);
        
        html += `
            <h3>📊 Monthly Price Trend</h3>
            <div style="width: 100%; height: 400px; margin-bottom: 20px;">
                <canvas id="monthlyChart"></canvas>
            </div>
            <script>
                const monthCtx = document.getElementById('monthlyChart').getContext('2d');
                const monthChart = new Chart(monthCtx, {
                    type: 'bar',
                    data: {
                        labels: ${JSON.stringify(monthLabels)},
                        datasets: [{
                            label: 'Monthly Close Price ($)',
                            data: ${JSON.stringify(monthlyPrices)},
                            backgroundColor: 'rgba(46, 139, 87, 0.6)',
                            borderColor: '#2E8B57',
                            borderWidth: 1,
                            yAxisID: 'y'
                        }, {
                            label: 'Daily Updates Count',
                            data: ${JSON.stringify(monthlyVolumes)},
                            type: 'line',
                            borderColor: '#FF6B35',
                            backgroundColor: 'rgba(255, 107, 53, 0.1)',
                            borderWidth: 2,
                            fill: false,
                            yAxisID: 'y1',
                            tension: 0.1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                            mode: 'index',
                            intersect: false,
                        },
                        scales: {
                            x: {
                                title: {
                                    display: true,
                                    text: 'Month'
                                }
                            },
                            y: {
                                type: 'linear',
                                display: true,
                                position: 'left',
                                title: {
                                    display: true,
                                    text: 'Price ($)'
                                }
                            },
                            y1: {
                                type: 'linear',
                                display: true,
                                position: 'right',
                                title: {
                                    display: true,
                                    text: 'Updates Count'
                                },
                                grid: {
                                    drawOnChartArea: false,
                                },
                            }
                        },
                        plugins: {
                            legend: {
                                display: true,
                                position: 'top'
                            },
                            title: {
                                display: true,
                                text: 'Monthly Coffee Price Trend & Data Activity'
                            }
                        }
                    }
                });
            </script>
            
            <h4>📈 Monthly Summary</h4>
            <table>
                <tr>
                    <th>Month</th>
                    <th>Open</th>
                    <th>High</th>
                    <th>Low</th>
                    <th>Close</th>
                    <th>Change</th>
                    <th>Change %</th>
                    <th>Updates</th>
                </tr>
        `;
        
        monthlyTrend.slice(-6).reverse().forEach(month => {
            const changeClass = month.change >= 0 ? 'positive' : 'negative';
            html += `
                <tr>
                    <td><strong>${month.month}</strong></td>
                    <td>$${month.open.toFixed(2)}</td>
                    <td>$${month.high.toFixed(2)}</td>
                    <td>$${month.low.toFixed(2)}</td>
                    <td>$${month.close.toFixed(2)}</td>
                    <td class="${changeClass}">$${month.change.toFixed(2)}</td>
                    <td class="${changeClass}">${month.changePercent}%</td>
                    <td>${month.volume}</td>
                </tr>
            `;
        });
        
        html += '</table>';
    }
    
    if (reportData.currentPrice) {
        html += `
            <h3>📊 Current Market Data</h3>
            <table>
                <tr><td><strong>Current Price</strong></td><td class="price">$${reportData.currentPrice.toFixed(2)}</td></tr>
                <tr><td><strong>High</strong></td><td>$${reportData.highPrice?.toFixed(2) || 'N/A'}</td></tr>
                <tr><td><strong>Low</strong></td><td>$${reportData.lowPrice?.toFixed(2) || 'N/A'}</td></tr>
                <tr><td><strong>Total Updates</strong></td><td>${reportData.updates.length}</td></tr>
            </table>
        `;
    }
    
    if (reportData.updates.length > 0) {
        html += `
            <h3>📈 Recent Price Updates</h3>
            <table>
                <tr>
                    <th>Time</th>
                    <th>Price</th>
                    <th>Change</th>
                    <th>Change %</th>
                </tr>
        `;
        
        const recentUpdates = reportData.updates.slice(-10);
        recentUpdates.reverse().forEach(update => {
            const changeClass = update.change >= 0 ? 'positive' : 'negative';
            html += `
                <tr>
                    <td>${update.timestamp}</td>
                    <td>$${update.price.toFixed(2)}</td>
                    <td class="${changeClass}">$${update.change.toFixed(2)}</td>
                    <td class="${changeClass}">${update.changePercent}%</td>
                </tr>
            `;
        });
        
        html += '</table>';
    }
    
    html += `
        <div style="margin-top: 30px; padding: 15px; background: #f0f8ff; border-radius: 5px; font-size: 12px; color: #666;">
            <p><em>📅 Report generated: ${now.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</em></p>
            <p><em>🤖 Powered by TradingView API - Coffee Price Tracker</em></p>
            <p><em>📧 Next daily report: ${getNextReportTime()}</em></p>
        </div>
    `;
    
    return html;
}

// Hàm tạo chart đơn giản cho email
function generateSimpleChart() {
    const chartData = reportData.updates.slice(-20); // Lấy 20 điểm gần nhất
    if (chartData.length < 2) return '';
    
    const prices = chartData.map(update => update.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice;
    
    // Tạo SVG chart đơn giản
    const width = 600;
    const height = 200;
    const padding = 40;
    
    let svgPath = '';
    chartData.forEach((update, index) => {
        const x = padding + (index * (width - 2 * padding)) / (chartData.length - 1);
        const y = height - padding - ((update.price - minPrice) / range) * (height - 2 * padding);
        
        if (index === 0) {
            svgPath += `M ${x} ${y}`;
        } else {
            svgPath += ` L ${x} ${y}`;
        }
    });
    
    return `
        <h3>📈 Price Chart (Last 20 Updates)</h3>
        <svg width="600" height="200" style="border: 1px solid #ccc; margin: 10px 0;">
            <defs>
                <linearGradient id="priceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#2E8B57;stop-opacity:0.3" />
                    <stop offset="100%" style="stop-color:#2E8B57;stop-opacity:0.1" />
                </linearGradient>
            </defs>
            <path d="${svgPath} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z" 
                  fill="url(#priceGradient)" stroke="none"/>
            <path d="${svgPath}" fill="none" stroke="#2E8B57" stroke-width="2"/>
            <text x="10" y="20" font-family="Arial" font-size="12" fill="#666">
                High: $${maxPrice.toFixed(2)}
            </text>
            <text x="10" y="35" font-family="Arial" font-size="12" fill="#666">
                Low: $${minPrice.toFixed(2)}
            </text>
            <text x="10" y="${height - 10}" font-family="Arial" font-size="12" fill="#666">
                Current: $${chartData[chartData.length - 1].price.toFixed(2)}
            </text>
        </svg>
    `;
}

// Hàm tạo biểu đồ xu hướng tháng cho email
function generateMonthlyTrendChart() {
    const monthlyTrend = getMonthlyTrendData();
    if (monthlyTrend.length < 2) return '';
    
    const prices = monthlyTrend.map(m => m.close);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice;
    
    // Tạo SVG chart đơn giản cho xu hướng tháng
    const width = 600;
    const height = 250;
    const padding = 50;
    
    let svgPath = '';
    let bars = '';
    
    monthlyTrend.forEach((month, index) => {
        const x = padding + (index * (width - 2 * padding)) / (monthlyTrend.length - 1);
        const y = height - padding - ((month.close - minPrice) / range) * (height - 2 * padding);
        
        // Tạo đường line chart
        if (index === 0) {
            svgPath += `M ${x} ${y}`;
        } else {
            svgPath += ` L ${x} ${y}`;
        }
        
        // Tạo bar chart
        const barWidth = (width - 2 * padding) / monthlyTrend.length * 0.6;
        const barHeight = ((month.close - minPrice) / range) * (height - 2 * padding);
        const barX = x - barWidth / 2;
        const barY = height - padding - barHeight;
        
        const changeColor = month.change >= 0 ? '#2E8B57' : '#DC143C';
        
        bars += `
            <rect x="${barX}" y="${barY}" width="${barWidth}" height="${barHeight}" 
                  fill="${changeColor}" fill-opacity="0.7" stroke="${changeColor}" stroke-width="1"/>
            <text x="${x}" y="${height - padding + 15}" text-anchor="middle" font-family="Arial" font-size="10" fill="#666">
                ${month.month.split('-')[1]}/${month.month.split('-')[0].slice(-2)}
            </text>
            <text x="${x}" y="${y - 5}" text-anchor="middle" font-family="Arial" font-size="10" fill="#333">
                $${month.close.toFixed(1)}
            </text>
        `;
    });
    
    return `
        <h3>📊 Monthly Price Trend (Last ${monthlyTrend.length} Months)</h3>
        <svg width="600" height="250" style="border: 1px solid #ccc; margin: 10px 0;">
            <defs>
                <linearGradient id="monthlyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#2E8B57;stop-opacity:0.2" />
                    <stop offset="100%" style="stop-color:#2E8B57;stop-opacity:0.05" />
                </linearGradient>
            </defs>
            
            <!-- Grid lines -->
            <defs>
                <pattern id="grid" width="50" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 50 0 L 0 0 0 40" fill="none" stroke="#e0e0e0" stroke-width="0.5"/>
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" opacity="0.3" />
            
            <!-- Bars -->
            ${bars}
            
            <!-- Line chart -->
            <path d="${svgPath}" fill="none" stroke="#2E8B57" stroke-width="3"/>
            
            <!-- Data points -->
            ${monthlyTrend.map((month, index) => {
                const x = padding + (index * (width - 2 * padding)) / (monthlyTrend.length - 1);
                const y = height - padding - ((month.close - minPrice) / range) * (height - 2 * padding);
                return `<circle cx="${x}" cy="${y}" r="4" fill="#2E8B57" stroke="white" stroke-width="2"/>`;
            }).join('')}
            
            <!-- Labels and info -->
            <text x="10" y="20" font-family="Arial" font-size="12" fill="#666" font-weight="bold">
                Monthly Coffee Price Trend
            </text>
            <text x="10" y="35" font-family="Arial" font-size="11" fill="#666">
                High: $${maxPrice.toFixed(2)} | Low: $${minPrice.toFixed(2)}
            </text>
            <text x="10" y="50" font-family="Arial" font-size="11" fill="#666">
                Latest: $${prices[prices.length - 1].toFixed(2)} (${monthlyTrend[monthlyTrend.length - 1].month})
            </text>
            
            <!-- Y-axis labels -->
            <text x="25" y="${height - padding + 5}" font-family="Arial" font-size="10" fill="#666">$${minPrice.toFixed(1)}</text>
            <text x="25" y="${padding + 5}" font-family="Arial" font-size="10" fill="#666">$${maxPrice.toFixed(1)}</text>
        </svg>
        
        <h4>📈 Monthly Summary Table</h4>
        <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 12px;">
            <tr style="background-color: #f2f2f2;">
                <th>Month</th>
                <th>Open</th>
                <th>High</th>
                <th>Low</th>
                <th>Close</th>
                <th>Change</th>
                <th>Change %</th>
                <th>Updates</th>
            </tr>
            ${monthlyTrend.slice(-6).map(month => {
                const changeColor = month.change >= 0 ? 'green' : 'red';
                return `
                <tr>
                    <td><strong>${month.month}</strong></td>
                    <td>$${month.open.toFixed(2)}</td>
                    <td>$${month.high.toFixed(2)}</td>
                    <td>$${month.low.toFixed(2)}</td>
                    <td>$${month.close.toFixed(2)}</td>
                    <td style="color: ${changeColor}">$${month.change.toFixed(2)}</td>
                    <td style="color: ${changeColor}">${month.changePercent}%</td>
                    <td>${month.volume}</td>
                </tr>
                `;
            }).join('')}
        </table>
    `;
}

// Hàm lấy dữ liệu lịch sử theo tháng từ TradingView
async function fetchMonthlyHistoricalData(symbol) {
    try {
        console.log(`📊 Fetching monthly historical data for ${symbol}...`);
        
        const monthlyChart = new client.Session.Chart();
        
        return new Promise((resolve, reject) => {
            let monthlyData = {};
            let isResolved = false;
            
            // Thiết lập để lấy dữ liệu tháng
            monthlyChart.setMarket(symbol, {
                timeframe: '1M', // Monthly timeframe
                range: 24,       // Lấy 24 tháng gần nhất
            });
            
            monthlyChart.onSymbolLoaded(() => {
                console.log(`✅ Monthly chart loaded for ${symbol} with 1M timeframe`);
            });
            
            monthlyChart.onUpdate(() => {
                try {
                    const periods = monthlyChart.periods;
                    if (periods && periods.length > 0) {
                        console.log(`📈 Processing ${periods.length} monthly candlestick periods...`);
                        
                        periods.forEach((period, index) => {
                            if (period && period.time) {
                                const date = new Date(period.time * 1000);
                                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                                
                                monthlyData[monthKey] = {
                                    timestamp: period.time,
                                    date: date.toISOString(),
                                    open: period.open || 0,
                                    high: period.max || period.high || 0,
                                    low: period.min || period.low || 0,
                                    close: period.close || 0,
                                    volume: period.volume || 0,
                                    lastUpdate: date,
                                    source: '1M_TradingView', // Đánh dấu nguồn dữ liệu
                                    dailyPrices: []
                                };
                                
                                console.log(`📊 Month ${monthKey}: O:${period.open?.toFixed(2)} H:${period.max?.toFixed(2)} L:${period.min?.toFixed(2)} C:${period.close?.toFixed(2)} V:${period.volume}`);
                            }
                        });
                        
                        // Cập nhật dữ liệu tháng vào reportData
                        reportData.monthlyData = monthlyData;
                        console.log(`✅ Updated monthly OHLCV data: ${Object.keys(monthlyData).length} months`);
                        console.log('📊 Available months:', Object.keys(monthlyData).sort());
                        
                        if (!isResolved) {
                            isResolved = true;
                            resolve(monthlyData);
                        }
                    } else {
                        console.log('⚠️ No monthly periods received from TradingView');
                        if (!isResolved) {
                            isResolved = true;
                            resolve({});
                        }
                    }
                } catch (error) {
                    console.error('❌ Error processing monthly periods:', error);
                    if (!isResolved) {
                        isResolved = true;
                        reject(error);
                    }
                }
            });
            
            monthlyChart.onError((error) => {
                console.error(`❌ Monthly chart error for ${symbol}:`, error);
                if (!isResolved) {
                    isResolved = true;
                    reject(error);
                }
            });
            
            // Timeout sau 15 giây
            setTimeout(() => {
                if (!isResolved) {
                    isResolved = true;
                    console.log('⏰ Monthly data fetch timeout - using available data');
                    resolve(monthlyData);
                }
            }, 15000);
        });
        
    } catch (error) {
        console.error('❌ Error in fetchMonthlyHistoricalData:', error);
        throw error;
    }
}

// Hàm khởi động kết nối TradingView và lấy dữ liệu realtime
async function startRealtimeQuotes() {
    try {
        console.log('🚀 Starting Coffee Robusta RC1 Realtime Quotes...');
        console.log('═══════════════════════════════════════════════════════');
        
        const chart = new client.Session.Chart();
        
        const workingSymbols = [
            'ICEEUR:RC1!',    // Robusta Coffee Continuous Contract - ICE Europe
            'ICEEUR:RCH2025', // Robusta Coffee March 2025
            'ICEEUR:RCK2025', // Robusta Coffee May 2025
            'ICEEUR:RCN2025', // Robusta Coffee July 2025
            'ICEEUR:RCU2025', // Robusta Coffee September 2025
            'ICEEUR:RCX2025', // Robusta Coffee November 2025
            'ICEEUR:RCF2026', // Robusta Coffee January 2026
            'NYSE:JO',        // Coffee ETF (backup)
            'NASDAQ:SBUX',    // Starbucks (backup)
        ];
        
        let currentSymbolIndex = 0;
        let connectedSymbol = null;
        let isConnected = false;
        
        function tryNextSymbol() {
            if (currentSymbolIndex >= workingSymbols.length) {
                console.error('❌ Không thể kết nối với bất kỳ symbol nào');
                return;
            }
            
            const symbol = workingSymbols[currentSymbolIndex];
            console.log(`🔍 Đang thử symbol: ${symbol}`);
              chart.setMarket(symbol, {
                timeframe: '1', // Daily data
                range: 100,
            });
            
            currentSymbolIndex++;
        }
        
        // Bắt đầu với symbol đầu tiên
        tryNextSymbol();
          // Lắng nghe dữ liệu realtime
        chart.onSymbolLoaded(() => {
            connectedSymbol = workingSymbols[currentSymbolIndex-1];
            isConnected = true;
            console.log(`✅ Symbol ${connectedSymbol} loaded successfully`);
            console.log('🎯 Bắt đầu nhận dữ liệu realtime...');
            
            // Lấy dữ liệu lịch sử tháng sau khi kết nối thành công
            fetchMonthlyHistoricalData(connectedSymbol)
                .then(() => {
                    console.log('✅ Monthly historical data loaded successfully');
                })
                .catch((error) => {
                    console.error('❌ Failed to load monthly data:', error.message);
                });
        });

        chart.onUpdate(() => {
            if (!isConnected) return;
            
            const data = chart.periods[0];
            if (data && connectedSymbol) {
                const timestamp = new Date().toLocaleString('vi-VN', {
                    timeZone: 'Asia/Ho_Chi_Minh'
                });
                
                // Tính toán thay đổi giá
                const prevClose = data.open;
                const change = data.close - prevClose;
                const changePercent = ((change / prevClose) * 100).toFixed(2);
                const changeSymbol = change >= 0 ? '📈' : '📉';
                
                console.log(`\n📊 [${timestamp}] Coffee Robusta - ${connectedSymbol}`);
                console.log(`💰 Current Price: $${data.close.toFixed(2)}`);
                console.log(`${changeSymbol} Change: $${change.toFixed(2)} (${changePercent}%)`);
                console.log(`📊 High: $${data.max.toFixed(2)} | Low: $${data.min.toFixed(2)}`);
                console.log(`🔄 Volume: ${data.volume || 'N/A'}`);
                console.log(`🕐 Open: $${data.open.toFixed(2)}`);
                console.log('═'.repeat(60));                // Cập nhật dữ liệu báo cáo
                reportData.updates.push({
                    timestamp,
                    price: data.close,
                    change,
                    changePercent,
                    high: data.max,
                    low: data.min,
                    volume: data.volume || 'N/A',
                    open: data.open
                });
                reportData.currentPrice = data.close;
                reportData.highPrice = data.max;
                reportData.lowPrice = data.min;
                reportData.symbol = connectedSymbol;

                // Cập nhật dữ liệu tháng để hiển thị xu hướng
                updateMonthlyData(data.close);

                // Kiểm tra cảnh báo giá
                if (emailConfig.priceAlerts.enabled) {
                    if (data.close >= emailConfig.priceAlerts.thresholds.high) {
                        sendPriceAlert(data.close, 'high');
                    } else if (data.close <= emailConfig.priceAlerts.thresholds.low) {
                        sendPriceAlert(data.close, 'low');
                    }
                }
            }
        });

        chart.onError((error) => {
            if (isConnected) {
                console.error(`❌ Connection lost for ${connectedSymbol}:`, error);
                console.log('🔄 Đang thử kết nối lại...');
                isConnected = false;
                setTimeout(() => {
                    tryNextSymbol();
                }, 3000);
            } else {
                console.error(`❌ Chart Error for ${workingSymbols[currentSymbolIndex-1]}:`, error);
                console.log('🔄 Thử symbol tiếp theo...');
                setTimeout(() => {
                    tryNextSymbol();
                }, 2000);
            }
        });

        console.log('📡 Waiting for realtime data... (Press Ctrl+C to stop)');
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Hàm kiểm tra và gửi báo cáo hàng ngày
function checkAndSendDailyReport() {
    const now = new Date();
    const today = now.toDateString();
    
    if (reportData.lastEmailSent !== today && reportData.currentPrice) {
        console.log('📧 Sending daily report...');
        sendEmailReport();
        reportData.lastEmailSent = today;
    }
}

// Hàm lên lịch gửi báo cáo hàng ngày
function scheduleDailyReport() {
    const now = new Date();
    const reportHour = emailConfig.dailyReportTime || 8;
    const nextReportTime = new Date();
    nextReportTime.setHours(reportHour, 0, 0, 0);
    
    if (now >= nextReportTime) {
        nextReportTime.setDate(nextReportTime.getDate() + 1);
    }
    
    const timeUntilNextReport = nextReportTime - now;    
    setTimeout(() => {
        checkAndSendDailyReport();
        setInterval(checkAndSendDailyReport, 24 * 60 * 60 * 1000);
    }, timeUntilNextReport);
    
    console.log(`📧 Daily report scheduled for ${reportHour}:00 AM (Next: ${nextReportTime.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })})`);
}

// Tạo HTTP server cho Render
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const method = req.method;
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    try {
        if (parsedUrl.pathname === '/' || parsedUrl.pathname === '/status') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'Coffee Robusta Price Tracker is running',
                service: 'active',
                symbol: reportData.symbol || 'Connecting...',
                currentPrice: reportData.currentPrice || 'N/A',
                lastUpdate: reportData.updates.length > 0 ? reportData.updates[reportData.updates.length - 1].timestamp : 'No updates yet',
                uptime: Math.floor((new Date() - reportData.startTime) / 1000),
                totalUpdates: reportData.updates.length,
                nextReportTime: getNextReportTime(),
                isConnected: !!reportData.symbol,
                timestamp: new Date().toISOString()
            }, null, 2));
        } else if (parsedUrl.pathname === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                status: 'healthy', 
                timestamp: new Date().toISOString(),
                uptime: Math.floor((new Date() - reportData.startTime) / 1000)
            }));
        } else if (parsedUrl.pathname === '/test-email') {
            // Test gửi email
            testEmailReport(req, res);
            return;        } else if (parsedUrl.pathname === '/test-smtp') {
            // Test kết nối SMTP
            testSMTPConnection(req, res);
            return;
        } else if (parsedUrl.pathname === '/login') {
            if (method === 'GET') {
                // Hiển thị trang login
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(generateLoginPage());
            } else if (method === 'POST') {
                // Xử lý login
                let body = '';
                req.on('data', chunk => {
                    body += chunk.toString();
                });
                req.on('end', () => {
                    const params = new URLSearchParams(body);
                    const username = params.get('username');
                    const password = params.get('password');
                    
                    if (username === emailConfig.login.username && password === emailConfig.login.password) {
                        // Đăng nhập thành công
                        const sessionId = generateSessionId();
                        activeSessions.set(sessionId, {
                            username: username,
                            expires: Date.now() + emailConfig.login.sessionTimeout
                        });
                        
                        res.writeHead(302, {
                            'Location': '/report',
                            'Set-Cookie': `sessionId=${sessionId}; Path=/; HttpOnly; Max-Age=${emailConfig.login.sessionTimeout / 1000}`
                        });
                        res.end();
                        console.log(`✅ User ${username} logged in successfully`);
                    } else {
                        // Đăng nhập thất bại
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(generateLoginPage('Invalid username or password!'));
                        console.log(`❌ Failed login attempt: ${username}`);
                    }
                });
            }
            return;
        } else if (parsedUrl.pathname === '/logout') {
            // Đăng xuất
            const sessionId = getSessionFromCookie(req.headers.cookie);
            if (sessionId) {
                activeSessions.delete(sessionId);
            }
            res.writeHead(302, {
                'Location': '/login',
                'Set-Cookie': 'sessionId=; Path=/; HttpOnly; Max-Age=0'
            });
            res.end();
            return;        } else if (parsedUrl.pathname === '/report') {
            // Kiểm tra đăng nhập trước khi hiển thị report
            const sessionId = getSessionFromCookie(req.headers.cookie);
            
            if (!emailConfig.login.enabled || isValidSession(sessionId)) {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Coffee Price Report</title>
                        <meta charset="utf-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1">
                        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
                        <style>
                            body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
                            .container { max-width: 1000px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #2E8B57; }
                            .header h1 { margin: 0; color: #2E8B57; }
                            .user-section { display: flex; align-items: center; gap: 10px; }
                            .user-info { background: #e8f5e8; padding: 8px 12px; border-radius: 5px; font-size: 14px; color: #2E8B57; }
                            .logout-btn { background: #DC143C; color: white; padding: 8px 16px; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; }
                            .logout-btn:hover { background: #B91C3C; }
                            .status { background: #e8f5e8; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
                            .price { font-size: 24px; color: #2E8B57; font-weight: bold; }
                            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
                            th { background-color: #f2f2f2; }
                            .positive { color: #2E8B57; }
                            .negative { color: #DC143C; }
                            .refresh-btn, .test-btn { background: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 5px; }
                            .test-btn { background: #2196F3; }
                            .refresh-btn:hover { background: #45a049; }
                            .test-btn:hover { background: #0b7dda; }
                            #priceChart { width: 100% !important; height: 400px !important; }
                            .test-section { background: #f0f8ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
                            .test-result { margin-top: 10px; padding: 10px; border-radius: 5px; font-family: monospace; white-space: pre-wrap; }
                            .test-success { background: #d4edda; color: #155724; }
                            .test-error { background: #f8d7da; color: #721c24; }
                            .login-status { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 10px; border-radius: 5px; margin-bottom: 15px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1>☕ Coffee Price Tracker</h1>
                                ${emailConfig.login.enabled ? `
                                <div class="user-section">
                                    <div class="user-info">
                                        👤 Logged in as: ${emailConfig.login.username}
                                    </div>
                                    <button class="logout-btn" onclick="logout()">🚪 Logout</button>
                                </div>
                                ` : ''}
                            </div>
                            
                            ${emailConfig.login.enabled ? `
                            <div class="login-status">
                                🔐 <strong>Secure Access:</strong> You are logged in with session authentication. 
                                Your session will expire automatically after 24 hours of inactivity.
                            </div>
                            ` : ''}
                            
                            ${generateWebReport().replace('<h1>☕ Coffee Robusta Price Tracker</h1>', '')}
                            
                            <div class="test-section">
                                <h3>📧 Email Testing</h3>
                                <p>Test email functionality before waiting for scheduled reports:</p>
                                <button class="test-btn" onclick="testSMTP()">🔧 Test SMTP Connection</button>
                                <button class="test-btn" onclick="testEmail()">📧 Send Test Email</button>
                                <button class="test-btn" onclick="testMonthlyData()">📊 Test Monthly Data</button>
                                <div id="testResult" class="test-result" style="display: none;"></div>
                            </div>
                            
                            <div style="text-align: center; margin-top: 30px;">
                                <button class="refresh-btn" onclick="location.reload()">🔄 Refresh Report</button>
                            </div>
                        </div>                        
                        <script>
                            // Logout function
                            function logout() {
                                if (confirm('Are you sure you want to logout?')) {
                                    window.location.href = '/logout';
                                }
                            }
                            
                            async function testSMTP() {
                                const resultDiv = document.getElementById('testResult');
                                resultDiv.style.display = 'block';
                                resultDiv.textContent = 'Testing SMTP connection...';
                                resultDiv.className = 'test-result';
                                
                                try {
                                    const response = await fetch('/test-smtp');
                                    const data = await response.json();
                                    
                                    if (data.success) {
                                        resultDiv.className = 'test-result test-success';
                                        resultDiv.textContent = '✅ SMTP Connection: ' + data.message + '\\n\\nConfig: ' + JSON.stringify(data.config, null, 2);
                                    } else {
                                        resultDiv.className = 'test-result test-error';
                                        resultDiv.textContent = '❌ SMTP Connection Failed: ' + data.error + '\\n\\nConfig: ' + JSON.stringify(data.config, null, 2);
                                    }
                                } catch (error) {
                                    resultDiv.className = 'test-result test-error';
                                    resultDiv.textContent = '❌ Network Error: ' + error.message;
                                }
                            }
                            
                            async function testEmail() {
                                const resultDiv = document.getElementById('testResult');
                                resultDiv.style.display = 'block';
                                resultDiv.textContent = 'Sending test email...';
                                resultDiv.className = 'test-result';
                                
                                try {
                                    const response = await fetch('/test-email');
                                    const data = await response.json();
                                    
                                    if (data.success) {
                                        resultDiv.className = 'test-result test-success';
                                        resultDiv.textContent = '✅ Email Sent Successfully!\\n\\nMessage ID: ' + data.messageId + '\\n\\nFrom: ' + data.emailConfig.from + '\\nTo: ' + data.emailConfig.to + '\\n\\nCheck your email inbox (and spam folder)!';
                                    } else {
                                        resultDiv.className = 'test-result test-error';
                                        resultDiv.textContent = '❌ Email Failed: ' + data.error + '\\n\\nConfig: ' + JSON.stringify(data.emailConfig, null, 2);
                                    }
                                } catch (error) {
                                    resultDiv.className = 'test-result test-error';
                                    resultDiv.textContent = '❌ Network Error: ' + error.message;
                                }
                            }
                            
                            async function testMonthlyData() {
                                const resultDiv = document.getElementById('testResult');
                                resultDiv.style.display = 'block';
                                resultDiv.textContent = 'Fetching monthly data from TradingView...';
                                resultDiv.className = 'test-result';
                                
                                try {
                                    const response = await fetch('/test-monthly-data');
                                    const data = await response.json();
                                    
                                    if (data.success) {
                                        const months = Object.keys(data.monthlyData).sort();
                                        resultDiv.className = 'test-result test-success';
                                        resultDiv.textContent = '✅ Monthly Data Fetched Successfully!\\n\\n' +
                                            'Symbol: ' + data.symbol + '\\n' +
                                            'Months fetched: ' + data.count + '\\n' +
                                            'Available months: ' + months.join(', ') + '\\n\\n' +
                                            'Sample data:\\n' + JSON.stringify(data.monthlyData[months[months.length-1]], null, 2);
                                    } else {
                                        resultDiv.className = 'test-result test-error';
                                        resultDiv.textContent = '❌ Monthly Data Fetch Failed: ' + data.error + '\\n\\nMessage: ' + data.message;
                                    }
                                } catch (error) {
                                    resultDiv.className = 'test-result test-error';
                                    resultDiv.textContent = '❌ Network Error: ' + error.message;
                                }
                            }                        </script>
                    </body>
                    </html>
                `);
            } else {
                // Chuyển hướng đến trang login nếu chưa đăng nhập
                res.writeHead(302, { 'Location': '/login' });
                res.end();
            }
        } else if (parsedUrl.pathname === '/api/price') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                symbol: reportData.symbol,
                price: reportData.currentPrice,
                high: reportData.highPrice,
                low: reportData.lowPrice,
                lastUpdate: reportData.updates.length > 0 ? reportData.updates[reportData.updates.length - 1] : null,
                timestamp: new Date().toISOString()
            }));        } else if (parsedUrl.pathname === '/api/history') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            const recentUpdates = reportData.updates.slice(-50);
            res.end(JSON.stringify({
                updates: recentUpdates,
                count: recentUpdates.length,
                timestamp: new Date().toISOString()
            }));        } else if (parsedUrl.pathname === '/api/monthly-trend') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            const monthlyTrend = getMonthlyTrendData();
            res.end(JSON.stringify({
                monthlyTrend: monthlyTrend,
                count: monthlyTrend.length,
                timestamp: new Date().toISOString()
            }));
        } else if (parsedUrl.pathname === '/api/login-status') {
            // API để kiểm tra trạng thái login system
            const sessionId = getSessionFromCookie(req.headers.cookie);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                loginEnabled: emailConfig.login.enabled,
                isLoggedIn: emailConfig.login.enabled ? isValidSession(sessionId) : null,
                activeSessions: emailConfig.login.enabled ? activeSessions.size : 0,
                sessionTimeout: emailConfig.login.sessionTimeout,
                timestamp: new Date().toISOString()
            }));
        } else if (parsedUrl.pathname === '/api/sessions' && method === 'DELETE') {
            // API để xóa tất cả sessions (admin only)
            const sessionId = getSessionFromCookie(req.headers.cookie);
            if (!emailConfig.login.enabled || isValidSession(sessionId)) {
                activeSessions.clear();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'All sessions cleared',
                    timestamp: new Date().toISOString()
                }));
                console.log('🧹 All login sessions cleared by admin');
            } else {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Unauthorized' }));
            }} else if (parsedUrl.pathname === '/test-monthly-data') {
            // Test lấy dữ liệu tháng từ TradingView
            handleMonthlyDataTest(req, res);
            return;
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });            res.end(JSON.stringify({ 
                error: 'Not found',
                availableEndpoints: [
                    'GET / - Status overview',
                    'GET /health - Health check',
                    'GET /login - Login page (if enabled)',
                    'POST /login - Authenticate user',
                    'GET /logout - Logout user',
                    'GET /report - HTML report with login protection',
                    'GET /test-smtp - Test SMTP connection',
                    'GET /test-email - Send test email',
                    'GET /test-monthly-data - Test monthly data fetch from TradingView',
                    'GET /api/price - Current price data',
                    'GET /api/history - Price history',
                    'GET /api/monthly-trend - Monthly price trend data',
                    'GET /api/login-status - Login system status',
                    'DELETE /api/sessions - Clear all sessions (admin only)'
                ]
            }));
        }
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error', message: error.message }));
    }
});

// Graceful shutdown handlers
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    server.close(() => {
        client.end();
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\n🛑 SIGINT received, shutting down gracefully');
    server.close(() => {
        client.end();
        process.exit(0);
    });
});

// Khởi động application
console.log('🚀 Initializing Coffee Robusta Price Tracker...');
console.log('═'.repeat(50));

// Khởi động HTTP server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 HTTP Server running on port ${PORT}`);
    console.log(`📊 Status endpoint: http://localhost:${PORT}/`);
    console.log(`❤️ Health check: http://localhost:${PORT}/health`);
    console.log(`📧 Report view: http://localhost:${PORT}/report`);
    console.log(`📈 Price API: http://localhost:${PORT}/api/price`);
    console.log('═'.repeat(50));
});

// Khởi tạo kết nối TradingView
client.onConnected(() => {
    console.log('🔗 Connected to TradingView');
    startRealtimeQuotes();
    scheduleDailyReport();
});

client.onDisconnected(() => {
    console.log('🔌 Disconnected from TradingView');
});

client.onError((error) => {
    console.error('❌ TradingView Connection Error:', error);
});

// Bắt đầu kết nối
console.log('🔌 Connecting to TradingView...');