const fs = require('fs');
const path = require('path');
const qrcodeTerminal = require('qrcode-terminal');
const qrcodeImage = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');

// Khởi tạo client với lưu phiên đăng nhập
const client = new Client({
    authStrategy: new LocalAuth(), // lưu tại .wwebjs_auth/
    puppeteer: {
        headless: true, // không mở trình duyệt
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

// Khi QR được tạo
client.on('qr', (qr) => {
    console.log('🟡 Quét QR để đăng nhập WhatsApp:');

    // Hiển thị trong terminal
    qrcodeTerminal.generate(qr, { small: true });

    // Lưu ảnh QR vào file để quét bằng điện thoại
    qrcodeImage.toFile('qr.png', qr, {
        color: {
            dark: '#000000',
            light: '#ffffff'
        }
    }, (err) => {
        if (err) console.error('❌ Không thể tạo ảnh QR:', err);
        else console.log('✅ Ảnh QR đã được lưu tại: qr.png');
    });
});

// Khi kết nối thành công
client.on('ready', () => {
    console.log('✅ Bot đã kết nối với WhatsApp thành công!');
});

// Lắng nghe tin nhắn đến
client.on('message', async (message) => {
    // Chỉ xử lý tin nhắn trong nhóm
    if (message.from.endsWith('@g.us')) {
        const chat = await message.getChat();
        const sender = await message.getContact();

        const groupName = sanitizeFilename(chat.name);
        const logDir = path.join(__dirname, 'logs');

        // Tạo thư mục logs nếu chưa có
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir);
        }

        const filePath = path.join(logDir, `${groupName}.txt`);
        const logMessage = `[${new Date().toLocaleString()}] ${sender.pushname || sender.number}: ${message.body}\n`;

        // Ghi vào file log
        fs.appendFile(filePath, logMessage, (err) => {
            if (err) {
                console.error('❌ Lỗi ghi log:', err);
            }
        });

        // In ra terminal
        console.log(`📩 [${chat.name}] ${logMessage.trim()}`);
    }
});

// Hàm lọc tên nhóm thành tên file hợp lệ
function sanitizeFilename(name) {
    return name.replace(/[<>:"/\\|?*]+/g, '_').trim();
}

// Khởi chạy bot
client.initialize();