const fs = require('fs');
const path = require('path');
const express = require('express');
const qrcodeTerminal = require('qrcode-terminal');
const qrcodeImage = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const simpleGit = require('simple-git');
const git = simpleGit();

// === GitHub Config ===
const GIT_USER = 'HaoDH';
const GIT_REPO = 'whatsapp_log';
const GIT_BRANCH = 'main';
const GIT_TOKEN = process.env.GH_TOKEN; // ⚠️ Token để trong Render secrets

// === QR Code In-Memory ===
let latestQR = null;

// === Đảm bảo thư mục logs tồn tại ===
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

// === Khởi tạo WhatsApp client ===
const client = new Client({
    authStrategy: new LocalAuth(), // lưu session tại .wwebjs_auth/
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// === Xử lý QR Code ===
client.on('qr', (qr) => {
    console.log('📲 Quét mã QR để đăng nhập:');
    qrcodeTerminal.generate(qr, { small: true });

    // Tạo QR base64 để hiển thị trên web
    qrcodeImage.toDataURL(qr, (err, url) => {
        if (err) return console.error('❌ Không tạo được QR base64:', err);
        latestQR = url.replace(/^data:image\\/png;base64,/, '');
        console.log('✅ QR đã sẵn sàng để hiển thị trên trình duyệt!');
    });
});

// === Sẵn sàng nhận tin nhắn ===
client.on('ready', () => {
    console.log('✅ Bot đã kết nối với WhatsApp!');
});

// === Ghi lại tin nhắn nhóm vào file ===
client.on('message', async (message) => {
    if (message.from.endsWith('@g.us')) {
        const chat = await message.getChat();
        const sender = await message.getContact();

        const groupName = sanitizeFilename(chat.name);
        const filePath = path.join(logDir, `${groupName}.txt`);
        const logMessage = `[${new Date().toLocaleString()}] ${sender.pushname || sender.number}: ${message.body}\n`;

        fs.appendFile(filePath, logMessage, (err) => {
            if (err) return console.error('❌ Lỗi ghi log:', err);
            console.log(`📩 [${chat.name}] ${logMessage.trim()}`);
        });
    }
});

// === Tên file hợp lệ ===
function sanitizeFilename(name) {
    return name.replace(/[<>:"/\\\\|?*]+/g, '_').trim();
}

// === Tự động push logs lên GitHub ===
async function pushAllLogsToGitHub() {
    try {
        const txtFiles = fs.existsSync(logDir)
            ? fs.readdirSync(logDir).filter(file => file.endsWith('.txt'))
            : [];

        if (txtFiles.length === 0) {
            console.log('📭 [AutoPush] Không có file .txt để push.');
            return;
        }

        await git.addConfig('user.name', 'whatsapp-bot');
        await git.addConfig('user.email', 'bot@example.com');
        await git.add('logs/*.txt');

        const status = await git.status();
        if (status.files.length === 0) {
            console.log('⏳ [AutoPush] Không có thay đổi mới.');
            return;
        }

        const remoteUrl = `https://${GIT_USER}:${GIT_TOKEN}@github.com/${GIT_USER}/${GIT_REPO}.git`;
        await git.commit(`Auto update logs @ ${new Date().toLocaleString()}`);
        await git.push(remoteUrl, GIT_BRANCH);

        console.log('📤 [AutoPush] Đã push logs lên GitHub!');
    } catch (err) {
        console.error('❌ [AutoPush] Lỗi khi push:', err.message);
    }
}

// === Khởi động bot & tự push mỗi 5 phút ===
client.initialize();
setInterval(() => {
    console.log('🕔 Kiểm tra & push logs...');
    pushAllLogsToGitHub();
}, 5 * 60 * 1000);

// === Web server để hiển thị QR ===
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    const qrHTML = latestQR
        ? `<img src="data:image/png;base64,${latestQR}" width="300" alt="QR Code">`
        : `<p style="color:red;">⚠️ QR chưa được tạo hoặc đã hết hạn. Hãy restart app để tạo lại.</p>`;

    res.send(`
        <h2>📲 QR đăng nhập WhatsApp</h2>
        <p>Scan QR bằng WhatsApp trên điện thoại:</p>
        ${qrHTML}
        <p><i>(QR hết hạn sau ~1 phút. Nếu mất, restart app để tạo lại.)</i></p>
    `);
});

app.listen(PORT, () => {
    console.log(`🌐 Web server đang chạy tại http://localhost:${PORT}`);
});