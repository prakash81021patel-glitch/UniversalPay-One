/**
 * UniversalPay One - Client-Side Controller
 * Global UPI Architecture: India, Dubai (UAE), Singapore, France & Worldwide
 */

// ==========================================
// STATE MANAGEMENT
// ==========================================
let appState = {
  user: null,
  activeCountry: 'AE', // Default to Dubai/UAE or IN
  countries: [],
  exchangeRates: {},
  contacts: [],
  merchants: [],
  transactions: [],
  rechargePlans: {},
  // PIN Modal State
  pinBuffer: '',
  pinPurpose: null, // 'BALANCE' or 'PAYMENT' or 'RECHARGE'
  pendingActionPayload: null
};

// ==========================================
// AUDIO SYNTHESIZER (Google Pay Chime & Click)
// ==========================================
const AudioFX = {
  ctx: null,
  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
  },
  playSuccess() {
    try {
      this.init();
      const ctx = this.ctx;
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      
      // Chime note 1 (E5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.4);

      // Chime note 2 (G#5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(830.61, now + 0.12);
      gain2.gain.setValueAtTime(0.35, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.6);

      // Chime note 3 (B5 - Celebration Harmonic)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(987.77, now + 0.24);
      gain3.gain.setValueAtTime(0.4, now + 0.24);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.24);
      osc3.stop(now + 0.9);
    } catch (e) {
      console.log('Audio FX error:', e);
    }
  },
  playKeyClick() {
    try {
      this.init();
      const ctx = this.ctx;
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(350, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {}
  }
};

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) lucide.createIcons();
  
  await fetchUserProfileAndData();
  setupOtpInputListeners();
});

// Fetch initial profile & reference data
async function fetchUserProfileAndData() {
  try {
    const res = await fetch('/api/user/profile');
    const data = await res.json();
    if (data.success) {
      appState.user = data.user;
      appState.countries = data.countries;
      appState.exchangeRates = data.exchangeRates;
      appState.activeCountry = data.user.activeCountry || 'AE';

      renderCountrySelectorList();
      updateCountryHeaderUI();
      loadContactsAndMerchants();
      loadTransactions();
      loadHelpGuide();
    }
  } catch (err) {
    console.error('Failed to load profile:', err);
  }
}

// ==========================================
// 1. AUTH & ONBOARDING WORKFLOW
// ==========================================
let currentLoginDialCode = '+91';
let currentLoginCountryFlag = '🇮🇳';

async function handleSendOtp(isResend = false) {
  const phone = document.getElementById('loginPhoneInput').value.trim();
  if (!phone || phone.length < 5) {
    showToast('Please enter a valid mobile number', 'alert-circle');
    return;
  }

  showToast('Connecting to International Telecom Gateway...', 'clock');

  try {
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, countryCode: currentLoginDialCode })
    });
    const data = await res.json();

    if (data.success) {
      document.getElementById('phoneStepCard').classList.add('hidden');
      document.getElementById('otpStepCard').classList.remove('hidden');
      document.getElementById('otpTargetDisplay').innerText = `${currentLoginDialCode} ${phone}`;
      document.getElementById('demoOtpNumber').innerText = data.demoOtp;

      showToast(`OTP Sent! Test code is: ${data.demoOtp}`, 'check-circle');
      startResendCountdown();

      // Focus first OTP box
      setTimeout(() => {
        document.getElementById('otp_1').focus();
      }, 100);
    } else {
      showToast(data.message || 'Error sending OTP', 'alert-circle');
    }
  } catch (err) {
    showToast('Network error while requesting OTP', 'alert-circle');
  }
}

function backToPhoneStep() {
  document.getElementById('otpStepCard').classList.add('hidden');
  document.getElementById('phoneStepCard').classList.remove('hidden');
}

function autofillDemoOtp() {
  const demoCode = document.getElementById('demoOtpNumber').innerText.trim() || '4826';
  for (let i = 0; i < 4; i++) {
    const box = document.getElementById(`otp_${i + 1}`);
    if (box) box.value = demoCode[i] || '';
  }
  showToast('Demo OTP Auto-filled!', 'check');
}

function setupOtpInputListeners() {
  for (let i = 1; i <= 4; i++) {
    const box = document.getElementById(`otp_${i}`);
    if (!box) continue;

    box.addEventListener('input', (e) => {
      const val = e.target.value;
      if (val.length === 1 && i < 4) {
        document.getElementById(`otp_${i + 1}`).focus();
      }
    });

    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && i > 1) {
        document.getElementById(`otp_${i - 1}`).focus();
      }
    });
  }
}

let resendTimerInterval = null;
function startResendCountdown() {
  let count = 45;
  const timerCount = document.getElementById('timerCount');
  const timerText = document.getElementById('resendTimerText');
  const resendBtn = document.getElementById('btnResendOtp');

  timerText.classList.remove('hidden');
  resendBtn.classList.add('hidden');
  timerCount.innerText = count;

  if (resendTimerInterval) clearInterval(resendTimerInterval);

  resendTimerInterval = setInterval(() => {
    count--;
    timerCount.innerText = count;
    if (count <= 0) {
      clearInterval(resendTimerInterval);
      timerText.classList.add('hidden');
      resendBtn.classList.remove('hidden');
    }
  }, 1000);
}

async function handleVerifyOtp() {
  let otp = '';
  for (let i = 1; i <= 4; i++) {
    otp += document.getElementById(`otp_${i}`).value.trim();
  }

  if (otp.length < 4) {
    showToast('Please enter complete 4-digit OTP', 'alert-circle');
    return;
  }

  showToast('Authenticating with NPCI / Telecom Gateway...', 'lock');

  try {
    const phone = document.getElementById('loginPhoneInput').value.trim();
    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, countryCode: currentLoginDialCode, otp })
    });
    const data = await res.json();

    if (data.success) {
      AudioFX.playSuccess();
      showToast('Login Successful! Welcome.', 'check-circle');

      // Switch to main dashboard
      setTimeout(() => {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainAppScreen').classList.remove('hidden');
        refreshDashboard();
      }, 500);
    } else {
      showToast(data.message || 'Invalid OTP', 'alert-circle');
    }
  } catch (err) {
    showToast('Verification failed. Try again.', 'alert-circle');
  }
}

// ==========================================
// 2. DASHBOARD & GLOBAL COUNTRY CONTROLLER
// ==========================================
let isPinAuthenticated = false;
let isBalanceRevealed = false;

function updateAllCurrencyUI() {
  const current = appState.countries.find(c => c.code === appState.activeCountry) || appState.countries[0];
  if (!current) return;

  const rate = appState.exchangeRates[current.currency] || 1.0;
  const baseInr = (appState.user && appState.user.bankAccounts && appState.user.bankAccounts[0])
    ? appState.user.bankAccounts[0].balanceINR
    : 84500.50;
  const walletBaseInr = (appState.user && appState.user.walletBalanceINR)
    ? appState.user.walletBalanceINR
    : 4250.00;

  // 1. Header Country Pill
  const flagEl = document.getElementById('activeCountryFlag');
  const nameEl = document.getElementById('activeCountryCodeName');
  if (flagEl) flagEl.innerText = current.flag;
  if (nameEl) nameEl.innerText = `${current.name} (${current.currency})`;

  // 2. Live Roaming Banner
  const bannerRateText = document.getElementById('currencyRateText');
  if (bannerRateText) {
    if (current.currency === 'INR') {
      bannerRateText.innerText = 'Domestic UPI Active • 100% Zero Fee';
    } else {
      bannerRateText.innerText = `1 ${current.currency} ≈ ₹ ${rate.toFixed(2)} INR • 0% Markup (NIPL Verified)`;
    }
  }

  // 3. Hero Card Title
  const balTitle = document.getElementById('balanceTitleDisplay');
  if (balTitle) {
    balTitle.innerText = (current.currency === 'INR') 
      ? 'Linked Bank Balance (India ₹)' 
      : `Linked Bank Balance (${current.name} • ${current.currency})`;
  }

  // 4. Hero Card Bank Balance (Dynamic Foreign & INR)
  const foreignBal = (baseInr / rate).toFixed(2);
  const formattedForeign = (current.currency === 'INR')
    ? ('₹ ' + baseInr.toLocaleString('en-IN', { minimumFractionDigits: 2 }))
    : (`${parseFloat(foreignBal).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${current.currency} (${current.symbol})`);

  const subInrText = (current.currency === 'INR')
    ? 'Primary Account • HDFC Bank (•••• 5642)'
    : `≈ ₹ ${baseInr.toLocaleString('en-IN', { minimumFractionDigits: 2 })} INR • Rate: 1 ${current.currency} = ₹${rate.toFixed(2)}`;

  const revBalDisplay = document.getElementById('revealedBalanceDisplay');
  const revBalSubInr = document.getElementById('revealedBalanceSubInr');
  if (revBalDisplay) revBalDisplay.innerText = formattedForeign;
  if (revBalSubInr) revBalSubInr.innerText = subInrText;

  // 5. Hero Card Wallet Peek
  const walletForeign = (walletBaseInr / rate).toFixed(2);
  const heroWallet = document.getElementById('heroWalletDisplay');
  if (heroWallet) {
    heroWallet.innerText = (current.currency === 'INR')
      ? `Wallet: ₹ ${walletBaseInr.toLocaleString('en-IN')}`
      : `Wallet: ${parseFloat(walletForeign).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${current.currency}`;
  }

  // 6. Rewards Promo Banner
  const promoP = document.querySelector('.promo-content p');
  if (promoP) {
    if (current.currency === 'AED') {
      promoP.innerText = 'Earn up to 25 AED cashback on your first Dubai payment!';
    } else if (current.currency === 'EUR') {
      promoP.innerText = 'Earn up to 6 EUR cashback on your European payment!';
    } else if (current.currency === 'SGD') {
      promoP.innerText = 'Earn up to 10 SGD cashback on PayNow UPI!';
    } else {
      promoP.innerText = 'Earn up to ₹500 / 25 AED cashback on your first international payment';
    }
  }

  // 7. Update Balance Modal amounts
  const balAmountInr = document.getElementById('balAmountInr');
  const balAmountForeign = document.getElementById('balAmountForeign');
  if (balAmountInr) {
    balAmountInr.innerText = formattedForeign;
  }
  if (balAmountForeign) {
    balAmountForeign.innerHTML = (current.currency === 'INR')
      ? 'Primary Savings Account • Verified Core Banking'
      : `Equivalent to <strong>₹ ${baseInr.toLocaleString('en-IN', { minimumFractionDigits: 2 })} INR</strong> in India`;
  }

  if (window.lucide) lucide.createIcons();
}

function updateCountryHeaderUI() {
  updateAllCurrencyUI();
}

function selectCountry(countryCode, context = 'app') {
  if (context === 'login') {
    const country = appState.countries.find(c => c.code === countryCode);
    if (country) {
      currentLoginDialCode = country.dialCode;
      currentLoginCountryFlag = country.flag;
      document.getElementById('loginSelectedFlag').innerText = country.flag;
      document.getElementById('loginSelectedCode').innerText = country.dialCode;
    }
    closeModal('countryPickerModal');
    return;
  }

  // 1. INSTANT AUDIO FEEDBACK & MODAL CLOSE (0ms lag!)
  AudioFX.playKeyClick();
  closeModal('countryPickerModal');

  // 2. INSTANT STATE & CURRENCY RECALCULATION
  appState.activeCountry = countryCode;
  const current = appState.countries.find(c => c.code === countryCode) || appState.countries[0];

  // 3. UPDATE ALL CURRENCIES & AMOUNTS IN 0ms!
  updateAllCurrencyUI();

  // 4. SHOW TOAST IMMEDIATELY
  showToast(`Switched to ${current.name} • Currency: ${current.currency} (${current.symbol})`, 'globe');

  // 5. ASYNC BACKGROUND SYNC (Does NOT block the user)
  fetch('/api/user/set-country', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ countryCode })
  }).catch(() => {});
}

function renderCountrySelectorList(context = 'app') {
  const container = document.getElementById('countryListContainer');
  if (!container) return;

  const currentCode = (context === 'login') ? currentLoginDialCode : appState.activeCountry;

  container.innerHTML = appState.countries.map(c => {
    const isSelected = (context === 'login') ? (c.dialCode === currentLoginDialCode) : (c.code === appState.activeCountry);
    return `
      <div class="country-option-item ${isSelected ? 'active' : ''}" onclick="selectCountry('${c.code}', '${context}')">
        <div class="country-option-left">
          <span class="country-flag-lg">${c.flag}</span>
          <div>
            <div class="country-opt-name">${c.name} (${c.dialCode})</div>
            <div class="country-opt-network">${c.upiPartner}</div>
          </div>
        </div>
        <div class="country-option-right">
          <div class="country-opt-currency">${c.currency} (${c.symbol})</div>
          ${isSelected ? `<span class="country-selected-check"><i data-lucide="check" class="icon-xs"></i></span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function openCountryPickerModal(context = 'app') {
  renderCountrySelectorList(context);
  openModal('countryPickerModal');
}

// ==========================================
// 3. PEOPLE & MERCHANTS CONTROLLER
// ==========================================
async function loadContactsAndMerchants() {
  try {
    const res = await fetch('/api/contacts');
    const data = await res.json();
    if (data.success) {
      appState.contacts = data.contacts;
      appState.merchants = data.merchants;
      renderPeopleAvatars();
      renderMerchantsRow();
      renderContactsModalList();
    }
  } catch (err) {
    console.error(err);
  }
}

function renderPeopleAvatars() {
  const row = document.getElementById('peopleAvatarsRow');
  if (!row) return;

  row.innerHTML = appState.contacts.map(c => {
    const country = appState.countries.find(ct => ct.code === c.country) || { flag: '🇮🇳' };
    return `
      <div class="person-avatar-col" onclick="initiatePaymentToPerson('${c.upiId}', '${c.name}', '${c.country}')">
        <div class="person-bubble">
          <span>${c.avatar}</span>
          <span class="flag-badge-corner">${country.flag}</span>
        </div>
        <div class="person-name">${c.name.split(' ')[0]}</div>
      </div>
    `;
  }).join('');
}

function renderMerchantsRow() {
  const row = document.getElementById('merchantsRow');
  if (!row) return;

  row.innerHTML = appState.merchants.map(m => {
    const country = appState.countries.find(ct => ct.code === m.country) || { flag: '🌐' };
    return `
      <div class="merchant-card" onclick="initiatePaymentToMerchant('${m.upiId}', '${m.name}', '${m.country}', '${m.currency}')">
        <div class="merchant-icon-bubble">${m.icon}</div>
        <div class="merchant-name">${m.name}</div>
        <div class="merchant-country-tag">${country.flag} ${m.category}</div>
      </div>
    `;
  }).join('');
}

function renderContactsModalList() {
  const list = document.getElementById('modalContactsList');
  if (!list) return;

  list.innerHTML = appState.contacts.map(c => `
    <div class="country-option-item" onclick="closeModal('phonePayModal'); initiatePaymentToPerson('${c.upiId}', '${c.name}', '${c.country}')">
      <div class="country-option-left">
        <div class="person-bubble" style="width: 40px; height: 40px; font-size: 18px;">${c.avatar}</div>
        <div>
          <div class="country-opt-name">${c.name}</div>
          <div class="country-opt-network">${c.phone} • ${c.upiId}</div>
        </div>
      </div>
      <button class="btn-inside-input" style="position: static;">Pay</button>
    </div>
  `).join('');
}

// ==========================================
// 4. PAYMENTS & PIN EXECUTION ENGINE
// ==========================================
let currentPaymentPayload = {
  paymentType: 'UPI_TRANSFER',
  recipientTitle: '',
  recipientIdentifier: '',
  amount: 0,
  currency: 'INR',
  note: ''
};

// Merchant currencies that are FIXED to their own country (QR / preset international)
// These are never overridden by active country selection
const FIXED_CURRENCY_VPA_PATTERNS = [
  { pattern: '@mashreq', currency: 'AED', country: 'AE' },
  { pattern: '@neopay',  currency: 'AED', country: 'AE' },
  { pattern: '@lyra',    currency: 'EUR', country: 'FR' },
  { pattern: '@paynow',  currency: 'SGD', country: 'SG' },
  { pattern: 'burjkhalifa', currency: 'AED', country: 'AE' },
  { pattern: 'toureiffel',  currency: 'EUR', country: 'FR' },
  { pattern: 'jewelchangi', currency: 'SGD', country: 'SG' },
  { pattern: 'carrefour.dubai', currency: 'AED', country: 'AE' },
];

// Return the fixed currency if VPA is a known international merchant, else null
function detectMerchantCurrency(vpa) {
  if (!vpa) return null;
  const lowerVpa = vpa.toLowerCase();
  for (const m of FIXED_CURRENCY_VPA_PATTERNS) {
    if (lowerVpa.includes(m.pattern.toLowerCase())) {
      return { currency: m.currency, country: m.country };
    }
  }
  return null;
}

function preparePaymentModal(recipientTitle, recipientVpa, recipientCountryCode, suggestedCurrency, defaultAmount = '') {
  // 1. Check if this VPA is a FIXED international merchant (e.g. Carrefour Dubai → AED)
  const merchantFixed = detectMerchantCurrency(recipientVpa);

  let finalCurrency, finalCountryCode;

  if (merchantFixed) {
    // International merchant with a fixed currency → always use merchant's currency
    finalCurrency = merchantFixed.currency;
    finalCountryCode = merchantFixed.country;
  } else {
    // Generic payment (person, phone, bank, custom UPI ID) →
    // Use the ACTIVE COUNTRY's currency (the one user selected in header)
    const activeCountryObj = appState.countries.find(c => c.code === appState.activeCountry) || appState.countries[0];
    finalCurrency = activeCountryObj.currency;
    finalCountryCode = activeCountryObj.code;
  }

  const finalCountryObj = appState.countries.find(c => c.code === finalCountryCode) || appState.countries[0];

  currentPaymentPayload = {
    paymentType: 'UPI_TRANSFER',
    recipientTitle: recipientTitle,
    recipientIdentifier: recipientVpa,
    amount: defaultAmount ? parseFloat(defaultAmount) : 0,
    currency: finalCurrency,
    note: ''
  };

  document.getElementById('payRecipientName').innerText = recipientTitle;
  document.getElementById('payRecipientVpa').innerText = recipientVpa;
  document.getElementById('payCurrencyTag').innerText = finalCurrency;
  document.getElementById('payAmountInput').value = defaultAmount;

  // Country context tag in modal
  const modalTitle = document.getElementById('paymentModalTitle');
  if (modalTitle) {
    modalTitle.innerText = `Pay in ${finalCountryObj.flag} ${finalCountryObj.name} (${finalCurrency})`;
  }

  // Recipient flag
  const recipientAvatar = document.getElementById('payRecipientAvatar');
  if (recipientAvatar) {
    recipientAvatar.innerText = merchantFixed ? finalCountryObj.flag : '👤';
  }

  // Update bank selector to show currency
  const bankAccSub = document.querySelector('.bank-acc-sub');
  if (bankAccSub && appState.user && appState.user.bankAccounts) {
    const primaryBank = appState.user.bankAccounts.find(b => b.isPrimary) || appState.user.bankAccounts[0];
    const rate = appState.exchangeRates[finalCurrency] || 1.0;
    const availForeign = (finalCurrency === 'INR')
      ? `₹ ${primaryBank.balanceINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
      : `${(primaryBank.balanceINR / rate).toFixed(2)} ${finalCurrency} (≈ ₹${primaryBank.balanceINR.toLocaleString('en-IN')})`;
    bankAccSub.innerText = `${primaryBank.accountType} •••• ${primaryBank.accountNumber.slice(-4)} • ${availForeign}`;
  }

  // Rate preview calculation
  const fxRate = appState.exchangeRates[finalCurrency] || 1.0;
  document.getElementById('appliedFxRateText').innerText =
    (finalCurrency === 'INR') ? 'Domestic UPI • Zero Fee' : `1 ${finalCurrency} = ₹ ${fxRate.toFixed(2)} INR`;

  handleAmountInput(defaultAmount);
  openModal('paymentModal');
}

function handleAmountInput(val) {
  const amt = parseFloat(val) || 0;
  currentPaymentPayload.amount = amt;
  const currency = currentPaymentPayload.currency;
  const rate = appState.exchangeRates[currency] || 1.0;
  const inrVal = (amt * rate).toFixed(2);

  const previewCard = document.getElementById('conversionPreviewCard');
  const inrText = document.getElementById('inrConversionText');

  if (currency === 'INR') {
    previewCard.classList.add('hidden');
  } else {
    previewCard.classList.remove('hidden');
    inrText.innerText = `₹ ${parseFloat(inrVal).toLocaleString('en-IN', { minimumFractionDigits: 2 })} INR`;
  }
}

function triggerPinAndExecutePayment() {
  const amount = parseFloat(document.getElementById('payAmountInput').value) || 0;
  if (amount <= 0) {
    showToast('Please enter an amount greater than 0', 'alert-circle');
    return;
  }

  currentPaymentPayload.amount = amount;
  currentPaymentPayload.note = document.getElementById('payNoteInput').value.trim() || 'UniversalPay Transfer';

  closeModal('paymentModal');
  openUpiPinModal('PAYMENT', currentPaymentPayload);
}

// 4-Digit UPI PIN Interface (Keypad & Mask Dots)
function openUpiPinModal(purpose, payload = null) {
  appState.pinBuffer = '';
  appState.pinPurpose = purpose;
  appState.pendingActionPayload = payload;

  updatePinDots();
  const subtext = document.getElementById('pinModalSubtext');
  if (purpose === 'BALANCE') {
    subtext.innerText = 'Checking balance for HDFC Bank';
  } else if (purpose === 'RECHARGE') {
    subtext.innerText = `Authorizing mobile recharge of ${payload.currency || '₹'} ${payload.amount}`;
  } else {
    subtext.innerText = `Authorizing payment to ${payload.recipientTitle}`;
  }

  openModal('upiPinModal');
}

function pressPinKey(digit) {
  AudioFX.playKeyClick();
  if (appState.pinBuffer.length < 4) {
    appState.pinBuffer += digit;
    updatePinDots();

    if (appState.pinBuffer.length === 4) {
      setTimeout(() => {
        submitUpiPin();
      }, 250);
    }
  }
}

function deletePinKey() {
  AudioFX.playKeyClick();
  if (appState.pinBuffer.length > 0) {
    appState.pinBuffer = appState.pinBuffer.slice(0, -1);
    updatePinDots();
  }
}

function cancelPinModal() {
  appState.pinBuffer = '';
  closeModal('upiPinModal');
}

function updatePinDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById(`dot_${i}`);
    if (dot) {
      if (i < appState.pinBuffer.length) {
        dot.classList.add('filled');
      } else {
        dot.classList.remove('filled');
      }
    }
  }
}

async function submitUpiPin() {
  const enteredPin = appState.pinBuffer;
  const purpose = appState.pinPurpose;
  const payload = appState.pendingActionPayload;

  closeModal('upiPinModal');

  if (purpose === 'BALANCE') {
    await executeCheckBalance(enteredPin);
  } else if (purpose === 'PAYMENT') {
    await executePaymentWithPin(enteredPin, payload);
  } else if (purpose === 'RECHARGE') {
    await executeRechargeWithPin(enteredPin, payload);
  }
}

// Payment Request to Server
async function executePaymentWithPin(upiPin, payload) {
  showToast('Connecting to NPCI & Partner Network...', 'clock');

  try {
    const res = await fetch('/api/payment/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        upiPin: upiPin
      })
    });
    const data = await res.json();

    if (data.success) {
      AudioFX.playSuccess();
      launchConfetti();

      // Show Fullscreen Success
      const txn = data.transaction;
      document.getElementById('successAmountDisplay').innerText = `${txn.originalCurrency} ${txn.originalAmount.toFixed(2)}`;
      document.getElementById('successRecipientDisplay').innerText = `Paid to ${txn.title}`;
      document.getElementById('successUtrDisplay').innerText = txn.utrNumber;
      document.getElementById('successBankDisplay').innerText = txn.bankUsed;
      document.getElementById('successFxDisplay').innerText = `${txn.originalAmount} ${txn.originalCurrency} ≈ ₹ ${txn.amountINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })} INR`;
      document.getElementById('successTimeDisplay').innerText = new Date(txn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      document.getElementById('paymentSuccessScreen').classList.remove('hidden');

      // Update in-memory balance & transactions
      if (appState.user && appState.user.bankAccounts) {
        appState.user.bankAccounts[0].balanceINR = data.remainingBalanceINR;
      }
      loadTransactions();
    } else {
      showToast(data.message || 'Payment authorization failed', 'alert-circle');
    }
  } catch (err) {
    showToast('Payment failed due to network timeout', 'alert-circle');
  }
}

function dismissSuccessScreen() {
  document.getElementById('paymentSuccessScreen').classList.add('hidden');
}

// ==========================================
// 5. CHECK BANK BALANCE & EYE TOGGLE
// ==========================================
function promptUpiPinForBalance() {
  openUpiPinModal('BALANCE');
}

function handleBalanceCheckClick() {
  const maskedEl = document.getElementById('maskedBalanceDisplay');
  const revealedEl = document.getElementById('revealedBalanceWrapper');
  const eyeIcon = document.getElementById('balanceEyeIcon');
  const btnText = document.getElementById('balanceBtnText');

  if (!isPinAuthenticated) {
    promptUpiPinForBalance();
    return;
  }

  isBalanceRevealed = !isBalanceRevealed;
  if (isBalanceRevealed) {
    maskedEl.classList.add('hidden');
    revealedEl.classList.remove('hidden');
    eyeIcon.setAttribute('data-lucide', 'eye-off');
    btnText.innerText = 'Hide';
    AudioFX.playKeyClick();
  } else {
    maskedEl.classList.remove('hidden');
    revealedEl.classList.add('hidden');
    eyeIcon.setAttribute('data-lucide', 'eye');
    btnText.innerText = 'Check Balance';
    AudioFX.playKeyClick();
  }
  if (window.lucide) lucide.createIcons();
}

async function executeCheckBalance(upiPin) {
  showToast('Fetching balance from Core Banking...', 'landmark');

  try {
    const res = await fetch('/api/bank/balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: appState.user.bankAccounts[0].id,
        upiPin: upiPin
      })
    });
    const data = await res.json();

    if (data.success) {
      AudioFX.playSuccess();
      launchConfetti();

      isPinAuthenticated = true;
      isBalanceRevealed = true;

      // Unmask hero balance
      document.getElementById('maskedBalanceDisplay').classList.add('hidden');
      document.getElementById('revealedBalanceWrapper').classList.remove('hidden');
      document.getElementById('balanceEyeIcon').setAttribute('data-lucide', 'eye-off');
      document.getElementById('balanceBtnText').innerText = 'Hide';

      updateAllCurrencyUI();

      openModal('balanceModal');
    } else {
      showToast(data.message || 'Incorrect PIN. Try demo PIN: 1234', 'alert-circle');
    }
  } catch (err) {
    // Offline simulation fallback for demo
    if (upiPin === '1234') {
      AudioFX.playSuccess();
      launchConfetti();

      isPinAuthenticated = true;
      isBalanceRevealed = true;

      document.getElementById('maskedBalanceDisplay').classList.add('hidden');
      document.getElementById('revealedBalanceWrapper').classList.remove('hidden');
      document.getElementById('balanceEyeIcon').setAttribute('data-lucide', 'eye-off');
      document.getElementById('balanceBtnText').innerText = 'Hide';

      updateAllCurrencyUI();
      openModal('balanceModal');
    } else {
      showToast('Incorrect UPI PIN. Demo PIN is 1234', 'alert-circle');
    }
  }
}

// ==========================================
// 6. QR SCANNER & PRESETS
// ==========================================
let qrStream = null;

function openQrPaymentModal() {
  openModal('qrScannerModal');
}

async function startCameraScanner() {
  const video = document.getElementById('qrCameraVideo');
  const placeholder = document.getElementById('qrCameraPlaceholder');

  try {
    qrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = qrStream;
    video.classList.remove('hidden');
    placeholder.classList.add('hidden');
    showToast('Scanning camera active... Point at any UPI QR', 'camera');
  } catch (err) {
    showToast('Camera access not supported or denied in browser. Use demo QRs below!', 'info');
  }
}

function stopCameraScanner() {
  if (qrStream) {
    qrStream.getTracks().forEach(t => t.stop());
    qrStream = null;
  }
  const video = document.getElementById('qrCameraVideo');
  const placeholder = document.getElementById('qrCameraPlaceholder');
  if (video) video.classList.add('hidden');
  if (placeholder) placeholder.classList.remove('hidden');
}

function simulateQrScan(vpa, title, countryCode, currency, defaultAmount) {
  stopCameraScanner();
  closeModal('qrScannerModal');
  preparePaymentModal(title, vpa, countryCode, currency, defaultAmount);
}

function showMyQrCodeModal() {
  stopCameraScanner();
  closeModal('qrScannerModal');
  openModal('myQrModal');
}

// ==========================================
// 7. UPI ID & VPA VERIFICATION
// ==========================================
function openUpiIdModal() {
  openModal('upiIdModal');
}

function fillVpa(vpa) {
  document.getElementById('inputVpaField').value = vpa;
}

async function handleVerifyAndPayUpiId() {
  const vpa = document.getElementById('inputVpaField').value.trim();
  if (!vpa) return;

  showToast('Verifying UPI ID with NPCI Directory...', 'check');

  try {
    const res = await fetch('/api/payment/verify-vpa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vpa })
    });
    const data = await res.json();

    if (data.success) {
      closeModal('upiIdModal');
      preparePaymentModal(data.verifiedName, data.vpa, data.country.code, data.country.currency);
    } else {
      showToast('Could not verify UPI ID', 'alert-circle');
    }
  } catch (err) {
    showToast('Network error while verifying VPA', 'alert-circle');
  }
}

// ==========================================
// 8. PHONE PAY & CONTACTS
// ==========================================
function openPhonePayModal() {
  openModal('phonePayModal');
}

function initiatePaymentToPerson(upiId, name, countryCode) {
  const country = appState.countries.find(c => c.code === countryCode) || { currency: 'INR' };
  preparePaymentModal(name, upiId, countryCode, country.currency);
}

function initiatePaymentToMerchant(upiId, name, countryCode, currency) {
  preparePaymentModal(name, upiId, countryCode, currency);
}

function handlePayPhoneDirect() {
  const phone = document.getElementById('payPhoneInput').value.trim();
  if (!phone) return;
  closeModal('phonePayModal');
  preparePaymentModal(`Payment to ${phone}`, `${phone.replace(/\D/g, '')}@universalpay`, 'IN', 'INR');
}

// ==========================================
// 9. BANK TRANSFER
// ==========================================
function openBankTransferModal() {
  openModal('bankTransferModal');
}

function handleBankTransferSubmit() {
  const acc1 = document.getElementById('bankAccNo').value.trim();
  const acc2 = document.getElementById('bankAccNoConfirm').value.trim();
  const ifsc = document.getElementById('bankIfsc').value.trim().toUpperCase();
  const name = document.getElementById('bankHolderName').value.trim();

  if (acc1 !== acc2) {
    showToast('Bank Account Numbers do not match!', 'alert-circle');
    return;
  }

  closeModal('bankTransferModal');
  preparePaymentModal(`Bank Transfer: ${name}`, `${acc1}@${ifsc}.ifsc.npci`, 'IN', 'INR');
}

function lookupIfsc() {
  const ifsc = document.getElementById('bankIfsc').value.trim().toUpperCase();
  if (ifsc.startsWith('HDFC')) {
    showToast('Verified: HDFC Bank, Fort Mumbai Branch', 'check-circle');
  } else if (ifsc.startsWith('SBIN')) {
    showToast('Verified: State Bank of India, Main Branch', 'check-circle');
  } else if (ifsc.startsWith('MSREQ')) {
    showToast('Verified: Mashreq Bank Dubai (UAE IBAN Network)', 'check-circle');
  } else {
    showToast(`Branch verified for code: ${ifsc}`, 'check-circle');
  }
}

// Self Transfer
function openSelfTransferModal() {
  preparePaymentModal('Self Transfer: SBI NRE Account', 'prakash.nre@oksbi', 'IN', 'INR');
}

// ==========================================
// 10. MOBILE RECHARGE (INDIA & GLOBAL)
// ==========================================
let currentRechargeCountry = 'IN';

function openMobileRechargeModal() {
  switchRechargeCountry('IN');
  openModal('mobileRechargeModal');
}

async function switchRechargeCountry(countryCode) {
  currentRechargeCountry = countryCode;

  // Update tabs
  ['IN', 'AE', 'SG', 'FR'].forEach(c => {
    const tab = document.getElementById(`tabRecharge${c}`);
    if (tab) {
      if (c === countryCode) tab.classList.add('active');
      else tab.classList.remove('active');
    }
  });

  const plansContainer = document.getElementById('rechargePlansContainer');
  plansContainer.innerHTML = '<div style="text-align: center; padding: 20px;">Loading telecom plans...</div>';

  try {
    const res = await fetch(`/api/recharge/plans?country=${countryCode}`);
    const data = await res.json();
    if (data.success) {
      renderRechargePlans(data.plans, countryCode);
    }
  } catch (err) {
    plansContainer.innerHTML = '<div>Failed to load plans</div>';
  }
}

function renderRechargePlans(plans, countryCode) {
  const container = document.getElementById('rechargePlansContainer');
  if (!container) return;

  const country = appState.countries.find(c => c.code === countryCode) || { symbol: '₹' };

  container.innerHTML = plans.map(p => `
    <div class="plan-card" onclick="selectRechargePlan('${p.operator}', '${p.id}', ${p.price}, '${p.currency || 'INR'}')">
      <div class="plan-left-meta">
        <span class="plan-operator">${p.operator} • ${p.circle}</span>
        <span class="plan-benefit">${p.data}</span>
        <span class="plan-desc">${p.desc}</span>
      </div>
      <div class="plan-price-box">
        <div class="plan-price-main">${p.currency || '₹'} ${p.price}</div>
        <div class="plan-validity">${p.validity}</div>
      </div>
    </div>
  `).join('');
}

function selectRechargePlan(operator, planId, price, currency) {
  const mobile = document.getElementById('rechargeMobileInput').value.trim();
  if (!mobile) {
    showToast('Please enter mobile number to recharge', 'alert-circle');
    return;
  }

  closeModal('mobileRechargeModal');

  // Trigger PIN modal for recharge authorization
  openUpiPinModal('RECHARGE', {
    mobileNumber: mobile,
    operator: operator,
    planId: planId,
    amount: price,
    currency: currency
  });
}

async function executeRechargeWithPin(upiPin, payload) {
  showToast('Contacting Telecom Operator...', 'smartphone');

  try {
    const res = await fetch('/api/recharge/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, upiPin })
    });
    const data = await res.json();

    if (data.success) {
      AudioFX.playSuccess();
      launchConfetti();
      showToast(data.message, 'check-circle');

      // Update transactions
      loadTransactions();
    } else {
      showToast(data.message || 'Recharge failed', 'alert-circle');
    }
  } catch (err) {
    showToast('Recharge request timed out', 'alert-circle');
  }
}

// Bills Modal
function openBillsModal() {
  preparePaymentModal('Electricity & Utilities Board', 'billpay.electricity@universalpay', 'IN', 'INR', '1450');
}

// ==========================================
// 11. REWARDS & SCRATCH CARDS
// ==========================================
function openScratchCardModal() {
  const cover = document.getElementById('scratchCover');
  cover.classList.remove('scratched');
  openModal('scratchCardModal');
}

function scratchRewardCard() {
  const cover = document.getElementById('scratchCover');
  if (!cover.classList.contains('scratched')) {
    cover.classList.add('scratched');
    AudioFX.playSuccess();
    launchConfetti();
    showToast('Won ₹75 Global Cashback! Credited to Wallet.', 'gift');
  }
}

// ==========================================
// 12. TRANSACTIONS & RECEIPTS
// ==========================================
async function loadTransactions() {
  try {
    const res = await fetch('/api/transactions');
    const data = await res.json();
    if (data.success) {
      appState.transactions = data.transactions;
      renderRecentTransactions();
    }
  } catch (err) {
    console.error(err);
  }
}

function renderRecentTransactions() {
  const list = document.getElementById('recentTransactionsList');
  if (!list) return;

  list.innerHTML = appState.transactions.slice(0, 5).map(t => {
    const isCredit = t.type === 'CREDIT';
    const country = appState.countries.find(c => c.code === t.country) || { flag: '🇮🇳' };
    const dateStr = new Date(t.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

    return `
      <div class="txn-item-card" onclick="showReceiptDetails('${t.id}')">
        <div class="txn-left">
          <div class="txn-flag-avatar">${country.flag}</div>
          <div>
            <div class="txn-title">${t.title}</div>
            <div class="txn-date">${dateStr} • ${t.bankUsed.split(' ')[0]}</div>
          </div>
        </div>
        <div class="txn-right">
          <div class="${isCredit ? 'txn-amount-credit' : 'txn-amount-debit'}">
            ${isCredit ? '+' : '-'} ₹ ${t.amountINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          ${t.originalCurrency !== 'INR' ? `<div class="txn-fx-note">${t.originalAmount} ${t.originalCurrency}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function showReceiptDetails(txnId) {
  const txn = appState.transactions.find(t => t.id === txnId);
  if (!txn) return;

  document.getElementById('successAmountDisplay').innerText = `₹ ${txn.amountINR.toFixed(2)}`;
  document.getElementById('successRecipientDisplay').innerText = txn.title;
  document.getElementById('successUtrDisplay').innerText = txn.utrNumber;
  document.getElementById('successBankDisplay').innerText = txn.bankUsed;
  document.getElementById('successFxDisplay').innerText = `${txn.originalAmount} ${txn.originalCurrency} ≈ ₹ ${txn.amountINR} INR`;
  document.getElementById('successTimeDisplay').innerText = new Date(txn.timestamp).toLocaleString();

  document.getElementById('paymentSuccessScreen').classList.remove('hidden');
}

function downloadReceipt() {
  showToast('Official NPCI Receipt downloaded to device!', 'download');
}

// ==========================================
// 13. HELP & GUIDE WORKFLOW
// ==========================================
async function loadHelpGuide() {
  try {
    const res = await fetch('/api/help/guide');
    const data = await res.json();
    if (data.success && data.guide) {
      renderHelpAccordion(data.guide.sections);
    }
  } catch (err) {
    console.error(err);
  }
}

function renderHelpAccordion(sections) {
  const container = document.getElementById('guideAccordionList');
  if (!container) return;

  container.innerHTML = sections.map((s, idx) => `
    <div class="guide-item">
      <div class="guide-header" onclick="toggleGuideItem('guide_body_${idx}')">
        <span>${s.heading}</span>
        <i data-lucide="chevron-down" class="icon-sm"></i>
      </div>
      <div class="guide-body ${idx === 0 ? '' : 'hidden'}" id="guide_body_${idx}">
        ${s.content || (s.steps ? s.steps.join('\n\n') : s.contact)}
      </div>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

function toggleGuideItem(id) {
  const body = document.getElementById(id);
  if (body) {
    body.classList.toggle('hidden');
  }
}

function openHelpGuideModal(topic = null) {
  openModal('helpGuideModal');
}

// ==========================================
// 14. UI MODALS & HELPERS
// ==========================================
function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) {
    el.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) {
    el.classList.add('hidden');
  }
  if (modalId === 'qrScannerModal') {
    stopCameraScanner();
  }
}

function handleModalOverlayClick(event, modalId) {
  if (event.target.id === modalId) {
    closeModal(modalId);
  }
}

function showToast(message, iconName = 'info') {
  const toast = document.getElementById('toastNotification');
  const text = document.getElementById('toastMessage');
  const icon = document.getElementById('toastIcon');

  if (!toast) return;

  text.innerText = message;
  icon.setAttribute('data-lucide', iconName);
  if (window.lucide) lucide.createIcons();

  toast.classList.remove('hidden');

  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3500);
}

function copyUpiId() {
  const upiId = document.getElementById('userUpiIdDisplay').innerText;
  navigator.clipboard.writeText(upiId).then(() => {
    showToast('UPI ID copied to clipboard!', 'copy');
  }).catch(() => {
    showToast(`UPI ID: ${upiId}`, 'copy');
  });
}

function openWalletModal() {
  showToast('UniversalPay Wallet Balance: ₹ 4,250.00 (Ready for instant contactless pay)', 'wallet');
}

function openProfileModal() {
  showToast('Prakash Sharma • HDFC Savings & SBI NRE Linked', 'user');
}

function openUpiInternationalModal() {
  showToast('UPI International Active with 0% Markup across 8 countries', 'globe');
}

function openAllTransactionsModal() {
  showToast('Displaying all historical transactions', 'list');
}

function openSearchModal() {
  openPhonePayModal();
}

function launchConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
  }
}

function refreshDashboard() {
  updateCountryHeaderUI();
  if (window.lucide) lucide.createIcons();
}
