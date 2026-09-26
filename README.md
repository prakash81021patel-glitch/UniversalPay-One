# 🌍 UniversalPay One - Global UPI Payments App

> **Google Pay ke jaisa Universal UPI App jo Poori Duniya me chalega!**  
> Chaho aap **India 🇮🇳 me ho**, ya **Dubai / UAE 🇦🇪 me**, **Singapore 🇸🇬 me**, ya **France 🇫🇷 me** — jaha bhi UPI se payment accept hoti hai, waha aap is ek hi app se aasani se payment kar sakte ho!

---

## 🚀 Key Highlights & Features (Khaas Khoobiyan)

### 1. 📱 Login & Sign-In Page (Mobile Number se Authentication)
- **International Country Dial Code Selector**: Kisi bhi country ke number se login karein (`+91` India, `+971` Dubai/UAE, `+65` Singapore, `+33` France, `+977` Nepal, etc.).
- **Automatic / Demo OTP System**: Test karne ke liye instant `Auto-Fill` button ke sath 4-digit OTP.
- **Login Help & Troubleshooting Guide**:
  - Agar aap abroad (Dubai, Europe, Singapore) me hain aur Indian SIM pe SMS nahi aa raha to kya karein.
  - International Roaming me UPI login kaise kaam karta hai.
  - 24x7 Global UPI Helpline details.

### 2. ⚡ Google Pay jaisa Main Dashboard
- **8 Core Action Buttons (GPay Grid)**:
  1. 📷 **Scan Any QR**: Live camera scanner + Preset International QRs (Carrefour Dubai Mall, Burj Khalifa, Eiffel Tower Paris, Jewel Changi Singapore, Mumbai Chai).
  2. 👤 **Pay Contacts**: Phone number directory se direct transfer.
  3. 🆔 **Pay UPI ID**: Kisi bhi VPA (`rahul@okhdfcbank`, `carrefour.dubai@mashreq`) ko verify karke instant payment.
  4. 🏦 **Bank Transfer**: Account Number + IFSC (India ke liye) ya IBAN / SWIFT (Dubai & International ke liye).
  5. 🔄 **Self Transfer**: Apne do accounts (e.g. HDFC Savings & SBI NRE Global) ke beech transfer.
  6. 📱 **Mobile Recharge**: India (Jio, Airtel, Vi) aur Dubai/UAE (Du Telecom, Etisalat e&, Virgin Mobile), Singapore (Singtel) aur France (Orange) ke plans browse karke recharge karein.
  7. 💡 **Pay Bills**: Electricity, Water, Fastag aur Utilities.
  8. 💳 **Check Bank Balance**: Authentic Google Pay style 4-digit PIN keypad se balance check karein.

### 3. 🌐 Global Cross-Border UPI Engine (Real-Time Currency Conversion)
- **Live Roaming Banner**: Aap jis country me hain (e.g., Dubai), app real-time exchange rate dikhata hai:
  - `1 AED ≈ ₹22.85 INR`
  - `1 EUR ≈ ₹90.15 INR`
  - `1 SGD ≈ ₹62.40 INR`
- **Zero Hidden Forex Markup**: Merchant ko unki local currency (AED / EUR) milti hai aur aapke Indian account se exact INR debit hota hai.
- **Region Switcher**: Ek click me region badal sakte hain (India ↔ Dubai ↔ Singapore ↔ France).

### 4. 🔒 Authentic Google Pay UPI PIN Modal & Sound Chime
- Har payment aur balance check ke liye authentic 4-digit numeric keypad aata hai.
- **Demo PIN**: `1234`
- **Google Pay Chime & Confetti**: Payment success hone par authentic Google Pay tune play hoti hai aur celebration confetti burst hoti hai.
- **Official NPCI / NIPL Receipt**: Har transaction ka UTR number, bank details, aur downloadable receipt milti hai.

### 5. 🎁 Google Pay Scratch Card Rewards
- Har international transaction par reward scratch card milta hai jise scratch karke cashback jeet sakte hain!

---

## 🛠️ Kaise Run Karein (How to Run)

Server built-in Node.js HTTP module par chalta hai, isliye bina kisi external package ke bhi turant start ho jata hai!

```bash
# Terminal me ye command chalayein:
node server.js
```

Fir apna browser kholein aur is URL par jayein:
👉 **`http://localhost:3000`**

*(Agar aap express/nodemon use karna chahein to `npm install` karke `npm start` bhi kar sakte hain).*

---

## 🧪 Quick Test Credentials (Testing ke liye)
- **Login Mobile**: `9876543210` (ya koi bhi mobile number)
- **Test OTP**: `4826` (Screen par "Auto-Fill" button bhi hai)
- **UPI PIN**: `1234` (Balance check aur Payment authorize karne ke liye)
- **Primary Bank**: HDFC Bank (Savings) & State Bank of India (NRE Account)
