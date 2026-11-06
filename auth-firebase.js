/* ============================================================
   AUTH-FIREBASE.JS — Ragnar Solutions
   Full Firebase-backed replacement for auth.js
   Requires: firebase-config.js loaded before this script
   ============================================================ */

/* ============================================================
   USER MANAGEMENT
   ============================================================ */

/** Register new user */
async function registerUser(data) {
  const { email, password, firstName, middleName, lastName, username, phone } = data;
  if (!email || !password || !firstName || !lastName || !username)
    return { success: false, message: 'Fill all required fields.' };
  if (password.length < 8)
    return { success: false, message: 'Password must be at least 8 characters.' };

  /* Check username uniqueness */
  const uSnap = await db.collection('users').where('username', '==', username.toLowerCase()).get();
  if (!uSnap.empty) return { success: false, message: 'Username already taken.' };

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const uid  = cred.user.uid;
    const now  = new Date().toISOString();

    const userDoc = {
      id: uid, email, phone: phone || '',
      firstName, middleName: middleName || '', lastName,
      name: `${firstName}${middleName ? ' ' + middleName : ''} ${lastName}`.trim(),
      username: username.toLowerCase(), role: 'user', status: 'active',
      avatar: firstName.charAt(0).toUpperCase(),
      kyc: { status: 'none', submittedAt: null, verifiedAt: null },
      twoFA: { enabled: false, backupCode: null },
      usernameChanges: [], createdAt: now
    };

    await db.collection('users').doc(uid).set(userDoc);

    /* Init wallet */
    await db.collection('wallets').doc(uid).set({
      naira:  { balance: 0, transactions: [] },
      crypto: { BTC: { balance: 0, locked: 0 }, ETH: { balance: 0, locked: 0 }, USDT: { balance: 0, locked: 0 }, BNB: { balance: 0, locked: 0 } }
    });

    return { success: true, user: userDoc };
  } catch (e) {
    if (e.code === 'auth/email-already-in-use') return { success: false, message: 'Email already registered.' };
    return { success: false, message: e.message };
  }
}

/** Login user — returns user doc on success */
async function loginUser(email, password) {
  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    const snap = await db.collection('users').doc(cred.user.uid).get();
    if (!snap.exists) return { success: false, message: 'Account not found.' };
    const user = snap.data();
    if (user.status === 'banned') {
      await auth.signOut();
      return { success: false, message: 'This account has been suspended.' };
    }
    return { success: true, user };
  } catch (e) {
    if (e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found')
      return { success: false, message: 'Invalid email or password.' };
    return { success: false, message: e.message };
  }
}

/** Get current Firebase Auth user doc from Firestore */
async function getCurrentUserDoc() {
  const u = auth.currentUser;
  if (!u) return null;
  const snap = await db.collection('users').doc(u.uid).get();
  return snap.exists ? snap.data() : null;
}

/** Logout */
async function logoutUser() {
  await auth.signOut();
  window.location.href = 'login.html';
}

/** Get all non-admin users (admin use) */
async function getAllUsers() {
  const snap = await db.collection('users').where('role', '==', 'user').get();
  return snap.docs.map(d => d.data());
}

/** Update user status (ban/unban) */
async function updateUserStatus(userId, status) {
  await db.collection('users').doc(userId).update({ status });
}

/* ============================================================
   SESSION / AUTH GUARD
   ============================================================ */

/**
 * Require auth — redirects if not signed in or wrong role.
 * Unsubscribes after first check to prevent infinite re-fires.
 * Returns a Promise that resolves to the user doc.
 */
let _requireAuthRedirecting = false;
function requireAuthAsync(requiredRole) {
  return new Promise((resolve, reject) => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      unsubscribe(); /* ← critical: only fire once */
      if (_requireAuthRedirecting) return;

      if (!u) {
        _requireAuthRedirecting = true;
        window.location.href = 'login.html';
        reject(new Error('Not authenticated'));
        return;
      }

      try {
        const snap = await db.collection('users').doc(u.uid).get();
        if (!snap.exists) {
          _requireAuthRedirecting = true;
          await auth.signOut();
          window.location.href = 'login.html';
          reject(new Error('User doc not found'));
          return;
        }
        const user = snap.data();
        if (user.status === 'banned') {
          _requireAuthRedirecting = true;
          await auth.signOut();
          window.location.href = 'login.html';
          reject(new Error('Banned'));
          return;
        }
        if (requiredRole && user.role !== requiredRole) {
          _requireAuthRedirecting = true;
          window.location.href = user.role === 'admin' ? 'admin.html' : 'dashboard.html';
          reject(new Error('Wrong role'));
          return;
        }
        resolve(user);
      } catch (err) {
        reject(err);
      }
    });
  });
}

/* ============================================================
   WALLET
   ============================================================ */

async function getUserWallet(userId) {
  const snap = await db.collection('wallets').doc(userId).get();
  return snap.exists ? snap.data() : { naira: { balance: 0, transactions: [] }, crypto: {} };
}

async function saveUserWallet(userId, wallet) {
  await db.collection('wallets').doc(userId).set(wallet);
}

async function creditNairaWallet(userId, amount, description) {
  const wallet = await getUserWallet(userId);
  wallet.naira.balance += parseFloat(amount);
  wallet.naira.transactions.unshift({
    id: 'NGN_' + Date.now(), type: 'credit',
    description, amount: parseFloat(amount),
    status: 'completed', createdAt: new Date().toISOString()
  });
  await saveUserWallet(userId, wallet);
}

async function manualFundWallet(userId, amount, description) {
  if (!userId || !amount || parseFloat(amount) <= 0)
    return { success: false, message: 'Enter a valid user and amount.' };
  await creditNairaWallet(userId, parseFloat(amount), description || 'Manual credit by admin');
  return { success: true };
}

/* ============================================================
   TRANSACTIONS
   ============================================================ */

async function addTransaction(userId, type, details, amount, status = 'pending', extra = {}) {
  const txn = {
    id: 'TXN_' + Date.now(), userId, type, details,
    amount: parseFloat(amount) || 0, status,
    images: extra.images || [],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    ...extra
  };
  await db.collection('transactions').doc(txn.id).set(txn);
  return txn;
}

async function getTransactions(userId = null) {
  let ref = db.collection('transactions').orderBy('createdAt', 'desc');
  if (userId) ref = ref.where('userId', '==', userId);
  const snap = await ref.get();
  return snap.docs.map(d => d.data());
}

async function updateTransactionStatus(txnId, status) {
  await db.collection('transactions').doc(txnId).update({ status, updatedAt: new Date().toISOString() });
}

/* ============================================================
   GIFT CARD RATES & EXCHANGE RATE
   ============================================================ */

const DEFAULT_RATES = {
  Apple: 85, Amazon: 84, 'Google Play': 80, PlayStation: 78,
  Vanilla: 73, VISA: 75, MasterCard: 75, Steam: 72
};

async function getRates() {
  const snap = await db.collection('rates').doc('config').get();
  return snap.exists ? snap.data() : { gcRates: DEFAULT_RATES, usdRate: 1600 };
}

async function saveRates(gcRates, usdRate) {
  await db.collection('rates').doc('config').set({ gcRates, usdRate }, { merge: true });
}

async function getUSDRate() {
  const config = await getRates();
  return config.usdRate || 1600;
}

/* ============================================================
   CHAT ENGINE
   ============================================================ */

async function createChat(userId, type, transactionId, txnData) {
  const chatId = 'CHAT_' + Date.now();
  const now    = new Date().toISOString();
  const chat   = {
    id: chatId, userId, type, status: 'open',
    transactionId: transactionId || null,
    unreadAdmin: 0, unreadUser: 0,
    createdAt: now, updatedAt: now, messages: []
  };

  if (txnData) {
    chat.messages.push({
      id: 'MSG_' + Date.now(), senderId: 'system', senderName: 'System',
      text: `📋 Transaction initiated: ${txnData.type} — ${txnData.details} — $${parseFloat(txnData.amount || 0).toFixed(2)}`,
      msgType: 'txn_tag', txnData, createdAt: now
    });
    chat.unreadAdmin = 1;
  }

  await db.collection('chats').doc(chatId).set(chat);
  return chat;
}

async function getChatById(chatId) {
  const snap = await db.collection('chats').doc(chatId).get();
  return snap.exists ? snap.data() : null;
}

async function getAllChats() {
  const snap = await db.collection('chats').orderBy('updatedAt', 'desc').get();
  return snap.docs.map(d => d.data());
}

async function getUserChats(userId) {
  const snap = await db.collection('chats').where('userId', '==', userId).orderBy('updatedAt', 'desc').get();
  return snap.docs.map(d => d.data());
}

async function sendChatMessage(chatId, senderId, senderName, text) {
  const msg = {
    id: 'MSG_' + Date.now(), senderId, senderName, text,
    msgType: 'text', createdAt: new Date().toISOString()
  };
  const update = { updatedAt: new Date().toISOString() };
  if (senderId === 'admin') update.unreadUser  = firebase.firestore.FieldValue.increment(1);
  else                       update.unreadAdmin = firebase.firestore.FieldValue.increment(1);

  await db.collection('chats').doc(chatId).update({
    messages: firebase.firestore.FieldValue.arrayUnion(msg), ...update
  });
  return msg;
}

async function sendChatImage(chatId, senderId, senderName, dataURL) {
  const msg = {
    id: 'MSG_' + Date.now(), senderId, senderName,
    text: '[Image]', msgType: 'image', imageData: dataURL,
    createdAt: new Date().toISOString()
  };
  const update = { updatedAt: new Date().toISOString() };
  if (senderId === 'admin') update.unreadUser  = firebase.firestore.FieldValue.increment(1);
  else                       update.unreadAdmin = firebase.firestore.FieldValue.increment(1);

  await db.collection('chats').doc(chatId).update({
    messages: firebase.firestore.FieldValue.arrayUnion(msg), ...update
  });
  return msg;
}

async function markChatRead(chatId, role) {
  const field = role === 'admin' ? 'unreadAdmin' : 'unreadUser';
  await db.collection('chats').doc(chatId).update({ [field]: 0 });
}

async function closeChatById(chatId) {
  await db.collection('chats').doc(chatId).update({ status: 'closed', updatedAt: new Date().toISOString() });
}

async function getAdminUnreadChats() {
  const snap = await db.collection('chats').where('unreadAdmin', '>', 0).get();
  return snap.size;
}

/* ---- Admin action: approve / reject / fail / decline a transaction chat ---- */
async function adminActionChat(chatId, action, fundAmountNGN) {
  const chat = await getChatById(chatId);
  if (!chat) return { success: false, message: 'Chat not found.' };

  const actionLabels = {
    approve: '✅ Transaction approved. Your wallet has been funded.',
    reject:  '❌ Transaction rejected by admin.',
    fail:    '⚠️ Transaction marked as failed.',
    decline: '🚫 Transaction declined.'
  };

  const now = new Date().toISOString();
  const msg = {
    id: 'MSG_' + Date.now(), senderId: 'admin', senderName: 'Ragnar Admin',
    text: actionLabels[action],
    msgType: 'action', action, createdAt: now
  };

  /* Credit wallet on approve */
  if (action === 'approve' && fundAmountNGN && parseFloat(fundAmountNGN) > 0) {
    await creditNairaWallet(chat.userId, parseFloat(fundAmountNGN), `Payment for transaction ${chat.transactionId}`);
  }

  /* Update the linked transaction */
  if (chat.transactionId) {
    const statusMap = { approve: 'completed', reject: 'rejected', fail: 'failed', decline: 'rejected' };
    await updateTransactionStatus(chat.transactionId, statusMap[action]);
  }

  await db.collection('chats').doc(chatId).update({
    messages: firebase.firestore.FieldValue.arrayUnion(msg),
    status:   action === 'approve' ? 'closed' : chat.status,
    unreadUser: firebase.firestore.FieldValue.increment(1),
    updatedAt: now
  });

  return { success: true };
}

/* ============================================================
   FIREBASE STORAGE — Gift card image upload
   ============================================================ */

async function uploadGiftCardImage(userId, file) {
  const path = `gift-cards/${userId}/${Date.now()}_${file.name}`;
  const ref  = storage.ref(path);
  await ref.put(file);
  const url = await ref.getDownloadURL();
  return url;
}

/* ============================================================
   2FA (stored in Firestore user doc)
   ============================================================ */

async function enable2FA(userId) {
  const code = Math.random().toString(36).substring(2, 10).toUpperCase();
  await db.collection('users').doc(userId).update({ twoFA: { enabled: true, backupCode: code } });
  return code;
}

async function disable2FA(userId) {
  await db.collection('users').doc(userId).update({ twoFA: { enabled: false, backupCode: null } });
}

async function verify2FA(userId, code) {
  const snap = await db.collection('users').doc(userId).get();
  if (!snap.exists) return false;
  const u = snap.data();
  return u.twoFA && u.twoFA.enabled && u.twoFA.backupCode === code.toUpperCase();
}

/* ============================================================
   SETTINGS
   ============================================================ */

async function changeUsername(userId, newUsername) {
  const snap = await db.collection('users').doc(userId).get();
  if (!snap.exists) return { success: false, message: 'User not found.' };
  const user = snap.data();
  const now  = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const changesThisYear = (user.usernameChanges || []).filter(d => new Date(d) >= yearStart);
  if (changesThisYear.length >= 3) return { success: false, message: 'Username can only be changed 3 times per year.' };
  const taken = await db.collection('users').where('username', '==', newUsername.toLowerCase()).get();
  if (!taken.empty && taken.docs[0].id !== userId) return { success: false, message: 'Username already taken.' };
  await db.collection('users').doc(userId).update({
    username: newUsername.toLowerCase(),
    usernameChanges: firebase.firestore.FieldValue.arrayUnion(now.toISOString())
  });
  return { success: true };
}

async function changePassword(userId, oldPwd, newPwd) {
  /* Re-authenticate then update */
  const u    = auth.currentUser;
  const cred = firebase.auth.EmailAuthProvider.credential(u.email, oldPwd);
  try {
    await u.reauthenticateWithCredential(cred);
    await u.updatePassword(newPwd);
    return { success: true };
  } catch (e) {
    return { success: false, message: e.code === 'auth/wrong-password' ? 'Current password incorrect.' : e.message };
  }
}

/* ============================================================
   KYC
   ============================================================ */

async function submitKYC(userId, data) {
  await db.collection('users').doc(userId).update({
    kyc: { status: 'pending', submittedAt: new Date().toISOString(), verifiedAt: null, ...data }
  });
  return { success: true };
}

async function approveKYC(userId) {
  await db.collection('users').doc(userId).update({
    kyc: { status: 'verified', verifiedAt: new Date().toISOString() }
  });
}
