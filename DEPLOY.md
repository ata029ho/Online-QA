# 🚀 AlmaLinux 伺服器部署指南

在 AlmaLinux 伺服器上部署線上搶答系統的完整步驟。

---

## 1️⃣ 安裝 Node.js

SSH 連線到伺服器後，執行以下命令：

```bash
# 安裝 Node.js 20.x (LTS)
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs

# 確認安裝成功
node -v
npm -v
```

---

## 2️⃣ 安裝 PM2（程序管理器）

PM2 可以讓 Node.js 應用程式在背景執行，並在伺服器重啟後自動啟動。

```bash
sudo npm install -g pm2
```

---

## 3️⃣ 下載專案

```bash
# 切換到您想放置專案的目錄
cd /var/www

# 從 GitHub 克隆專案
sudo git clone https://github.com/ata029ho/Online-QA.git
cd Online-QA

# 安裝依賴
sudo npm install --production
```

---

## 4️⃣ 啟動應用程式

```bash
# 使用 PM2 啟動
pm2 start ecosystem.config.js

# 設定開機自動啟動
pm2 startup
pm2 save
```

---

## 5️⃣ 設定防火牆

```bash
# 開放 3000 端口
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

---

## 6️⃣ 測試

在瀏覽器開啟：

```
http://您的伺服器IP:3000/admin.html
http://您的伺服器IP:3000/display.html
http://您的伺服器IP:3000/client.html
```

---

## 📌 常用 PM2 命令

| 命令 | 說明 |
|------|------|
| `pm2 list` | 查看所有程序狀態 |
| `pm2 logs` | 查看即時日誌 |
| `pm2 restart buzzer-system` | 重啟應用 |
| `pm2 stop buzzer-system` | 停止應用 |
| `pm2 delete buzzer-system` | 移除應用 |

---

## 🔒 （選配）設定 Nginx 反向代理 + HTTPS

如果您有網域並想使用 HTTPS：

### 安裝 Nginx

```bash
sudo dnf install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 設定反向代理

建立設定檔：

```bash
sudo nano /etc/nginx/conf.d/buzzer.conf
```

貼上以下內容（將 `qa.example.com` 改為您的網域）：

```nginx
server {
    listen 80;
    server_name qa.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 套用設定

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 安裝 SSL 憑證（使用 Let's Encrypt）

```bash
sudo dnf install -y certbot python3-certbot-nginx
sudo certbot --nginx -d qa.example.com
```

---

## 🔄 更新程式碼

當您推送新版本到 GitHub 後，在伺服器執行：

```bash
cd /var/www/Online-QA
git pull
npm install --production
pm2 restart buzzer-system
```
