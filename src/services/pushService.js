const webpush = require('web-push');
const { UserProfile, Notification } = require('../models');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@speedygamesdownloads.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

async function sendPush(userProfileId, title, body, data) {
  try {
    const profile = await UserProfile.findByPk(userProfileId);
    if (!profile || !profile.push_subscription) return false;

    const subscription = typeof profile.push_subscription === 'string'
      ? JSON.parse(profile.push_subscription)
      : profile.push_subscription;

    if (!subscription || !subscription.endpoint) return false;

    const payload = JSON.stringify({
      title: title,
      body: body,
      icon: '/nova-webui/img/icon.nova.png',
      badge: '/nova-webui/img/icon.nova.png',
      data: data || {}
    });

    await webpush.sendNotification(subscription, payload);
    return true;
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      try {
        await UserProfile.update(
          { push_subscription: null },
          { where: { id: userProfileId } }
        );
      } catch (e) {}
    }
    console.error('[PUSH] Error sending to profile', userProfileId, ':', err.message);
    return false;
  }
}

async function subscribe(userProfileId, subscription) {
  try {
    await UserProfile.update(
      { push_subscription: subscription },
      { where: { id: userProfileId } }
    );
    return true;
  } catch (err) {
    console.error('[PUSH] Subscribe error:', err.message);
    return false;
  }
}

async function notifyUser(userProfileId, type, title, message, data) {
  try {
    await Notification.create({
      user_profile_id: userProfileId,
      type: type,
      title: title,
      message: message,
      data: data || {},
      read: false
    });

    await sendPush(userProfileId, title, message, { type, ...data });
  } catch (err) {
    console.error('[PUSH] notifyUser error:', err.message);
  }
}

function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY;
}

module.exports = {
  sendPush,
  subscribe,
  notifyUser,
  getVapidPublicKey
};
