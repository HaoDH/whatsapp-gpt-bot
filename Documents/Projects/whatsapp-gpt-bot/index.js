const fs = require('fs');
const path = require('path');
const express = require('express');
const qrcodeTerminal = require('qrcode-terminal');
const qrcodeImage = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const simpleGit = require('simple-git');
const git = simpleGit();

// GitHub info
const GIT_USER = 'HaoDH';
const GIT_REPO = 'whatsapp_log';
const GIT_BRANCH = 'main';
const GIT_TOKEN = process.env.GH_TOKEN; // đặt trong Render env

// ===== WhatsApp BOT Setup =====
const client = new Client({
    authStrategy: new LocalAuth(), // tạo .wwebjs_auth/
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    console.log('📲 Quét mã QR để đăng nhập:');
    qrcodeTerminal.generate(qr, { small: true });

    qrcodeImage.toFile('qr.png', qr, {
        color: {
            dark: '#000000',
            light: '#ffffff'
        }
    }, (err) => {
        if (err) console.error('❌ Lỗi tạo QR:', err);
        else console.log('✅ Đã lưu QR vào qr.png');
    });
});

client.on('ready', () => {
    console.log('✅ Bot đã kết nối với WhatsApp!');
});

client.on('message', async (message) => {
    if (message.from.endsWith('@g.us')) {
        const chat = await message.getChat();
        const sender = await message.getContact();
        const groupName = sanitizeFilename(chat.name);
        const logDir = path.join(__dirname, 'logs');
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
        const filePath = path.join(logDir, `${groupName}.txt`);
        const logMessage = `[${new Date().toLocaleString()}] ${sender.pushname || sender.number}: ${message.body}\n`;

        fs.appendFile(filePath, logMessage, (err) => {
            if (err) return console.error('❌ Ghi log lỗi:', err);
            console.log(`📩 [${chat.name}] ${logMessage.trim()}`);
        });
    }
});

function sanitizeFilename(name) {
    return name.replace(/[<>:"/\\|?*]+/g, '_').trim();
}

// ===== GIT PUSH mỗi 5 phút =====
async function pushAllLogsToGitHub() {
    try {
        await git.addConfig('user.name', 'whatsapp-bot');
        await git.addConfig('user.email', 'bot@example.com');
        await git.add('logs/*.txt');

        const status = await git.status();
        if (status.files.length === 0) {
            console.log('⏳ [AutoPush] Không có thay đổi.');
            return;
        }

        await git.commit(`Auto update logs @ ${new Date().toLocaleString()}`);
        const remoteUrl = `https://${GIT_USER}:${GIT_TOKEN}@github.com/${GIT_USER}/${GIT_REPO}.git`;
        await git.push(remoteUrl, GIT_BRANCH);

        console.log('📤 [AutoPush] Đã push logs lên GitHub!');
    } catch (err) {
        console.error('❌ [AutoPush] Lỗi khi push:', err.message);
    }
}

// Khởi động bot
client.initialize();

// Cài tự động push mỗi 5 phút
setInterval(() => {
    console.log('🕔 Kiểm tra & push logs...');
    pushAllLogsToGitHub();
}, 5 * 60 * 1000); // 5 phút

// ===== Web Server để hiển thị ảnh QR =====
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.send(`
        <h2>📲 QR đăng nhập WhatsApp</h2>
        <p>Scan QR bằng WhatsApp trên điện thoại:</p>
        <img src="/qr.png" width="300" alt="QR Code">
        <p><i>(Nếu không thấy QR, hãy restart app để tạo lại)</i></p>
    `);
});

app.listen(PORT, () => {
    console.log(`🌐 Server web đang chạy tại http://localhost:${PORT}`);
});