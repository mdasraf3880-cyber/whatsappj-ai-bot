import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 10000;
let qrDataUrl = '';
let isReady = false;
let botStatus = 'শুরু হচ্ছে... (Starting)';

const recentReplies = new Map();
const COOLDOWN_SECONDS = 3;

let lastImonTextIndex = -1;
let lastImonVoiceIndex = -1;

function getRandomItem(array, lastIndex) {
  let newIndex;
  do {
    newIndex = Math.floor(Math.random() * array.length);
  } while (array.length > 1 && newIndex === lastIndex);
  return { item: array[newIndex], index: newIndex };
}

function getAshrafulRoutine() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const bdTime = new Date(utc + (3600000 * 6));
  const hour = bdTime.getHours();
  const minute = bdTime.getMinutes();
  const timeInMinutes = hour * 60 + minute;

  if (timeInMinutes >= 330 && timeInMinutes < 600) {
    return 'আশরাফুল ভাই এখন সকালের পড়াশোনায় ব্যস্ত আছেন। পড়া শেষ করে সকাল ১০টার পর ফ্রি হতে পারেন।';
  }
  if (timeInMinutes >= 600 && timeInMinutes < 780) {
    return 'আশরাফুল ভাই এখন ঘুমাচ্ছেন (ঘুমের সময়)। দুপুর ১টার পর উঠে আপনার মেসেজ দেখবেন।';
  }
  if (timeInMinutes >= 960 && timeInMinutes < 1155) {
    return 'আশরাফুল ভাই এখন বাজারে/দোকানে আছেন। মাগরিবের পর বাসায় ফিরে ফ্রি হয়ে আপনার সাথে কথা বলবেন।';
  }
  return 'আশরাফুল ভাই এখন একটু কাজে ব্যস্ত আছেন। ফ্রি হয়েই দ্রুত আপনার মেসেজের রিপ্লাই দেবেন।';
}

const FRIENDS = {
  IMON: {
    name: 'ইমন হোসেন',
    phoneSuffix: '1972393248',
    lastVoiceIndex: -1,
    lastTextIndex: -1,
    voiceReplies: [
      'আরে ইমন ভাই! আপনি তো খালি ভয়েসই পাঠান, আমার তো শোনার কান নাই—আমি তো শুধু পড়তে পারি! ভাইয়া ফ্রি হয়ে আপনার ভয়েস শুনবেখন।',
      'ভাই আপনার ভয়েস তো আমি পড়তে পারি না! আশরাফুল ভাইয়া এখন খুব ব্যস্ত, ভাইয়া আসলে শুনবে। এতো বড় অডিও না পাঠিয়ে দুই লাইন লিখে দিলেই তো হতো!',
      'ইমন ভাই, আবার ভয়েস? এআই অ্যাসিস্ট্যান্টকে ভয়েস পাঠিয়ে লাভ নাই ভাই! ভাইয়া ফ্রি হোক, তারপর শুনবে। এখন মেসেজ দিয়ে বেশি বিরক্ত কইরেন না কিন্তু! 😄',
      'অডিও রিসিভ হয়েছে ইমন ভাই! তবে আশরাফুল ভাই এখন ব্যস্ত। উনি ফ্রি হলে শুনবেন।'
    ],
    textReplies: [
      'আরে ইমন ভাই! আপনি মেসেজ দিয়ে বিরক্ত করবেন না তো, আশরাফুল ভাইয়া এখন খুব ব্যস্ত!',
      'ইমন ভাই, কেমন আছেন? আপনার মেসেজ আশরাফুল ভাইকে বলে দেব। উনি এখন একটু ব্যস্ত, ফ্রি হয়েই আপনাকে নক দিবেন।',
      'সালাম ইমন ভাই! আশরাফুল ভাই এখন কাজে/পড়াশোনায় ব্যস্ত। আপনি ঘন ঘন নক না দিয়ে একটু পরে যোগাযোগ করেন তো ভাই! 😉',
      'ইমন ভাই, আপনার মেসেজ পেয়েছি। ভাইয়া একটু ব্যস্ত আছে, ফ্রি হলেই আপনাকে কল বা মেসেজ দিবেখন।'
    ]
  },
  IMTIAZ: {
    name: 'ইমতিয়াজ',
    phoneSuffix: '1626548061',
    lastVoiceIndex: -1,
    lastTextIndex: -1,
    voiceReplies: [
      'ইমতিয়াজ ভাই, আপনিও ভয়েস পাঠালেন? আমার তো কান নেই, আমি তো এআই রোবট! আশরাফুল ভাই ফ্রি হয়ে আপনার অডিও শুনবেখন।',
      'আরে ইমতিয়াজ ভাই! আশরাফুল ভাই এখন একটু ব্যস্ত আছেন। উনি ফ্রি হয়ে আপনার ভয়েস শুনবেন এবং নক দিবেন।',
      'ইমতিয়াজ ভাই, ভয়েস মেসেজ পেয়েছি! তবে আশরাফুল ভাই এখন পড়তে বা শুনতে পারছে না, একটু পর ফ্রি হয়ে রিপ্লাই দেবে।'
    ],
    textReplies: [
      'আরে ইমতিয়াজ! কি খবর দোস্ত? আশরাফুল এখন একটু ব্যস্ত আছে, ফ্রি হয়েই তোরে নক দিচ্ছে।',
      'ইমতিয়াজ ভাই, আশরাফুল ভাই এখন একটু কাজে আছে। কাজটা শেষ করেই আপনার মেসেজের রিপ্লাই দেবেখন।',
      'দোস্ত ইমতিয়াজ, আশরাফুল একটু ব্যস্ত। তোর মেসেজটা ওরে বলে দিচ্ছি, ফ্রি হলেই ব্যাক করবে।',
      'ইমতিয়াজ ভাই, কেমন আছো? আশরাফুল ভাই ফ্রি হয়েই তোমাকে নক দেবে, একটু অপেক্ষা করো!'
    ]
  }
};

function matchesFriend(senderJid, pushName, friend) {
  const cleanFrom = (senderJid || '').replace(/\D/g, '');
  if (cleanFrom.endsWith(friend.phoneSuffix)) {
    return true;
  }
  const name = (pushName || '').toLowerCase();
  return name.includes(friend.name.toLowerCase());
}

function getCustomResponse(pushName, senderJid, messageText, isAudio) {
  const text = (messageText || '').trim().toLowerCase();

  if (matchesFriend(senderJid, pushName, FRIENDS.IMON)) {
    if (isAudio) {
      const { item, index } = getRandomItem(FRIENDS.IMON.voiceReplies, FRIENDS.IMON.lastVoiceIndex);
      FRIENDS.IMON.lastVoiceIndex = index;
      return item;
    }
    const { item, index } = getRandomItem(FRIENDS.IMON.textReplies, FRIENDS.IMON.lastTextIndex);
    FRIENDS.IMON.lastTextIndex = index;
    return item;
  }

  if (matchesFriend(senderJid, pushName, FRIENDS.IMTIAZ)) {
    if (isAudio) {
      const { item, index } = getRandomItem(FRIENDS.IMTIAZ.voiceReplies, FRIENDS.IMTIAZ.lastVoiceIndex);
      FRIENDS.IMTIAZ.lastVoiceIndex = index;
      return item;
    }
    const { item, index } = getRandomItem(FRIENDS.IMTIAZ.textReplies, FRIENDS.IMTIAZ.lastTextIndex);
    FRIENDS.IMTIAZ.lastTextIndex = index;
    return item;
  }

  if (isAudio) {
    return 'ধন্যবাদ আপনার ভয়েস মেসেজের জন্য। আশরাফুল ভাই এই মুহূর্তে ব্যস্ত আছেন, উনি এসে আপনার ভয়েস শুনে উত্তর দেবেন।';
  }

  if (
    text.includes('কি কাজ') || text.includes('কী কাজ') ||
    text.includes('কি কি কাজ') || text.includes('কী কী কাজ') ||
    text.includes('বিক্রি') || text.includes('bikri') ||
    text.includes('কাজ করে') || text.includes('ব্যবসা')
  ) {
    return 'আশরাফুল ভাই মূলত একজন স্টুডেন্ট। উনি পড়াশোনা করছেন এবং আপাতত অন্য কোনো কাজ বা কেনাবেচা করেন না। উনি ফ্রি হলে আপনার সাথে কথা বলবেন।';
  }

  if (
    text.includes('কেমন আছো') || text.includes('কেমন আছেন') ||
    text.includes('kemon acho') || text.includes('kemon achen')
  ) {
    return `আলহামদুলিল্লাহ, ভালো আছি। আপনি কেমন আছেন? ${getAshrafulRoutine()}`;
  }

  if (
    text.includes('সালাম') || text.includes('salam') ||
    text.includes('assalamu') || text.includes('আসসালামু')
  ) {
    return `ওয়ালাইকুম আসসালাম। মেসেজ দেওয়ার জন্য ধন্যবাদ। ${getAshrafulRoutine()}`;
  }

  if (
    text.includes('hi') || text.includes('hello') ||
    text.includes('hey') || text.includes('হ্যালো') || text.includes('হাই')
  ) {
    return `হ্যালো! নক দেওয়ার জন্য ধন্যবাদ। আমি আশরাফুল ভাইয়ের অটো-অ্যাসিস্ট্যান্ট। ${getAshrafulRoutine()}`;
  }

  return `ধন্যবাদ মেসেজ দেওয়ার জন্য। ${getAshrafulRoutine()}`;
}

const app = express();

app.get('/', (req, res) => {
  let content = '';
  if (isReady) {
    content = '<h3 style="color:#25D366;">✅ WhatsApp Connected & Active</h3><p>Ashraful Islam AI Assistant is running 24/7 on Cloud.</p>';
  } else if (qrDataUrl) {
    content = `<h3>📱 Scan with WhatsApp</h3><p>Settings -> Linked Devices -> Link a Device</p><img src="${qrDataUrl}" style="max-width:280px;" />`;
  } else {
    content = '<p>Bot is starting up... Please refresh in a few seconds.</p>';
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="bn">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${!isReady ? '<meta http-equiv="refresh" content="5">' : ''}
      <title>Ashraful Islam - AI Assistant</title>
      <style>
        body { font-family: sans-serif; text-align: center; padding: 25px; background: #eef2f5; }
        .card { background: white; max-width: 480px; margin: 30px auto; padding: 25px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>🤖 আশরাফুল ইসলাম - এআই অ্যাসিস্ট্যান্ট</h2>
        <div style="font-weight:bold; margin:15px 0;">${botStatus}</div>
        ${content}
      </div>
    </body>
    </html>
  `);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 ওয়েব সার্ভার চলছে: http://0.0.0.0:${PORT}`);
});

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('baileys_auth');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    browser: ['Ubuntu', 'Chrome', '20.0.04']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('📱 নতুন QR কোড তৈরি হয়েছে (Render Web Interface-এ দেখা যাচ্ছে)');
      botStatus = '📱 কিউআর কোড স্ক্যান করুন (Scan QR)';
      qrDataUrl = await QRCode.toDataURL(qr);
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`⚠️ সংযোগ বিচ্ছিন্ন হয়েছে (Status: ${statusCode})। রিকানেক্ট করা হচ্ছে: ${shouldReconnect}`);
      isReady = false;
      botStatus = 'পুনরায় সংযোগ স্থাপন করা হচ্ছে... (Reconnecting)';
      if (shouldReconnect) {
        startBot();
      }
    } else if (connection === 'open') {
      console.log('✅ হোয়াটসঅ্যাপ সফলভাবে সংযুক্ত হয়েছে!');
      isReady = true;
      botStatus = 'সফলভাবে সংযুক্ত (Connected ✅)';
      qrDataUrl = '';
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    try {
      if (m.type !== 'notify') return;
      for (const msg of m.messages) {
        if (!msg.message || msg.key.fromMe) continue;

        const sender = msg.key.remoteJid;
        if (!sender || sender.endsWith('@g.us') || sender === 'status@broadcast') continue;

        const now = Date.now();
        if (recentReplies.has(sender)) {
          const lastTime = recentReplies.get(sender);
          if (now - lastTime < COOLDOWN_SECONDS * 1000) continue;
        }

        const pushName = msg.pushName || '';
        const messageType = Object.keys(msg.message)[0];
        const isAudio = messageType === 'audioMessage';

        let text = '';
        if (messageType === 'conversation') {
          text = msg.message.conversation;
        } else if (messageType === 'extendedTextMessage') {
          text = msg.message.extendedTextMessage?.text || '';
        } else if (messageType === 'imageMessage') {
          text = msg.message.imageMessage?.caption || '';
        }

        const reply = getCustomResponse(pushName, sender, text, isAudio);
        if (reply) {
          recentReplies.set(sender, now);
          console.log(`💬 উত্তর পাঠানো হচ্ছে [${pushName || sender}]: ${reply}`);
          await sock.sendMessage(sender, { text: reply }, { quoted: msg });
        }
      }
    } catch (err) {
      console.error('মেসেজ হ্যান্ডলিং এ সমস্যা:', err);
    }
  });
}

startBot().catch(console.error);
