/* ============================================================
   RAGNAR SOLUTIONS — auth.js
   Shared authentication utilities (localStorage-based)
   ============================================================ */

const USERS_KEY   = 'ragnar_users';
const SESSION_KEY = 'ragnar_session';
const TXN_KEY     = 'ragnar_transactions';

/* ---- Seed default admin account ---- */
function initUsers() {
  if (!localStorage.getItem(USERS_KEY)) {
    const admin = {
      id: 'admin_001',
      name: 'Ragnar Admin',
      email: 'admin@ragnarsolutions.com',
      password: 'Admin@2024',
      phone: '',
      role: 'admin',
      status: 'active',
      joinedAt: new Date().toISOString(),
      avatar: 'A'
    };
    localStorage.setItem(USERS_KEY, JSON.stringify([admin]));
  }
  if (!localStorage.getItem(TXN_KEY)) {
    localStorage.setItem(TXN_KEY, JSON.stringify([]));
  }
}

function getUsers() {
  initUsers();
  return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getTransactions() {
  return JSON.parse(localStorage.getItem(TXN_KEY)) || [];
}

function saveTransactions(txns) {
  localStorage.setItem(TXN_KEY, JSON.stringify(txns));
}

/* ---- Register ---- */
function register(name, email, phone, password, username) {
  const users = getUsers();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return { success: false, message: 'An account with this email already exists.' };
  }
  if (username) {
    const uname = username.toLowerCase().trim();
    if (users.find(u => u.username && u.username.toLowerCase() === uname)) {
      return { success: false, message: 'This username is already taken.' };
    }
  }
  const user = {
    id: 'user_' + Date.now(),
    name: name.trim(),
    username: (username || '').toLowerCase().trim(),
    email: email.toLowerCase().trim(),
    password,
    phone: phone.trim(),
    role: 'user',
    status: 'active',
    balance: 0,
    joinedAt: new Date().toISOString(),
    avatar: name.trim()[0].toUpperCase(),
    usernameChanges: []
  };
  users.push(user);
  saveUsers(users);

  /* Add welcome transaction */
  const txns = getTransactions();
  txns.unshift({
    id: 'TXN' + Date.now(),
    userId: user.id,
    type: 'Account Created',
    details: 'Welcome to Ragnar Solutions',
    amount: 0,
    status: 'completed',
    createdAt: new Date().toISOString()
  });
  saveTransactions(txns);

  return { success: true, user };
}

/* ---- Login ---- */
function login(email, password) {
  const users = getUsers();
  const user = users.find(
    u => u.email.toLowerCase() === email.toLowerCase().trim() && u.password === password
  );
  if (!user) return { success: false, message: 'Invalid email or password.' };
  if (user.status === 'banned') return { success: false, message: 'Your account has been suspended. Contact support.' };

  const session = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    loginTime: new Date().toISOString()
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return { success: true, session };
}

/* ---- Session helpers ---- */
function getSession() {
  const s = sessionStorage.getItem(SESSION_KEY);
  return s ? JSON.parse(s) : null;
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  window.location.href = 'index.html';
}

function requireAuth(requiredRole = null) {
  const session = getSession();
  if (!session) { window.location.href = 'login.html'; return null; }
  if (requiredRole && session.role !== requiredRole) {
    window.location.href = session.role === 'admin' ? 'admin.html' : 'dashboard.html';
    return null;
  }
  return session;
}

function getCurrentUser() {
  const session = getSession();
  if (!session) return null;
  const users = getUsers();
  return users.find(u => u.id === session.userId) || null;
}

function getUserTransactions(userId) {
  return getTransactions().filter(t => t.userId === userId);
}

/* ---- Admin helpers ---- */
function getAllUsers() { return getUsers().filter(u => u.role !== 'admin'); }

function updateUserStatus(userId, status) {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx !== -1) { users[idx].status = status; saveUsers(users); }
}

function addTransaction(userId, type, details, amount, status = 'pending') {
  const txns = getTransactions();
  const newTxn = {
    id: 'TXN' + Date.now(),
    userId,
    type,
    details,
    amount: parseFloat(amount),
    status,
    createdAt: new Date().toISOString()
  };
  txns.unshift(newTxn);
  saveTransactions(txns);
  return newTxn;
}

function updateTransactionStatus(txnId, status) {
  const txns = getTransactions();
  const idx = txns.findIndex(t => t.id === txnId);
  if (idx !== -1) { txns[idx].status = status; saveTransactions(txns); }
}

initUsers();

/* ============================================================
   WALLET ENGINE
   ============================================================ */
const WALLET_KEY = 'ragnar_wallets';
const STAKES_KEY = 'ragnar_stakes';

const STAKING_RATES = {
  weekly:  { BTC:1.5, ETH:1.8, SOL:2.5, BNB:2.0, USDT:1.2, XRP:1.6, DOGE:3.0, ADA:2.2 },
  monthly: { BTC:5.5, ETH:6.5, SOL:9.0, BNB:7.5, USDT:4.5, XRP:6.0, DOGE:11.0, ADA:8.5 },
  yearly:  { BTC:22.0, ETH:26.0, SOL:32.0, BNB:28.0, USDT:16.0, XRP:21.0, DOGE:38.0, ADA:30.0 }
};
const PLAN_DAYS = { weekly:7, monthly:30, yearly:365 };

/* Deterministic address generation from userId */
function generateAddress(coin, userId) {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (Math.imul(31, h) + userId.charCodeAt(i)) | 0;
  const hex = Math.abs(h).toString(16).padStart(8,'0');
  const b58chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let b58 = '';
  for (let i = 0; i < 12; i++) b58 += b58chars[Math.abs(h * (i+1)) % 58];
  const map = {
    BTC:  `bc1q${hex}${b58}xk`,
    ETH:  `0x${hex}${b58}4A2f`,
    SOL:  `${b58}${hex}SoL7Xk`,
    BNB:  `0xbnb${hex}${b58}9B`,
    USDT: `T${hex}${b58}usdt2M`,
    XRP:  `r${hex}${b58}XRP5w`,
    DOGE: `D${hex}${b58}doge9v`,
    ADA:  `addr1${hex}${b58}ADA3v`,
  };
  return map[coin] || `${hex}${b58}`;
}

function getWallets() {
  return JSON.parse(localStorage.getItem(WALLET_KEY) || '{}');
}
function saveWallets(w) { localStorage.setItem(WALLET_KEY, JSON.stringify(w)); }

function getUserWallet(userId) {
  const wallets = getWallets();
  if (!wallets[userId]) {
    wallets[userId] = {
      naira: { balance: 0, transactions: [] },
      crypto: {
        BTC:  { balance:0, locked:0, address:generateAddress('BTC',  userId) },
        ETH:  { balance:0, locked:0, address:generateAddress('ETH',  userId) },
        SOL:  { balance:0, locked:0, address:generateAddress('SOL',  userId) },
        BNB:  { balance:0, locked:0, address:generateAddress('BNB',  userId) },
        USDT: { balance:0, locked:0, address:generateAddress('USDT', userId) },
        XRP:  { balance:0, locked:0, address:generateAddress('XRP',  userId) },
        DOGE: { balance:0, locked:0, address:generateAddress('DOGE', userId) },
        ADA:  { balance:0, locked:0, address:generateAddress('ADA',  userId) },
      }
    };
    saveWallets(wallets);
  }
  return wallets[userId];
}
function saveUserWallet(userId, wallet) {
  const w = getWallets(); w[userId] = wallet; saveWallets(w);
}

/* ---- Naira Wallet ---- */
function requestNairaFunding(userId, amount, ref) {
  const wallet = getUserWallet(userId);
  wallet.naira.transactions.unshift({ id:'NGN'+Date.now(), type:'Fund Request', amount:parseFloat(amount), ref, status:'pending', date:new Date().toISOString() });
  saveUserWallet(userId, wallet);
  addTransaction(userId, 'Naira Fund Request', `₦${Number(amount).toLocaleString()} — Ref: ${ref}`, parseFloat(amount), 'pending');
}
function requestNairaWithdrawal(userId, amount, bankName, accountNumber, accountName) {
  const wallet = getUserWallet(userId);
  if (wallet.naira.balance < parseFloat(amount)) return { success:false, message:'Insufficient Naira balance.' };
  wallet.naira.balance -= parseFloat(amount);
  wallet.naira.transactions.unshift({ id:'WDR'+Date.now(), type:'Withdrawal', amount:parseFloat(amount), bank:bankName, account:accountNumber, accountName, status:'pending', date:new Date().toISOString() });
  saveUserWallet(userId, wallet);
  addTransaction(userId, 'Naira Withdrawal', `₦${Number(amount).toLocaleString()} → ${bankName} ${accountNumber}`, parseFloat(amount), 'pending');
  return { success:true };
}
function creditNairaWallet(userId, amount) {
  const wallet = getUserWallet(userId);
  wallet.naira.balance += parseFloat(amount);
  wallet.naira.transactions.unshift({ id:'CRD'+Date.now(), type:'Credit', amount:parseFloat(amount), status:'completed', date:new Date().toISOString() });
  saveUserWallet(userId, wallet);
}

/* ---- Crypto Wallet ---- */
function sendCryptoFromWallet(userId, coin, amount, toAddress) {
  const wallet = getUserWallet(userId);
  const cw = wallet.crypto[coin];
  if (!cw) return { success:false, message:'Invalid coin.' };
  const avail = cw.balance - cw.locked;
  if (avail < parseFloat(amount)) return { success:false, message:`Insufficient ${coin} balance. Available: ${avail.toFixed(8)}` };
  cw.balance -= parseFloat(amount);
  saveUserWallet(userId, wallet);
  addTransaction(userId, `Send ${coin}`, `Sent ${amount} ${coin} → ${toAddress.slice(0,14)}…`, 0, 'completed');
  return { success:true };
}
function creditCryptoWallet(userId, coin, amount) {
  const wallet = getUserWallet(userId);
  if (!wallet.crypto[coin]) return;
  wallet.crypto[coin].balance += parseFloat(amount);
  saveUserWallet(userId, wallet);
}

/* ---- Staking ---- */
function getAllStakes() { return JSON.parse(localStorage.getItem(STAKES_KEY) || '[]'); }
function saveAllStakes(s) { localStorage.setItem(STAKES_KEY, JSON.stringify(s)); }

function createStake(userId, coin, amount, plan) {
  const wallet = getUserWallet(userId);
  const cw = wallet.crypto[coin];
  if (!cw) return { success:false, message:'Invalid coin.' };
  const avail = cw.balance - cw.locked;
  if (avail < parseFloat(amount)) return { success:false, message:`Insufficient available ${coin}. Available: ${avail.toFixed(8)}` };
  const rate    = STAKING_RATES[plan][coin] || 5;
  const days    = PLAN_DAYS[plan];
  const returns = parseFloat(amount) * (rate / 100);
  const endDate = new Date(Date.now() + days*24*60*60*1000).toISOString();
  cw.locked += parseFloat(amount);
  saveUserWallet(userId, wallet);
  const stake = { id:'STK'+Date.now(), userId, coin, amount:parseFloat(amount), plan, apy:rate, returns, startDate:new Date().toISOString(), endDate, status:'active' };
  const stakes = getAllStakes(); stakes.unshift(stake); saveAllStakes(stakes);
  addTransaction(userId, `Staking (${plan})`, `Staked ${amount} ${coin} — ${rate}% return`, parseFloat(amount), 'active');
  return { success:true, stake };
}
function getUserStakes(userId) { return getAllStakes().filter(s => s.userId === userId); }

function checkMaturedStakes(userId) {
  const stakes = getAllStakes();
  const now = new Date();
  let updated = false;
  stakes.forEach(s => {
    if (s.userId === userId && s.status === 'active' && new Date(s.endDate) <= now) {
      s.status = 'completed';
      creditCryptoWallet(userId, s.coin, s.amount + s.returns);
      const wallet = getUserWallet(userId);
      if (wallet.crypto[s.coin]) { wallet.crypto[s.coin].locked = Math.max(0, wallet.crypto[s.coin].locked - s.amount); saveUserWallet(userId, wallet); }
      updated = true;
    }
  });
  if (updated) saveAllStakes(stakes);
}

/* ============================================================
   SETTINGS ENGINE
   ============================================================ */
const BANK_KEY = 'ragnar_banks';
const KYC_KEY  = 'ragnar_kyc';

/* ---- Password ---- */
function changePassword(userId, oldPwd, newPwd) {
  const users = getUsers();
  const user  = users.find(u => u.id === userId);
  if (!user) return { success:false, message:'User not found.' };
  if (user.password !== oldPwd) return { success:false, message:'Current password is incorrect.' };
  if (newPwd.length < 8) return { success:false, message:'New password must be at least 8 characters.' };
  user.password = newPwd;
  saveUsers(users);
  return { success:true };
}

/* ---- Username Change (max 3 per year) ---- */
function changeUsername(userId, newUsername) {
  if (!newUsername || newUsername.trim().length < 3)
    return { success:false, message:'Username must be at least 3 characters.' };
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(newUsername))
    return { success:false, message:'Username can only contain letters, numbers and underscores (3-20 chars).' };

  const users = getUsers();
  const uname = newUsername.toLowerCase().trim();
  if (users.find(u => u.username && u.username.toLowerCase() === uname && u.id !== userId))
    return { success:false, message:'This username is already taken.' };

  const user = users.find(u => u.id === userId);
  if (!user) return { success:false, message:'User not found.' };

  /* Count changes this calendar year */
  const thisYear = new Date().getFullYear();
  const changes  = (user.usernameChanges || []).filter(c => new Date(c.date).getFullYear() === thisYear);
  if (changes.length >= 3) {
    return { success:false, message:`You have used all 3 username changes for ${thisYear}. Next allowed on 1 Jan ${thisYear + 1}.` };
  }

  const oldUsername = user.username;
  user.username = uname;
  if (!user.usernameChanges) user.usernameChanges = [];
  user.usernameChanges.push({ date: new Date().toISOString(), from: oldUsername, to: uname });
  saveUsers(users);
  return { success:true, changesLeft: 2 - changes.length };
}

function getUsernameChangesLeft(userId) {
  const users = getUsers();
  const user  = users.find(u => u.id === userId);
  if (!user) return 0;
  const thisYear = new Date().getFullYear();
  const used = (user.usernameChanges || []).filter(c => new Date(c.date).getFullYear() === thisYear).length;
  return Math.max(0, 3 - used);
}

/* ---- 2FA Login Verification ---- */
function loginCheck2FA(userId, enteredCode) {
  const users = getUsers();
  const user  = users.find(u => u.id === userId);
  if (!user || !user.twoFA) return { success:true }; // no 2FA needed
  if (!enteredCode) return { success:false, message:'Please enter your 2FA backup code.' };
  if ((user.twoFASecret || '').toUpperCase() !== enteredCode.trim().toUpperCase())
    return { success:false, message:'Invalid 2FA code. Check your saved backup code.' };
  return { success:true };
}

/* ---- Get user by email (for 2FA check at login) ---- */
function getUserByEmail(email) {
  const users = getUsers();
  return users.find(u => u.email.toLowerCase() === email.toLowerCase().trim()) || null;
}

function changePhone(userId, newPhone) {
  const users = getUsers();
  const user  = users.find(u => u.id === userId);
  if (!user) return { success:false, message:'User not found.' };
  if (!/^\+?[\d\s\-]{7,15}$/.test(newPhone)) return { success:false, message:'Invalid phone number.' };
  user.phone = newPhone;
  saveUsers(users);
  const session = getSession();
  if (session && session.id === userId) { session.phone = newPhone; sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
  return { success:true };
}

/* ---- Email ---- */
function changeEmail(userId, newEmail) {
  const users = getUsers();
  const existing = users.find(u => u.email === newEmail && u.id !== userId);
  if (existing) return { success:false, message:'Email already in use.' };
  const user = users.find(u => u.id === userId);
  if (!user) return { success:false, message:'User not found.' };
  user.email = newEmail;
  saveUsers(users);
  const session = getSession();
  if (session && session.id === userId) { session.email = newEmail; sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
  return { success:true };
}

/* ---- Bank Account ---- */
function getBanks() { return JSON.parse(localStorage.getItem(BANK_KEY) || '{}'); }
function saveBanks(b) { localStorage.setItem(BANK_KEY, JSON.stringify(b)); }

function getBankAccount(userId) { return getBanks()[userId] || null; }

function saveBankAccount(userId, bankName, accountNumber) {
  if (!bankName.trim()) return { success:false, message:'Enter bank name.' };
  if (!/^\d{10}$/.test(accountNumber)) return { success:false, message:'Account number must be 10 digits.' };
  const users = getUsers();
  const user  = users.find(u => u.id === userId);
  const lockedName = user ? user.name : '';
  const banks = getBanks();
  banks[userId] = { bankName: bankName.trim(), accountNumber, accountName: lockedName, updatedAt: new Date().toISOString() };
  saveBanks(banks);
  return { success:true };
}

/* ---- 2FA ---- */
function toggle2FA(userId) {
  const users = getUsers();
  const user  = users.find(u => u.id === userId);
  if (!user) return { success:false };
  user.twoFA = !user.twoFA;
  if (user.twoFA && !user.twoFASecret) {
    user.twoFASecret = Math.random().toString(36).slice(2,10).toUpperCase() + '-' + Math.random().toString(36).slice(2,10).toUpperCase();
  }
  saveUsers(users);
  return { success:true, enabled: user.twoFA, secret: user.twoFASecret };
}

function get2FAStatus(userId) {
  const users = getUsers();
  const user  = users.find(u => u.id === userId);
  return user ? { enabled: !!user.twoFA, secret: user.twoFASecret || null } : { enabled:false, secret:null };
}

/* ---- KYC ---- */
function getKYCStore() { return JSON.parse(localStorage.getItem(KYC_KEY) || '{}'); }
function saveKYCStore(k) { localStorage.setItem(KYC_KEY, JSON.stringify(k)); }

function submitKYC(userId, idType, idImageData, faceImageData) {
  if (!idImageData) return { success:false, message:'Please upload your ID document.' };
  if (!faceImageData) return { success:false, message:'Please capture your face photo.' };
  const store = getKYCStore();
  store[userId] = { idType, idImage: idImageData, faceImage: faceImageData, status:'pending', submittedAt: new Date().toISOString() };
  saveKYCStore(store);
  return { success:true };
}

function getKYCStatus(userId) { return getKYCStore()[userId] || null; }

function approveKYC(userId) {
  const store = getKYCStore();
  if (store[userId]) { store[userId].status = 'approved'; store[userId].approvedAt = new Date().toISOString(); saveKYCStore(store); }
  const users = getUsers();
  const user  = users.find(u => u.id === userId);
  if (user) { user.verified = true; saveUsers(users); }
}

function rejectKYC(userId, reason) {
  const store = getKYCStore();
  if (store[userId]) { store[userId].status = 'rejected'; store[userId].rejectedReason = reason || 'Documents unclear'; saveKYCStore(store); }
}

function isUserVerified(userId) {
  const users = getUsers();
  const user  = users.find(u => u.id === userId);
  return user ? !!user.verified : false;
}

/* ============================================================
   CHAT ENGINE
   ============================================================ */
const CHAT_KEY = 'ragnar_chats';

function getChats() { return JSON.parse(localStorage.getItem(CHAT_KEY) || '[]'); }
function saveChats(c) { localStorage.setItem(CHAT_KEY, JSON.stringify(c)); }

function createChat(userId, type, transactionId, txnData) {
  const chats  = getChats();
  const chatId = 'CHAT_' + Date.now();
  const chat   = {
    id: chatId, type, userId,
    transactionId: transactionId || null,
    status: 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    unreadAdmin: 1, unreadUser: 0,
    messages: []
  };

  /* Pin transaction tag as first message */
  if (type === 'transaction' && txnData) {
    chat.messages.push({
      id: 'MSG_' + Date.now(), senderId: 'system', senderName: 'System',
      text: 'Transaction initiated', msgType: 'txn_tag', txnData,
      createdAt: new Date().toISOString()
    });
    chat.messages.push({
      id: 'MSG_' + (Date.now() + 1), senderId: 'system', senderName: 'Ragnar Support',
      text: `Hi! Your ${txnData.type} transaction (#${txnData.id}) has been received. Our team is reviewing it now. We will update you here shortly.`,
      msgType: 'text', createdAt: new Date().toISOString()
    });
  } else {
    chat.messages.push({
      id: 'MSG_' + Date.now(), senderId: 'system', senderName: 'Ragnar Support',
      text: 'Welcome! How can we help you today? Our team typically replies within a few minutes.',
      msgType: 'text', createdAt: new Date().toISOString()
    });
  }

  chats.unshift(chat);
  saveChats(chats);
  return chat;
}

function sendChatMessage(chatId, senderId, senderName, text) {
  const chats = getChats();
  const chat  = chats.find(c => c.id === chatId);
  if (!chat || !text.trim()) return null;
  const msg = {
    id: 'MSG_' + Date.now(), senderId, senderName,
    text: text.trim(), msgType: 'text',
    createdAt: new Date().toISOString()
  };
  chat.messages.push(msg);
  chat.updatedAt = new Date().toISOString();
  if (senderId === 'admin') chat.unreadUser = (chat.unreadUser || 0) + 1;
  else chat.unreadAdmin = (chat.unreadAdmin || 0) + 1;
  saveChats(chats);
  return msg;
}

function getUserChats(userId) { return getChats().filter(c => c.userId === userId); }
function getAllChats() { return getChats(); }
function getChatById(chatId) { return getChats().find(c => c.id === chatId) || null; }

function markChatRead(chatId, role) {
  const chats = getChats();
  const chat  = chats.find(c => c.id === chatId);
  if (!chat) return;
  if (role === 'admin') chat.unreadAdmin = 0;
  else chat.unreadUser = 0;
  saveChats(chats);
}

function adminActionChat(chatId, action, amount) {
  /* action: 'approve' | 'reject' | 'fail' | 'decline' */
  const chats = getChats();
  const chat  = chats.find(c => c.id === chatId);
  if (!chat) return { success: false };

  const statusMap = { approve:'completed', reject:'rejected', fail:'failed', decline:'declined' };
  const newStatus = statusMap[action] || 'rejected';

  /* Update linked transaction */
  if (chat.transactionId) {
    const txns = getTransactions();
    const txn  = txns.find(t => t.id === chat.transactionId);
    if (txn) {
      txn.status = newStatus;
      if (action === 'approve' && amount) txn.paidNGN = parseFloat(amount);
      saveTransactions(txns);
    }
  }

  /* Credit naira wallet on approval */
  if (action === 'approve' && amount && parseFloat(amount) > 0) {
    const wallet = getUserWallet(chat.userId);
    const paid   = parseFloat(amount);
    wallet.naira.balance += paid;
    wallet.naira.transactions.unshift({
      id: 'NGN_' + Date.now(), type: 'credit',
      description: 'Payment for ' + (chat.transactionId || chatId),
      amount: paid, status: 'completed',
      createdAt: new Date().toISOString()
    });
    saveUserWallet(chat.userId, wallet);
  }

  /* System message to user */
  const msgs = {
    approve: `✅ Transaction approved! ₦${parseFloat(amount||0).toLocaleString('en-NG', {minimumFractionDigits:2})} has been credited to your Naira Wallet. Thank you for trading with Ragnar Solutions!`,
    reject:  '❌ Your transaction has been rejected. If you believe this is an error, please start a new support chat.',
    fail:    '⚠️ Your transaction failed during processing. Please contact support for assistance.',
    decline: '🚫 Your transaction was declined. Please ensure your submission meets our requirements and try again.'
  };
  chat.messages.push({
    id: 'MSG_' + Date.now(), senderId: 'admin', senderName: 'Ragnar Admin',
    text: msgs[action], msgType: 'action', action,
    createdAt: new Date().toISOString()
  });
  chat.status    = action === 'approve' ? 'closed' : 'open';
  chat.unreadUser = (chat.unreadUser || 0) + 1;
  chat.updatedAt  = new Date().toISOString();
  saveChats(chats);
  return { success: true };
}

function getTotalUnreadChats(userId) {
  return getUserChats(userId).reduce((sum, c) => sum + (c.unreadUser || 0), 0);
}

function getAdminUnreadChats() {
  return getAllChats().reduce((sum, c) => sum + (c.unreadAdmin || 0), 0);
}

/* ---- Image messages in chat ---- */
function sendChatImage(chatId, senderId, senderName, dataURL) {
  const chats = getChats();
  const chat  = chats.find(c => c.id === chatId);
  if (!chat) return null;
  const msg = {
    id: 'MSG_' + Date.now(), senderId, senderName,
    text: '[Image]', msgType: 'image', imageData: dataURL,
    createdAt: new Date().toISOString()
  };
  chat.messages.push(msg);
  chat.updatedAt = new Date().toISOString();
  if (senderId === 'admin') chat.unreadUser  = (chat.unreadUser  || 0) + 1;
  else                       chat.unreadAdmin = (chat.unreadAdmin || 0) + 1;
  saveChats(chats);
  return msg;
}

/* ---- USD → NGN exchange rate (admin-editable) ---- */
const USD_RATE_KEY = 'ragnar_usd_rate';
function getUSDRate() { return parseFloat(localStorage.getItem(USD_RATE_KEY) || '1600'); }
function saveUSDRate(rate) { localStorage.setItem(USD_RATE_KEY, parseFloat(rate).toString()); }

/* ---- Admin manual wallet fund ---- */
function manualFundWallet(userId, amount, description) {
  if (!userId || !amount || parseFloat(amount) <= 0)
    return { success: false, message: 'Enter a valid user and amount.' };
  const wallet = getUserWallet(userId);
  const paid   = parseFloat(amount);
  wallet.naira.balance += paid;
  wallet.naira.transactions.unshift({
    id: 'NGN_' + Date.now(), type: 'credit',
    description: description || 'Manual credit by admin',
    amount: paid, status: 'completed',
    createdAt: new Date().toISOString()
  });
  saveUserWallet(userId, wallet);
  return { success: true };
}
