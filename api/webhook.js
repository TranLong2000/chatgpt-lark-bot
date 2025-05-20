const axios = require('axios');

const LARK_BASE_URL = 'https://open.larksuite.com.vn';
const LARK_APP_ID = process.env.LARK_APP_ID;
const LARK_APP_SECRET = process.env.LARK_APP_SECRET;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

let larkTokenCache = {
  token: null,
  expiresAt: 0,
};

async function getLarkAccessToken() {
  const now = Date.now() / 1000;
  if (larkTokenCache.token && larkTokenCache.expiresAt > now) {
    return larkTokenCache.token;
  }

  const res = await axios.post(`${LARK_BASE_URL}/open-apis/auth/v3/tenant_access_token/internal`, {
    app_id: LARK_APP_ID,
    app_secret: LARK_APP_SECRET,
  });

  const token = res.data.tenant_access_token;
  larkTokenCache.token = token;
  larkTokenCache.expiresAt = now + res.data.expire;
  return token;
}

async function callChatGPT(message) {
  const res = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: message }],
    },
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
    }
  );

  return res.data.choices[0].message.content;
}

// Cấu hình để xử lý JSON
module.exports.config = {
  api: {
    bodyParser: true,
  },
};

// Hàm xử lý chính
module.exports.default = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const body = req.body;

  // 1. Xác minh webhook từ Lark
  if (body?.type === 'url_verification') {
    return res.status(200).json({ challenge: body.challenge });
  }

  // 2. Nhận tin nhắn
  const eventType = body?.header?.event_type;
  if (eventType === 'im.message.receive_v1') {
    try {
      const messageContent = body.event.message?.content;
      const chatId = body.event.message.chat_id;

      const parsed = JSON.parse(messageContent);
      const userMessage = parsed.text || '';

      console.log('📨 Nhận tin nhắn:', userMessage);

      const reply = await callChatGPT(userMessage);
      const token = await getLarkAccessToken();

      await axios.post(
        `${LARK_BASE_URL}/open-apis/im/v1/messages`,
        {
          receive_id: chatId,
          content: JSON.stringify({ text: reply }),
          msg_type: 'text',
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          params: {
            receive_id_type: 'chat_id',
          },
        }
      );
    } catch (error) {
      console.error('❌ Lỗi xử lý webhook:', error.response?.data || error.message);
    }
  }

  res.status(200).json({ message: 'OK' });
};
