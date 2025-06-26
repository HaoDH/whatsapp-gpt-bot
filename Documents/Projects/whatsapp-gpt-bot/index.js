const fs = require('fs');
const path = require('path');
const qrcodeTerminal = require('qrcode-terminal');
const qrcodeImage = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const simpleGit = require('simple-git');
const git = simpleGit();

// GitHub repo info
const GIT_USER = 'HaoDH';
const GIT_REPO = 'whatsapp_log';
const GIT_BRANCH = 'main';
const GIT_TOKEN = process.env.GH_TOKEN; // ⚠️ phải đặt trên Render hoặc .env

// Khởi tạo WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth(), // Lưu đăng nhập tại .wwebjs_auth
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Hiện QR để quét
client.on('qr', (qr) => {
    console.log('📲 Quét mã QR để đăng nhập:');
    qrcodeTerminal.generate(qr, { small: true });

    qrcodeImage.toFile('qr.png', qr, {
        color: {
            dark: '#000000',
            light: '#ffffff'
        }
    }, (err) => {
        if (err) console.error('❌ Lỗi tạo ảnh QR:', err);
        else console.log('✅ Đã lưu ảnh QR tại qr.png');
    });
});

// Khi bot kết nối thành công
client.on('ready', () => {
    console.log('✅ Bot đã kết nối với WhatsApp!');
});

// Lưu tin nhắn từ nhóm
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

// Dọn tên file từ tên nhóm
function sanitizeFilename(name) {
    return name.replace(/[<>:"/\\|?*]+/g, '_').trim();
}

// Hàm tự động push toàn bộ logs mỗi 5 phút
async function pushAllLogsToGitHub() {
    try {
        await git.addConfig('user.name', 'whatsapp-bot');
        await git.addConfig('user.email', 'bot@example.com');
        await git.add('logs/*.txt');

        const status = await git.status();
        if (status.files.length === 0) {
            console.log('⏳ [AutoPush] Không có thay đổi mới để commit.');
            return;
        }

        await git.commit(`Auto update logs @ ${new Date().toLocaleString()}`);

        const remoteUrl = `https://${GIT_USER}:${GIT_TOKEN}@github.com/${GIT_USER}/${GIT_REPO}.git`;
        await git.push(remoteUrl, GIT_BRANCH);

        console.log('📤 [AutoPush] Đã đẩy log lên GitHub!');
    } catch (err) {
        console.error('❌ [AutoPush] Lỗi khi push Git:', err.message);
    }
}

// Khởi động bot
client.initialize();

// Tự động push logs mỗi 5 phút
setInterval(() => {
    console.log('🕔 Kiểm tra log để tự động commit...');
    pushAllLogsToGitHub();
}, 5 * 60 * 1000); // 5 phút