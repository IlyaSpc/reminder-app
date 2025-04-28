import express from 'express';
import { Telegraf } from 'telegraf';
import { getCurrentUser, createReminder, getReminders, updateReminder, deleteReminder, getSelfCareQuote, updateUserProfile } from '../src/actions';

const app = express();
app.use(express.json());

const bot = new Telegraf(process.env.TELEGRAM_TOKEN!);

// Telegram WebApp
bot.command('start', (ctx) => {
  ctx.reply('Welcome to CareCalendar!', {
    reply_markup: {
      keyboard: [[{ text: 'Open Calendar', web_app: { url: process.env.VERCEL_URL || 'http://localhost:3000' } }]],
    },
  });
});

bot.command('remindme', async (ctx) => {
  const text = ctx.message.text.replace('/remindme', '').trim();
  try {
    await createReminder({
      title: text || 'New Reminder',
      startTime: new Date().toISOString(),
    });
    ctx.reply('Reminder created!');
  } catch (e) {
    ctx.reply('Error creating reminder.');
  }
});

// Telegram Payments
bot.command('premium', (ctx) => {
  ctx.replyWithInvoice({
    title: 'Premium Subscription',
    description: 'Unlimited reminders and exclusive quotes',
    payload: 'premium_subscription',
    provider_token: process.env.PAYMENT_PROVIDER_TOKEN!,
    currency: 'RUB',
    prices: [{ label: 'Premium', amount: 29900 }], // 299 RUB
  });
});

bot.on('pre_checkout_query', (ctx) => ctx.answerPreCheckoutQuery(true));
bot.on('successful_payment', async (ctx) => {
  const user = await getCurrentUser();
  await db.user.update({
    where: { id: user.id },
    data: { isPremium: true },
  });
  ctx.reply('Thank you for subscribing! Premium features unlocked.');
});

// Webhook
app.post('/api/telegram', bot.webhookCallback('/api/telegram'));

// API routes
app.get('/api/user', async (req, res) => {
  const user = await getCurrentUser();
  res.json(user);
});

app.post('/api/reminders', async (req, res) => {
  const reminder = await createReminder(req.body);
  res.json(reminder);
});

app.get('/api/reminders', async (req, res) => {
  const { startDate, endDate } = req.query;
  const reminders = await getReminders({ startDate: startDate as string, endDate: endDate as string });
  res.json(reminders);
});

app.put('/api/reminders/:id', async (req, res) => {
  const reminder = await updateReminder({ id: req.params.id, ...req.body });
  res.json(reminder);
});

app.delete('/api/reminders/:id', async (req, res) => {
  await deleteReminder({ id: req.params.id });
  res.json({ success: true });
});

app.post('/api/user', async (req, res) => {
  const user = await updateUserProfile(req.body);
  res.json(user);
});

app.post('/api/self-care-quote', async (req, res) => {
  const quote = await getSelfCareQuote(req.body);
  res.json(quote);
});

// Telegram auth
app.post('/api/auth/telegram', async (req, res) => {
  const { telegramId, name } = req.body;
  let user = await db.user.findFirst({ where: { id: telegramId } });
  if (!user) {
    user = await db.user.create({
      data: { id: telegramId, name: name || 'User' },
      include: { achievements: true },
    });
  }
  res.json(user);
});

export default app;