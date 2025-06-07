# Coffee Robusta Price Tracker - Render Deployment

## 🚀 Live Application

This Coffee Robusta price tracking application is now deployed on Render with HTTP endpoints for monitoring.

### 📊 Available Endpoints

- **`/`** or **`/status`** - JSON status overview
- **`/health`** - Health check endpoint  
- **`/report`** - HTML price report dashboard
- **`/api/price`** - Current price data (JSON)
- **`/api/history`** - Price history (JSON)

### 🔧 Environment Variables (Render)

Set these in your Render dashboard:

```bash
EMAIL_USER=nguyenanhquoc2124@gmail.com
EMAIL_PASS=wftezoghzqekmygs
EMAIL_FROM=nguyenanhquoc2124@gmail.com
EMAIL_TO=nguyenanhquoc2123@gmail.com
PORT=3000  # Render will set this automatically
```

### 📈 Features

✅ **HTTP Server for Render compatibility**  
✅ **Real-time Coffee Robusta (RC1!) price monitoring**  
✅ **Daily email reports at 8:00 AM Vietnam time**  
✅ **Price alerts for high/low thresholds**  
✅ **Web dashboard for live monitoring**  
✅ **JSON API endpoints**  
✅ **Graceful shutdown handling**  
✅ **Health checks**  

### 🛠️ Deployment Steps

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Add HTTP server for Render deployment"
   git push origin main
   ```

2. **Deploy on Render**
   - Connect GitHub repository
   - Choose "Web Service"
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Add environment variables
   - Deploy

3. **Monitor Application**
   - Access your-app.onrender.com/report for dashboard
   - Check your-app.onrender.com/health for status
   - Receive daily email reports

### 📧 Email Configuration

The app uses Gmail SMTP with app password authentication:
- Daily reports sent at 8:00 AM Vietnam time
- Price alerts when crossing $6000 (high) or $4000 (low) thresholds
- HTML formatted emails with price data and charts

### 🔍 Monitoring Symbols

Primary symbols attempted in order:
1. `ICEEUR:RC1!` - Robusta Coffee Continuous Contract
2. `ICEEUR:RCH2025` - March 2025 contract
3. `ICEEUR:RCK2025` - May 2025 contract
4. `ICEEUR:RCN2025` - July 2025 contract
5. `NYSE:JO` - Coffee ETF (backup)
6. `NASDAQ:SBUX` - Starbucks (backup)

### 📱 Web Dashboard

The `/report` endpoint provides a beautiful HTML dashboard showing:
- Current price and market data
- Recent price history
- Service status and uptime
- Auto-refresh functionality

### 🚨 Troubleshooting

- **Port binding:** App binds to `0.0.0.0:PORT` for Render compatibility
- **Email issues:** Check Gmail app password and 2FA settings
- **TradingView connection:** App tries multiple symbols automatically
- **Graceful shutdown:** Handles SIGTERM and SIGINT properly

### 💡 Development

```bash
# Local development
npm install
npm run dev  # Uses nodemon for auto-restart

# Test endpoints locally
curl http://localhost:3000/health
curl http://localhost:3000/api/price
```

This deployment ensures your Coffee Robusta price tracker runs 24/7 on Render while providing web access for monitoring!
