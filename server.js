/**
 * UniversalPay One - Global UPI Payments Backend Server
 * Supports: India, UAE (Dubai), Singapore, France, Sri Lanka, Nepal, Mauritius, Bhutan
 * 
 * Works seamlessly with Express OR built-in Node.js HTTP module!
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// ==========================================
// MOCK DATABASE & LIVE EXCHANGE RATES
// ==========================================
const EXCHANGE_RATES = {
  INR: 1.0,        // Base reference: Indian Rupee
  AED: 22.85,      // UAE Dirham (Dubai) -> 1 AED = 22.85 INR
  SGD: 62.40,      // Singapore Dollar -> 1 SGD = 62.40 INR
  EUR: 90.15,      // Euro (France) -> 1 EUR = 90.15 INR
  NPR: 0.625,      // Nepalese Rupee -> 1 NPR = 0.625 INR (1.6 NPR = 1 INR)
  LKR: 0.28,       // Sri Lankan Rupee -> 1 LKR = 0.28 INR
  MUR: 1.82,       // Mauritian Rupee -> 1 MUR = 1.82 INR
  BTN: 1.0,        // Bhutanese Ngultrum -> 1 BTN = 1 INR
  USD: 83.90       // US Dollar (Reference)
};

const COUNTRIES = [
  { code: 'IN', name: 'India', flag: '🇮🇳', currency: 'INR', symbol: '₹', dialCode: '+91', upiPartner: 'NPCI Direct UPI', active: true },
  { code: 'AE', name: 'UAE (Dubai)', flag: '🇦🇪', currency: 'AED', symbol: 'د.إ', dialCode: '+971', upiPartner: 'Mashreq / NeoPay / NIPL', active: true },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬', currency: 'SGD', symbol: 'S$', dialCode: '+65', upiPartner: 'PayNow x UPI Linkage', active: true },
  { code: 'FR', name: 'France', flag: '🇫🇷', currency: 'EUR', symbol: '€', dialCode: '+33', upiPartner: 'Lyra Network (Eiffel Tower/Galeries Lafayette)', active: true },
  { code: 'NP', name: 'Nepal', flag: '🇳🇵', currency: 'NPR', symbol: 'रू', dialCode: '+977', upiPartner: 'Fonepay x NIPL', active: true },
  { code: 'LK', name: 'Sri Lanka', flag: '🇱🇰', currency: 'LKR', symbol: 'Rs', dialCode: '+94', upiPartner: 'LankaPay UPI', active: true },
  { code: 'MU', name: 'Mauritius', flag: '🇲🇺', currency: 'MUR', symbol: '₨', dialCode: '+230', upiPartner: 'MauCAS Network', active: true },
  { code: 'BT', name: 'Bhutan', flag: '🇧🇹', currency: 'BTN', symbol: 'Nu.', dialCode: '+975', upiPartner: 'Royal Monetary Authority (RMA)', active: true }
];

// Default demo user profile
let userProfile = {
  id: 'usr_universal_001',
  name: 'Prakash Sharma',
  phone: '9876543210',
  countryCode: '+91',
  upiId: 'prakash@universalpay',
  activeCountry: 'IN', // 'IN', 'AE', 'SG', 'FR'
  upiInternationalEnabled: true,
  bankAccounts: [
    {
      id: 'acc_hdfc_01',
      bankName: 'HDFC Bank',
      accountType: 'Savings Account',
      accountNumber: '•••• •••• 5642',
      ifsc: 'HDFC0001234',
      upiPin: '1234', // default demo PIN
      balanceINR: 84500.50,
      isPrimary: true,
      internationalUpiActive: true
    },
    {
      id: 'acc_sbi_02',
      bankName: 'State Bank of India',
      accountType: 'NRE Global Account',
      accountNumber: '•••• •••• 8891',
      ifsc: 'SBIN0005544',
      upiPin: '5678',
      balanceINR: 231450.00,
      isPrimary: false,
      internationalUpiActive: true
    }
  ],
  walletBalanceINR: 4250.00
};

// Recent contacts for quick pay
let contacts = [
  { id: 'c1', name: 'Rahul Verma', phone: '+91 9811223344', upiId: 'rahul@okhdfcbank', avatar: '👨‍💼', country: 'IN' },
  { id: 'c2', name: 'Fatima Al-Zahra', phone: '+971 501234567', upiId: 'fatima@mashreq', avatar: '👩‍💼', country: 'AE' },
  { id: 'c3', name: 'Pierre Dubois', phone: '+33 612345678', upiId: 'pierre@lyrapay', avatar: '👨‍🎨', country: 'FR' },
  { id: 'c4', name: 'Tan Wei Ming', phone: '+65 91234567', upiId: 'tanwm@paynow', avatar: '👨‍💻', country: 'SG' },
  { id: 'c5', name: 'Pooja Patel', phone: '+91 9876500112', upiId: 'pooja@oksbi', avatar: '👩‍⚕️', country: 'IN' },
  { id: 'c6', name: 'Aarav Mehta', phone: '+91 9988776655', upiId: 'aarav@okaxis', avatar: '🧑‍🎓', country: 'IN' }
];

// Famous merchants accepting UPI in India & Abroad
const MERCHANTS = [
  { id: 'm1', name: 'Dubai Mall Carrefour', category: 'Supermarket', country: 'AE', currency: 'AED', upiId: 'carrefour.dubai@mashreq', icon: '🛒' },
  { id: 'm2', name: 'Burj Khalifa Observation Deck', category: 'Tourism', country: 'AE', currency: 'AED', upiId: 'burjkhalifa@neopay', icon: '🏙️' },
  { id: 'm3', name: 'Eiffel Tower Ticket Desk', category: 'Tourism', country: 'FR', currency: 'EUR', upiId: 'toureiffel@lyra', icon: '🗼' },
  { id: 'm4', name: 'Jewel Changi Airport Duty Free', category: 'Travel', country: 'SG', currency: 'SGD', upiId: 'jewelchangi@paynow', icon: '✈️' },
  { id: 'm5', name: 'Swiggy & Zomato India', category: 'Food Delivery', country: 'IN', currency: 'INR', upiId: 'swiggy@icici', icon: '🍔' },
  { id: 'm6', name: 'Reliance Smart Superstore', category: 'Grocery', country: 'IN', currency: 'INR', upiId: 'reliancesmart@hdfcbank', icon: '🏬' }
];

// Transaction History
let transactions = [
  {
    id: 'TXN_' + Date.now().toString().slice(-8),
    title: 'Dubai Mall Duty Free',
    upiId: 'dutydubai@mashreq',
    country: 'AE',
    originalCurrency: 'AED',
    originalAmount: 120.00,
    amountINR: 2742.00,
    rateUsed: 22.85,
    type: 'DEBIT',
    category: 'Shopping (Dubai)',
    status: 'SUCCESS',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    utrNumber: 'UPI/AE/' + Math.floor(100000000000 + Math.random() * 900000000000),
    bankUsed: 'HDFC Bank (•••• 5642)'
  },
  {
    id: 'TXN_' + (Date.now() - 1000).toString().slice(-8),
    title: 'Rahul Verma',
    upiId: 'rahul@okhdfcbank',
    country: 'IN',
    originalCurrency: 'INR',
    originalAmount: 500.00,
    amountINR: 500.00,
    rateUsed: 1.0,
    type: 'DEBIT',
    category: 'Peer to Peer',
    status: 'SUCCESS',
    timestamp: new Date(Date.now() - 3600000 * 18).toISOString(),
    utrNumber: 'UPI/IN/' + Math.floor(100000000000 + Math.random() * 900000000000),
    bankUsed: 'HDFC Bank (•••• 5642)'
  },
  {
    id: 'TXN_' + (Date.now() - 2000).toString().slice(-8),
    title: 'Salary Deposit (Global Remittance)',
    upiId: 'payroll@globaltech.com',
    country: 'IN',
    originalCurrency: 'INR',
    originalAmount: 75000.00,
    amountINR: 75000.00,
    rateUsed: 1.0,
    type: 'CREDIT',
    category: 'Income',
    status: 'SUCCESS',
    timestamp: new Date(Date.now() - 86400000 * 3).toISOString(),
    utrNumber: 'UPI/CR/' + Math.floor(100000000000 + Math.random() * 900000000000),
    bankUsed: 'HDFC Bank (•••• 5642)'
  }
];

// Recharge Plans for India & International
const RECHARGE_PLANS = {
  IN: [
    { id: 'in_1', operator: 'Jio 5G', circle: 'All India', price: 299, validity: '28 Days', data: '2GB/Day + Unlimited 5G', desc: 'Unlimited Calls + 100 SMS/day' },
    { id: 'in_2', operator: 'Airtel True 5G', circle: 'All India', price: 349, validity: '28 Days', data: '2.5GB/Day + Free OTT', desc: 'Unlimited Calls + Airtel Xstream' },
    { id: 'in_3', operator: 'Vi Hero Unlimited', circle: 'All India', price: 299, validity: '28 Days', data: '1.5GB/Day + Night Binge', desc: 'All night unlimited data 12am-6am' },
    { id: 'in_roam_1', operator: 'Airtel World Pass (Dubai/Europe/Asia)', circle: 'Global Roaming', price: 899, validity: '10 Days', data: '3GB Roaming Data', desc: '100 mins outgoing & incoming international calls' }
  ],
  AE: [
    { id: 'ae_1', operator: 'Du Telecom (UAE)', circle: 'Dubai / UAE', price: 55, currency: 'AED', inrApprox: 1256, validity: '28 Days', data: '5GB Data + 150 Flexi Mins', desc: 'Tourist & Resident Plan' },
    { id: 'ae_2', operator: 'e& (Etisalat UAE)', circle: 'Dubai / Abu Dhabi', price: 100, currency: 'AED', inrApprox: 2285, validity: '30 Days', data: '10GB 5G + 300 Local Mins', desc: 'High speed 5G unlimited social' },
    { id: 'ae_3', operator: 'Virgin Mobile UAE', circle: 'Dubai / UAE', price: 79, currency: 'AED', inrApprox: 1805, validity: '30 Days', data: '7GB Data + 200 Mins', desc: 'Digital eSIM Instant Activation' }
  ],
  SG: [
    { id: 'sg_1', operator: 'Singtel Singapore', circle: 'Singapore', price: 20, currency: 'SGD', inrApprox: 1248, validity: '28 Days', data: '20GB 5G + 1000 Mins', desc: 'Tourist & Expat SIM' }
  ],
  FR: [
    { id: 'fr_1', operator: 'Orange France', circle: 'France & EU', price: 25, currency: 'EUR', inrApprox: 2253, validity: '30 Days', data: '30GB Europe High Speed', desc: 'Free Roaming across European Union' }
  ]
};

// Help & Guide Knowledge Base
const HELP_GUIDE = {
  title: 'UniversalPay One - Global UPI Login & Payment Guide',
  sections: [
    {
      id: 'login_abroad',
      heading: '1. Traveling Abroad (Dubai, Singapore, France) & Cannot Login?',
      content: 'If you are outside India and trying to log in using an Indian SIM card (+91):\n• Ensure International Roaming SMS is active on your telecom operator (Jio/Airtel/Vi).\n• You do NOT need active mobile data abroad; standard SMS reception is sufficient.\n• If SMS OTP is delayed, use our "Demo OTP Simulation" or WhatsApp OTP option.'
    },
    {
      id: 'upi_international',
      heading: '2. How Does UPI International Work in Dubai / Foreign Countries?',
      content: 'NPCI (National Payments Corporation of India) and NIPL have partnered with foreign payment networks (such as Mashreq/NeoPay in UAE, Lyra in France, and PayNow in Singapore).\n• When you scan a QR code in Dubai Mall or Eiffel Tower, the local price (e.g. 50 AED) is converted in real-time to INR.\n• Your linked Indian bank account is debited in INR with 0% hidden markup.'
    },
    {
      id: 'supported_countries',
      heading: '3. Which Countries Accept UniversalPay One UPI?',
      content: 'Currently active: India (₹), UAE/Dubai (د.إ), Singapore (S$), France (€), Nepal (रू), Sri Lanka (Rs), Mauritius (₨), and Bhutan (Nu.). More countries are added monthly.'
    },
    {
      id: 'troubleshoot_otp',
      heading: '4. Quick OTP & Login Troubleshooting Steps',
      steps: [
        'Step 1: Check if the Country Dial Code matches your mobile number (+91 for India, +971 for UAE).',
        'Step 2: Disable Airplane mode and re-enable it to refresh network signal.',
        'Step 3: Click "Show Demo OTP" on screen to instantly login during testing.',
        'Step 4: For NRE/NRO accounts, ensure your registered international number is updated with your bank.'
      ]
    },
    {
      id: 'support_contact',
      heading: '5. Need Live Assistance?',
      contact: 'Global Helpline: +91 1800 200 9999 (24x7 Free) | WhatsApp Support: +91 98765 43210'
    }
  ]
};

// ==========================================
// REQUEST HANDLER (API + STATIC ASSETS)
// ==========================================
function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Parse JSON Body Helper
  function getJsonBody(callback) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = body ? JSON.parse(body) : {};
        callback(null, data);
      } catch (err) {
        callback(err, null);
      }
    });
  }

  // Send JSON Response Helper
  function sendJson(statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  }

  // ==========================================
  // REST API ENDPOINTS
  // ==========================================

  // 1. Auth: Send OTP
  if (req.method === 'POST' && pathname === '/api/auth/send-otp') {
    getJsonBody((err, data) => {
      const { phone, countryCode } = data;
      if (!phone) {
        return sendJson(400, { success: false, message: 'Phone number is required' });
      }
      // Demo OTP generation
      const demoOtp = '4826';
      sendJson(200, {
        success: true,
        message: `OTP sent successfully to ${countryCode || '+91'} ${phone}`,
        demoOtp: demoOtp,
        expiresInSeconds: 60
      });
    });
    return;
  }

  // 2. Auth: Verify OTP
  if (req.method === 'POST' && pathname === '/api/auth/verify-otp') {
    getJsonBody((err, data) => {
      const { phone, countryCode, otp, name } = data;
      if (!otp) {
        return sendJson(400, { success: false, message: 'Please enter 4-digit OTP' });
      }
      // Accept '4826' or any 4-digit number for convenience in testing
      userProfile.phone = phone || userProfile.phone;
      userProfile.countryCode = countryCode || userProfile.countryCode;
      if (name) userProfile.name = name;

      sendJson(200, {
        success: true,
        message: 'Login successful! Welcome to UniversalPay One.',
        token: 'jwt_mock_token_' + Date.now(),
        user: userProfile
      });
    });
    return;
  }

  // 3. Get User Profile & Linked Banks
  if (req.method === 'GET' && pathname === '/api/user/profile') {
    return sendJson(200, {
      success: true,
      user: userProfile,
      countries: COUNTRIES,
      exchangeRates: EXCHANGE_RATES
    });
  }

  // 4. Update Active Country (e.g. User is currently in Dubai or India)
  if (req.method === 'POST' && pathname === '/api/user/set-country') {
    getJsonBody((err, data) => {
      const { countryCode } = data;
      const country = COUNTRIES.find(c => c.code === countryCode);
      if (!country) {
        return sendJson(400, { success: false, message: 'Invalid country code' });
      }
      userProfile.activeCountry = countryCode;
      sendJson(200, {
        success: true,
        message: `Active region changed to ${country.name} (${country.currency})`,
        activeCountry: country
      });
    });
    return;
  }

  // 5. Help & Guide Knowledge Base
  if (req.method === 'GET' && pathname === '/api/help/guide') {
    return sendJson(200, {
      success: true,
      guide: HELP_GUIDE
    });
  }

  // 6. Get Exchange Rates
  if (req.method === 'GET' && pathname === '/api/rates') {
    return sendJson(200, {
      success: true,
      base: 'INR',
      rates: EXCHANGE_RATES,
      countries: COUNTRIES
    });
  }

  // 7. Check Bank Balance (Requires 4-digit UPI PIN)
  if (req.method === 'POST' && pathname === '/api/bank/balance') {
    getJsonBody((err, data) => {
      const { accountId, upiPin } = data;
      const account = userProfile.bankAccounts.find(a => a.id === accountId) || userProfile.bankAccounts[0];
      
      if (!upiPin || upiPin.length < 4) {
        return sendJson(400, { success: false, message: 'Please enter valid 4-digit UPI PIN' });
      }

      if (upiPin !== account.upiPin && upiPin !== '1234') {
        return sendJson(401, { success: false, message: 'Incorrect UPI PIN. Please try again.' });
      }

      // Calculate balance in user active country's currency as well
      const activeCountryObj = COUNTRIES.find(c => c.code === userProfile.activeCountry) || COUNTRIES[0];
      const rate = EXCHANGE_RATES[activeCountryObj.currency] || 1;
      const balanceForeign = (account.balanceINR / rate).toFixed(2);

      sendJson(200, {
        success: true,
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        balanceINR: account.balanceINR,
        balanceFormattedINR: '₹ ' + account.balanceINR.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
        activeCurrency: activeCountryObj.currency,
        activeSymbol: activeCountryObj.symbol,
        balanceForeign: balanceForeign,
        balanceFormattedForeign: `${activeCountryObj.symbol} ${parseFloat(balanceForeign).toLocaleString('en-US')}`
      });
    });
    return;
  }

  // 8. Validate UPI ID / Phone / VPA
  if (req.method === 'POST' && pathname === '/api/payment/verify-vpa') {
    getJsonBody((err, data) => {
      const { vpa } = data;
      if (!vpa) return sendJson(400, { success: false, message: 'UPI ID is required' });

      // Check known contacts or merchants
      const matchedContact = contacts.find(c => c.upiId.toLowerCase() === vpa.toLowerCase() || c.phone.replace(/\s+/g, '') === vpa.replace(/\s+/g, ''));
      const matchedMerchant = MERCHANTS.find(m => m.upiId.toLowerCase() === vpa.toLowerCase());

      let verifiedName = 'Verified Merchant / User';
      let verifiedStatus = true;
      let detectedCountry = 'IN';

      if (matchedContact) {
        verifiedName = matchedContact.name;
        detectedCountry = matchedContact.country;
      } else if (matchedMerchant) {
        verifiedName = matchedMerchant.name;
        detectedCountry = matchedMerchant.country;
      } else if (vpa.includes('@mashreq') || vpa.includes('@neopay')) {
        verifiedName = 'Dubai UAE Merchant (NIPL Accepted)';
        detectedCountry = 'AE';
      } else if (vpa.includes('@paynow')) {
        verifiedName = 'Singapore PayNow Merchant';
        detectedCountry = 'SG';
      } else if (vpa.includes('@lyra')) {
        verifiedName = 'French Merchant (Lyra Network)';
        detectedCountry = 'FR';
      } else {
        // Any regular UPI ID
        const parts = vpa.split('@');
        verifiedName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + ' (Verified NPCI)';
      }

      const countryObj = COUNTRIES.find(c => c.code === detectedCountry) || COUNTRIES[0];

      sendJson(200, {
        success: true,
        vpa: vpa,
        verifiedName: verifiedName,
        country: countryObj,
        isVerified: verifiedStatus
      });
    });
    return;
  }

  // 9. Process Payment (QR, UPI ID, Phone Number, Bank Transfer)
  if (req.method === 'POST' && pathname === '/api/payment/execute') {
    getJsonBody((err, data) => {
      const {
        paymentType, // 'QR', 'UPI_ID', 'PHONE', 'BANK_TRANSFER'
        recipientTitle,
        recipientIdentifier, // upiId, phone, or bank acc
        amount,
        currency, // INR, AED, SGD, EUR
        note,
        upiPin
      } = data;

      if (!amount || parseFloat(amount) <= 0) {
        return sendJson(400, { success: false, message: 'Please enter a valid payment amount' });
      }

      if (!upiPin || upiPin.length < 4) {
        return sendJson(400, { success: false, message: 'UPI PIN is required to authorize transaction' });
      }

      // Check PIN
      const primaryBank = userProfile.bankAccounts.find(b => b.isPrimary) || userProfile.bankAccounts[0];
      if (upiPin !== primaryBank.upiPin && upiPin !== '1234') {
        return sendJson(401, { success: false, message: 'Incorrect UPI PIN' });
      }

      const inputAmount = parseFloat(amount);
      const paymentCurrency = currency || 'INR';
      const exchangeRate = EXCHANGE_RATES[paymentCurrency] || 1.0;
      
      // Calculate INR deduction
      const amountInINR = paymentCurrency === 'INR' ? inputAmount : parseFloat((inputAmount * exchangeRate).toFixed(2));

      // Balance check
      if (primaryBank.balanceINR < amountInINR) {
        return sendJson(400, {
          success: false,
          message: `Insufficient balance in ${primaryBank.bankName}. Available: ₹${primaryBank.balanceINR.toLocaleString('en-IN')}, Required: ₹${amountInINR.toLocaleString('en-IN')}`
        });
      }

      // Deduct balance
      primaryBank.balanceINR -= amountInINR;

      // Determine Country
      let countryCode = 'IN';
      if (paymentCurrency === 'AED') countryCode = 'AE';
      else if (paymentCurrency === 'SGD') countryCode = 'SG';
      else if (paymentCurrency === 'EUR') countryCode = 'FR';
      else if (paymentCurrency === 'NPR') countryCode = 'NP';

      const countryObj = COUNTRIES.find(c => c.code === countryCode) || COUNTRIES[0];

      // Generate UTR Reference Number
      const utr = `UPI/${countryCode}/${Date.now().toString().slice(-6)}${Math.floor(100000 + Math.random() * 900000)}`;

      // Create Transaction Record
      const newTxn = {
        id: 'TXN_' + Date.now().toString().slice(-8),
        title: recipientTitle || recipientIdentifier || 'Payment to Merchant',
        upiId: recipientIdentifier,
        paymentType: paymentType || 'UPI_TRANSFER',
        country: countryCode,
        originalCurrency: paymentCurrency,
        originalAmount: inputAmount,
        amountINR: amountInINR,
        rateUsed: exchangeRate,
        type: 'DEBIT',
        category: countryCode === 'IN' ? 'Domestic UPI' : `International UPI (${countryObj.name})`,
        status: 'SUCCESS',
        timestamp: new Date().toISOString(),
        utrNumber: utr,
        bankUsed: `${primaryBank.bankName} (${primaryBank.accountNumber})`,
        note: note || 'UniversalPay Transfer'
      };

      transactions.unshift(newTxn);

      sendJson(200, {
        success: true,
        message: 'Payment Successful!',
        transaction: newTxn,
        remainingBalanceINR: primaryBank.balanceINR
      });
    });
    return;
  }

  // 10. Get Mobile Recharge Plans
  if (req.method === 'GET' && pathname === '/api/recharge/plans') {
    const country = parsedUrl.query.country || userProfile.activeCountry || 'IN';
    const plans = RECHARGE_PLANS[country] || RECHARGE_PLANS.IN;
    return sendJson(200, {
      success: true,
      country: country,
      plans: plans
    });
  }

  // 11. Execute Mobile Recharge
  if (req.method === 'POST' && pathname === '/api/recharge/execute') {
    getJsonBody((err, data) => {
      const { mobileNumber, operator, planId, amount, currency, upiPin } = data;
      if (!mobileNumber || !planId || !amount) {
        return sendJson(400, { success: false, message: 'Mobile number, operator, and plan are required' });
      }

      const primaryBank = userProfile.bankAccounts[0];
      const rechargeAmountINR = currency === 'AED' ? amount * EXCHANGE_RATES.AED : amount;

      if (primaryBank.balanceINR < rechargeAmountINR) {
        return sendJson(400, { success: false, message: 'Insufficient bank balance' });
      }

      primaryBank.balanceINR -= rechargeAmountINR;

      const newTxn = {
        id: 'TXN_REC_' + Date.now().toString().slice(-8),
        title: `Mobile Recharge: ${operator} (${mobileNumber})`,
        upiId: `billpay.${operator.toLowerCase().replace(/[^a-z]/g, '')}@universalpay`,
        paymentType: 'MOBILE_RECHARGE',
        country: currency === 'AED' ? 'AE' : 'IN',
        originalCurrency: currency || 'INR',
        originalAmount: parseFloat(amount),
        amountINR: parseFloat(rechargeAmountINR.toFixed(2)),
        rateUsed: currency === 'AED' ? EXCHANGE_RATES.AED : 1.0,
        type: 'DEBIT',
        category: 'Utility & Recharge',
        status: 'SUCCESS',
        timestamp: new Date().toISOString(),
        utrNumber: `REC/${Math.floor(100000000000 + Math.random() * 900000000000)}`,
        bankUsed: `${primaryBank.bankName} (${primaryBank.accountNumber})`,
        note: `Recharge successful for ${mobileNumber}`
      };

      transactions.unshift(newTxn);

      sendJson(200, {
        success: true,
        message: `Mobile recharge of ${currency || '₹'} ${amount} successful!`,
        transaction: newTxn,
        remainingBalanceINR: primaryBank.balanceINR
      });
    });
    return;
  }

  // 12. Get Transactions List
  if (req.method === 'GET' && pathname === '/api/transactions') {
    return sendJson(200, {
      success: true,
      transactions: transactions
    });
  }

  // 13. Get Quick Contacts & Global Merchants
  if (req.method === 'GET' && pathname === '/api/contacts') {
    return sendJson(200, {
      success: true,
      contacts: contacts,
      merchants: MERCHANTS
    });
  }

  // ==========================================
  // STATIC ASSET SERVING
  // ==========================================
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  // Security check to avoid directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Access Denied');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // If path doesn't exist, serve index.html for SPA routing
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.mp3': 'audio/mpeg'
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
  });
}

// Start Server
const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 UniversalPay One - Global UPI Backend is Live!`);
  console.log(`🌐 Server running at: http://localhost:${PORT}`);
  console.log(`🌍 Supported: India (INR), UAE/Dubai (AED), Singapore (SGD), France (EUR), Nepal (NPR)`);
  console.log(`=======================================================`);
});
