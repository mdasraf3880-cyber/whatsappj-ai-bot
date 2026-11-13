import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcodeTerminal from 'qrcode-terminal';
import QRCode from 'qrcode';
import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const PORT = process.env.PORT || 3000;
let qrDataUrl = '';
let isReady = false;
let botStatus = 'সফলভাবে সংযুক্ত (Connected ✅)';
let botActive = true;

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

function matchesFriend(contact, msg, friend) {
  const cleanFrom = (msg.from || '').replace(/\D/g, '');
  const cleanNumber = (contact.number || '').replace(/\D/g, '');
  const target = friend.phoneSuffix;

  if (cleanFrom.endsWith(target) || cleanNumber.endsWith(target)) {
    return true;
  }
  const name = ((contact.name || '') + ' ' + (contact.pushname || '')).toLowerCase();
  return name.includes(friend.name.toLowerCase());
}

function getCustomResponse(senderName, contact, msg) {
  const messageBody = (msg.body || '').trim().toLowerCase();
  const isAudioOrVoice = msg.type === 'ptt' || msg.type === 'audio' || msg.hasMedia && (msg.type === 'ptt' || msg.type === 'audio');

  if (matchesFriend(contact, msg, FRIENDS.IMON)) {
    if (isAudioOrVoice) {
      const { item, index } = getRandomItem(FRIENDS.IMON.voiceReplies, FRIENDS.IMON.lastVoiceIndex);
      FRIENDS.IMON.lastVoiceIndex = index;
      return item;
    }
    const { item, index } = getRandomItem(FRIENDS.IMON.textReplies, FRIENDS.IMON.lastTextIndex);
    FRIENDS.IMON.lastTextIndex = index;
    return item;
  }

  if (matchesFriend(contact, msg, FRIENDS.IMTIAZ)) {
    if (isAudioOrVoice) {
      const { item, index } = getRandomItem(FRIENDS.IMTIAZ.voiceReplies, FRIENDS.IMTIAZ.lastVoiceIndex);
      FRIENDS.IMTIAZ.lastVoiceIndex = index;
      return item;
    }
    const { item, index } = getRandomItem(FRIENDS.IMTIAZ.textReplies, FRIENDS.IMTIAZ.lastTextIndex);
    FRIENDS.IMTIAZ.lastTextIndex = index;
    return item;
  }

  if (isAudioOrVoice) {
    return 'ধন্যবাদ আপনার ভয়েস মেসেজের জন্য। আশরাফুল ভাই এই মুহূর্তে ব্যস্ত আছেন, উনি এসে আপনার ভয়েস শুনে উত্তর দেবেন।';
  }

  if (
    messageBody.includes('কি কাজ') || messageBody.includes('কী কাজ') ||
    messageBody.includes('কি কি কাজ') || messageBody.includes('কী কী কাজ') ||
    messageBody.includes('বিক্রি') || messageBody.includes('bikri') ||
    messageBody.includes('কাজ করে') || messageBody.includes('ব্যবসা')
  ) {
    return 'আশরাফুল ভাই মূলত একজন স্টুডেন্ট। উনি পড়াশোনা করছেন এবং আপাতত অন্য কোনো কাজ বা কেনাবেচা করেন না। উনি ফ্রি হলে আপনার সাথে কথা বলবেন।';
  }

  if (
    messageBody.includes('কেমন আছো') || messageBody.includes('কেমন আছেন') ||
    messageBody.includes('kemon acho') || messageBody.includes('kemon achen')
  ) {
    return `আলহামদুলিল্লাহ, ভালো আছি। আপনি কেমন আছেন? ${getAshrafulRoutine()}`;
  }

  if (
    messageBody.includes('সালাম') || messageBody.includes('salam') ||
    messageBody.includes('assalamu') || messageBody.includes('আসসালামু')
  ) {
    return `ওয়ালাইকুম আসসালাম। মেসেজ দেওয়ার জন্য ধন্যবাদ। ${getAshrafulRoutine()}`;
  }

  if (
    messageBody.includes('hi') || messageBody.includes('hello') ||
    messageBody.includes('hey') || messageBody.includes('হ্যালো') || messageBody.includes('হাই')
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

app.listen(PORT, () => {
  console.log(`🌐 ওয়েব সার্ভার চলছে: http://localhost:${PORT}`);
});

const puppeteerArgs = {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--disable-extensions'
  ]
};

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
if (fs.existsSync(chromePath)) {
  puppeteerArgs.executablePath = chromePath;
}

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
  authTimeoutMs: 120000,
  puppeteer: puppeteerArgs
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ সিস্টেম ত্রুটি (ধরা হয়েছে):', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('⚠️ আনহ্যান্ডেলড রিজেকশন:', reason?.message || reason);
});

client.on('qr', async (qr) => {
  botStatus = 'QR কোড স্ক্যান করুন (Waiting for Scan)';
  qrDataUrl = await QRCode.toDataURL(qr, { width: 300 });
  console.log('\n📱 WhatsApp -> Linked Devices -> স্ক্যান করুন:');
  qrcodeTerminal.generate(qr, { small: true });
});

client.on('ready', () => {
  isReady = true;
  qrDataUrl = '';
  botStatus = 'সফলভাবে সংযুক্ত (Connected ✅)';
  console.log('✅ আশরাফুল ইসলামের এআই অ্যাসিস্ট্যান্ট পুরোদমে চালু হয়েছে!');
});

client.on('authenticated', () => {
  botStatus = 'লগইন অনুমোদিত হয়েছে...';
  console.log('🔑 লগইন সংরক্ষিত রয়েছে (Authenticated)।');
});

client.on('disconnected', (reason) => {
  isReady = false;
  botStatus = 'সংযোগ বিচ্ছিন্ন হয়েছে';
  console.log('⚠️ সংযোগ বিচ্ছিন্ন হয়েছে:', reason);
  setTimeout(() => client.initialize(), 5000);
});

client.on('message', async (msg) => {
  try {
    if (msg.fromMe) return;
    if (!botActive) return;
    if (msg.from.endsWith('@g.us')) return;
    if (msg.from === 'status@broadcast') return;

    const contact = await msg.getContact();
    const senderName = contact.pushname || contact.name || contact.number || 'বন্ধু';

    console.log(`\n📩 নতুন মেসেজ এসেছে [${senderName}]: ${msg.hasMedia ? `[${msg.type}]` : msg.body}`);

    const now = Date.now();
    const lastReply = recentReplies.get(msg.from);
    if (lastReply && (now - lastReply) < COOLDOWN_SECONDS * 1000) {
      return;
    }

    const reply = getCustomResponse(senderName, contact, msg);

    const chat = await msg.getChat();
    await chat.sendStateTyping();
    await new Promise((r) => setTimeout(r, 1000));
    await chat.clearState();

    await msg.reply(reply);
    recentReplies.set(msg.from, now);
    console.log(`📤 উত্তর পাঠানো হয়েছে [${senderName}]: "${reply}"`);

  } catch (err) {
    console.error('মেসেজ প্রসেসিং ত্রুটি:', err.message);
  }
});

client.on('message_create', async (msg) => {
  if (msg.fromMe) {
    const text = (msg.body || '').trim().toLowerCase();
    if (text === '#off') {
      botActive = false;
      console.log('🔴 আশরাফুল ভাই ফোন থেকে বট বন্ধ করেছেন (#off)');
    } else if (text === '#on') {
      botActive = true;
      console.log('🟢 আশরাফুল ভাই ফোন থেকে বট চালু করেছেন (#on)');
    }
  }
});

client.initialize();
