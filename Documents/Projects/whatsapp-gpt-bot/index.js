const fs = require('fs');
const path = require('path');
const qrcodeTerminal = require('qrcode-terminal');
const qrcodeImage = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const simpleGit = require('simple-git');
const git = simpleGit();

// GitHub info
const GIT_USER = 'HaoDH';
const GIT_REPO = 'whatsapp_log';
const GIT_BRANCH = 'main';
const GIT_TOKEN = process.env.GH_TOKEN; // Đặt biến này trong Render

const client = new Client({
    authStrategy: new LocalAuth(), // sẽ tạo thư mục .wwebjs_auth
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    console.log('🔄 Mã QR đăng nhập:');
    qrcodeTerminal.generate(qr, { small: true });

    qrcodeImage.toFile('qr.png', qr, {
        color: {
            dark: '#000000',
            light: '#ffffff'
        }
    }, (err) => {
        if (err) console.error('❌ Không tạo được ảnh QR:', err);
        else console.log('✅ Đã lưu ảnh QR tại qr.png');
    });
});

client.on('ready', () => {
    console.log('✅ Bot đã kết nối WhatsApp thành công!');
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

        fs.appendFile(filePath, logMessage, async (err) => {
            if (err) return console.error('❌ Lỗi ghi log:', err);
            console.log(`📩 [${chat.name}] ${logMessage.trim()}`);
            await pushLogToGitHub(filePath);
        });
    }
});

function sanitizeFilename(name) {
    return name.replace(/[<>:"/\\|?*]+/g, '_').trim();
}

async function pushLogToGitHub(filePath) {
    try {
        await git.addConfig('user.name', 'whatsapp-bot');
        await git.addConfig('user.email', 'bot@example.com');
        await git.add(filePath);
        await git.commit(`update log: ${path.basename(filePath)}`);

        const remoteUrl = `https://${GIT_USER}:${GIT_TOKEN}@github.com/${GIT_USER}/${GIT_REPO}.git`;
        await git.push(remoteUrl, GIT_BRANCH);
        console.log('📤 Log đã được push lên GitHub!');
    } catch (err) {
        console.error('❌ Push lỗi:', err.message);
    }
}

client.initialize();