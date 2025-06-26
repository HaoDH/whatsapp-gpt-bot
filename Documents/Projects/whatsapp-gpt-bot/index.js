const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', (qr) => {
    console.log('Scan QR Code below to log in:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ Bot đã kết nối với WhatsApp');
});

client.on('message', async (message) => {
    // Chỉ xử lý tin nhắn trong nhóm
    if (message.from.endsWith('@g.us')) {
        const chat = await message.getChat();
        const sender = await message.getContact();

        const groupName = sanitizeFilename(chat.name); // Làm sạch tên nhóm
        const logDir = path.join(__dirname, 'logs');

        // Đảm bảo thư mục logs tồn tại
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir);
        }

        const filePath = path.join(logDir, `${groupName}.txt`);
        const logMessage = `[${new Date().toLocaleString()}] ${sender.pushname || sender.number}: ${message.body}\n`;

        // Ghi tin nhắn vào file nhóm
        fs.appendFile(filePath, logMessage, (err) => {
            if (err) {
                console.error('❌ Lỗi ghi file:', err);
            }
        });

        console.log(`📩 [${chat.name}] ${logMessage.trim()}`);
    }
});

// Hàm loại bỏ ký tự không hợp lệ trong tên file
function sanitizeFilename(name) {
    return name.replace(/[<>:"/\\|?*]+/g, '_').trim();
}

client.initialize();