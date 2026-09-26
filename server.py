"""
UniversalPay One - Global UPI Backend Server (Python 3)
Supports: India (INR), UAE / Dubai (AED), Singapore (SGD), France (EUR), Nepal (NPR), Sri Lanka (LKR)
Zero dependencies required! Runs directly with built-in Python standard library:
    python server.py
"""

import http.server
import socketserver
import json
import os
import mimetypes
from urllib.parse import urlparse, parse_qs
from datetime import datetime
import random

PORT = 3000
PUBLIC_DIR = os.path.join(os.path.dirname(__file__), 'public')

# ==========================================
# MOCK DATABASE & LIVE EXCHANGE RATES
# ==========================================
EXCHANGE_RATES = {
    "INR": 1.0,        # Base: Indian Rupee
    "AED": 22.85,      # UAE Dirham (Dubai) -> 1 AED = 22.85 INR
    "SGD": 62.40,      # Singapore Dollar -> 1 SGD = 62.40 INR
    "EUR": 90.15,      # Euro (France) -> 1 EUR = 90.15 INR
    "NPR": 0.625,      # Nepalese Rupee
    "LKR": 0.28,       # Sri Lankan Rupee
    "MUR": 1.82,       # Mauritian Rupee
    "BTN": 1.0,        # Bhutanese Ngultrum
    "USD": 83.90       # US Dollar
}

COUNTRIES = [
    {"code": "IN", "name": "India", "flag": "🇮🇳", "currency": "INR", "symbol": "₹", "dialCode": "+91", "upiPartner": "NPCI Direct UPI", "active": True},
    {"code": "AE", "name": "UAE (Dubai)", "flag": "🇦🇪", "currency": "AED", "symbol": "د.إ", "dialCode": "+971", "upiPartner": "Mashreq / NeoPay / NIPL", "active": True},
    {"code": "SG", "name": "Singapore", "flag": "🇸🇬", "currency": "SGD", "symbol": "S$", "dialCode": "+65", "upiPartner": "PayNow x UPI Linkage", "active": True},
    {"code": "FR", "name": "France", "flag": "🇫🇷", "currency": "EUR", "symbol": "€", "dialCode": "+33", "upiPartner": "Lyra Network (Eiffel Tower)", "active": True},
    {"code": "NP", "name": "Nepal", "flag": "🇳🇵", "currency": "NPR", "symbol": "रू", "dialCode": "+977", "upiPartner": "Fonepay x NIPL", "active": True},
    {"code": "LK", "name": "Sri Lanka", "flag": "🇱🇰", "currency": "LKR", "symbol": "Rs", "dialCode": "+94", "upiPartner": "LankaPay UPI", "active": True},
    {"code": "MU", "name": "Mauritius", "flag": "🇲🇺", "currency": "MUR", "symbol": "₨", "dialCode": "+230", "upiPartner": "MauCAS Network", "active": True},
    {"code": "BT", "name": "Bhutan", "flag": "🇧🇹", "currency": "BTN", "symbol": "Nu.", "dialCode": "+975", "upiPartner": "Royal Monetary Authority (RMA)", "active": True}
]

user_profile = {
    "id": "usr_universal_001",
    "name": "Prakash Sharma",
    "phone": "9876543210",
    "countryCode": "+91",
    "upiId": "prakash@universalpay",
    "activeCountry": "IN",
    "upiInternationalEnabled": True,
    "bankAccounts": [
        {
            "id": "acc_hdfc_01",
            "bankName": "HDFC Bank",
            "accountType": "Savings Account",
            "accountNumber": "•••• •••• 5642",
            "ifsc": "HDFC0001234",
            "upiPin": "1234",
            "balanceINR": 84500.50,
            "isPrimary": True,
            "internationalUpiActive": True
        },
        {
            "id": "acc_sbi_02",
            "bankName": "State Bank of India",
            "accountType": "NRE Global Account",
            "accountNumber": "•••• •••• 8891",
            "ifsc": "SBIN0005544",
            "upiPin": "5678",
            "balanceINR": 231450.00,
            "isPrimary": False,
            "internationalUpiActive": True
        }
    ],
    "walletBalanceINR": 4250.00
}

contacts = [
    {"id": "c1", "name": "Rahul Verma", "phone": "+91 9811223344", "upiId": "rahul@okhdfcbank", "avatar": "👨‍💼", "country": "IN"},
    {"id": "c2", "name": "Fatima Al-Zahra", "phone": "+971 501234567", "upiId": "fatima@mashreq", "avatar": "👩‍💼", "country": "AE"},
    {"id": "c3", "name": "Pierre Dubois", "phone": "+33 612345678", "upiId": "pierre@lyrapay", "avatar": "👨‍🎨", "country": "FR"},
    {"id": "c4", "name": "Tan Wei Ming", "phone": "+65 91234567", "upiId": "tanwm@paynow", "avatar": "👨‍💻", "country": "SG"},
    {"id": "c5", "name": "Pooja Patel", "phone": "+91 9876500112", "upiId": "pooja@oksbi", "avatar": "👩‍⚕️", "country": "IN"},
    {"id": "c6", "name": "Aarav Mehta", "phone": "+91 9988776655", "upiId": "aarav@okaxis", "avatar": "🧑‍🎓", "country": "IN"}
]

merchants = [
    {"id": "m1", "name": "Dubai Mall Carrefour", "category": "Supermarket", "country": "AE", "currency": "AED", "upiId": "carrefour.dubai@mashreq", "icon": "🛒"},
    {"id": "m2", "name": "Burj Khalifa Observation Deck", "category": "Tourism", "country": "AE", "currency": "AED", "upiId": "burjkhalifa@neopay", "icon": "🏙️"},
    {"id": "m3", "name": "Eiffel Tower Ticket Desk", "category": "Tourism", "country": "FR", "currency": "EUR", "upiId": "toureiffel@lyra", "icon": "🗼"},
    {"id": "m4", "name": "Jewel Changi Airport Duty Free", "category": "Travel", "country": "SG", "currency": "SGD", "upiId": "jewelchangi@paynow", "icon": "✈️"},
    {"id": "m5", "name": "Swiggy & Zomato India", "category": "Food Delivery", "country": "IN", "currency": "INR", "upiId": "swiggy@icici", "icon": "🍔"},
    {"id": "m6", "name": "Reliance Smart Superstore", "category": "Grocery", "country": "IN", "currency": "INR", "upiId": "reliancesmart@hdfcbank", "icon": "🏬"}
]

transactions = [
    {
        "id": "TXN_984210",
        "title": "Dubai Mall Duty Free",
        "upiId": "dutydubai@mashreq",
        "country": "AE",
        "originalCurrency": "AED",
        "originalAmount": 120.00,
        "amountINR": 2742.00,
        "rateUsed": 22.85,
        "type": "DEBIT",
        "category": "Shopping (Dubai)",
        "status": "SUCCESS",
        "timestamp": datetime.now().isoformat(),
        "utrNumber": "UPI/AE/892401827419",
        "bankUsed": "HDFC Bank (•••• 5642)"
    },
    {
        "id": "TXN_773124",
        "title": "Rahul Verma",
        "upiId": "rahul@okhdfcbank",
        "country": "IN",
        "originalCurrency": "INR",
        "originalAmount": 500.00,
        "amountINR": 500.00,
        "rateUsed": 1.0,
        "type": "DEBIT",
        "category": "Peer to Peer",
        "status": "SUCCESS",
        "timestamp": datetime.now().isoformat(),
        "utrNumber": "UPI/IN/102938475612",
        "bankUsed": "HDFC Bank (•••• 5642)"
    },
    {
        "id": "TXN_652190",
        "title": "Salary Deposit (Global Remittance)",
        "upiId": "payroll@globaltech.com",
        "country": "IN",
        "originalCurrency": "INR",
        "originalAmount": 75000.00,
        "amountINR": 75000.00,
        "rateUsed": 1.0,
        "type": "CREDIT",
        "category": "Income",
        "status": "SUCCESS",
        "timestamp": datetime.now().isoformat(),
        "utrNumber": "UPI/CR/998877665544",
        "bankUsed": "HDFC Bank (•••• 5642)"
    }
]

RECHARGE_PLANS = {
    "IN": [
        {"id": "in_1", "operator": "Jio 5G", "circle": "All India", "price": 299, "validity": "28 Days", "data": "2GB/Day + Unlimited 5G", "desc": "Unlimited Calls + 100 SMS/day"},
        {"id": "in_2", "operator": "Airtel True 5G", "circle": "All India", "price": 349, "validity": "28 Days", "data": "2.5GB/Day + Free OTT", "desc": "Unlimited Calls + Airtel Xstream"},
        {"id": "in_3", "operator": "Vi Hero Unlimited", "circle": "All India", "price": 299, "validity": "28 Days", "data": "1.5GB/Day + Night Binge", "desc": "All night unlimited data 12am-6am"},
        {"id": "in_roam_1", "operator": "Airtel World Pass (Dubai/Europe)", "circle": "Global Roaming", "price": 899, "validity": "10 Days", "data": "3GB Roaming Data", "desc": "100 mins outgoing & incoming international calls"}
    ],
    "AE": [
        {"id": "ae_1", "operator": "Du Telecom (UAE)", "circle": "Dubai / UAE", "price": 55, "currency": "AED", "validity": "28 Days", "data": "5GB Data + 150 Flexi Mins", "desc": "Tourist & Resident Plan"},
        {"id": "ae_2", "operator": "e& (Etisalat UAE)", "circle": "Dubai / Abu Dhabi", "price": 100, "currency": "AED", "validity": "30 Days", "data": "10GB 5G + 300 Local Mins", "desc": "High speed 5G unlimited social"},
        {"id": "ae_3", "operator": "Virgin Mobile UAE", "circle": "Dubai / UAE", "price": 79, "currency": "AED", "validity": "30 Days", "data": "7GB Data + 200 Mins", "desc": "Digital eSIM Instant Activation"}
    ],
    "SG": [
        {"id": "sg_1", "operator": "Singtel Singapore", "circle": "Singapore", "price": 20, "currency": "SGD", "validity": "28 Days", "data": "20GB 5G + 1000 Mins", "desc": "Tourist & Expat SIM"}
    ],
    "FR": [
        {"id": "fr_1", "operator": "Orange France", "circle": "France & EU", "price": 25, "currency": "EUR", "validity": "30 Days", "data": "30GB Europe High Speed", "desc": "Free Roaming across European Union"}
    ]
}

HELP_GUIDE = {
    "title": "UniversalPay One - Global UPI Login & Payment Guide",
    "sections": [
        {
            "id": "login_abroad",
            "heading": "1. Traveling Abroad (Dubai, Singapore, France) & Cannot Login?",
            "content": "If you are outside India and trying to log in using an Indian SIM card (+91):\n• Ensure International Roaming SMS is active on your telecom operator (Jio/Airtel/Vi).\n• You do NOT need active mobile data abroad; standard SMS reception is sufficient.\n• If SMS OTP is delayed, use our 'Demo OTP Simulation' or WhatsApp OTP option."
        },
        {
            "id": "upi_international",
            "heading": "2. How Does UPI International Work in Dubai / Foreign Countries?",
            "content": "NPCI (National Payments Corporation of India) and NIPL have partnered with foreign payment networks (such as Mashreq/NeoPay in UAE, Lyra in France, and PayNow in Singapore).\n• When you scan a QR code in Dubai Mall or Eiffel Tower, the local price (e.g. 50 AED) is converted in real-time to INR.\n• Your linked Indian bank account is debited in INR with 0% hidden markup."
        },
        {
            "id": "supported_countries",
            "heading": "3. Which Countries Accept UniversalPay One UPI?",
            "content": "Currently active: India (₹), UAE/Dubai (د.إ), Singapore (S$), France (€), Nepal (रू), Sri Lanka (Rs), Mauritius (₨), and Bhutan (Nu.)."
        },
        {
            "id": "troubleshoot_otp",
            "heading": "4. Quick OTP & Login Troubleshooting Steps",
            "steps": [
                "Step 1: Check if the Country Dial Code matches your mobile number (+91 for India, +971 for UAE).",
                "Step 2: Disable Airplane mode and re-enable it to refresh network signal.",
                "Step 3: Click 'Show Demo OTP' on screen to instantly login during testing.",
                "Step 4: For NRE/NRO accounts, ensure your registered international number is updated with your bank."
            ]
        },
        {
            "id": "support_contact",
            "heading": "5. Need Live Assistance?",
            "contact": "Global Helpline: +91 1800 200 9999 (24x7 Free) | WhatsApp Support: +91 98765 43210"
        }
    ]
}

class UniversalPayHandler(http.server.BaseHTTPRequestHandler):
    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def send_json(self, status_code, data):
        self.send_response(status_code)
        self.send_cors_headers()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def get_json_body(self):
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > 0:
            raw_data = self.rfile.read(content_length).decode('utf-8')
            try:
                return json.loads(raw_data)
            except Exception:
                return {}
        return {}

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        # 1. User Profile
        if path == '/api/user/profile':
            return self.send_json(200, {
                "success": True,
                "user": user_profile,
                "countries": COUNTRIES,
                "exchangeRates": EXCHANGE_RATES
            })

        # 2. Exchange Rates
        if path == '/api/rates':
            return self.send_json(200, {
                "success": True,
                "base": "INR",
                "rates": EXCHANGE_RATES,
                "countries": COUNTRIES
            })

        # 3. Help & Guide
        if path == '/api/help/guide':
            return self.send_json(200, {
                "success": True,
                "guide": HELP_GUIDE
            })

        # 4. Contacts & Merchants
        if path == '/api/contacts':
            return self.send_json(200, {
                "success": True,
                "contacts": contacts,
                "merchants": merchants
            })

        # 5. Transactions
        if path == '/api/transactions':
            return self.send_json(200, {
                "success": True,
                "transactions": transactions
            })

        # 6. Recharge Plans
        if path == '/api/recharge/plans':
            country = query.get('country', ['IN'])[0]
            plans = RECHARGE_PLANS.get(country, RECHARGE_PLANS['IN'])
            return self.send_json(200, {
                "success": True,
                "country": country,
                "plans": plans
            })

        # Static file serving
        self.serve_static_file(path)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        data = self.get_json_body()

        # Auth: Send OTP
        if path == '/api/auth/send-otp':
            phone = data.get('phone', '')
            country_code = data.get('countryCode', '+91')
            return self.send_json(200, {
                "success": True,
                "message": f"OTP sent successfully to {country_code} {phone}",
                "demoOtp": "4826",
                "expiresInSeconds": 60
            })

        # Auth: Verify OTP
        if path == '/api/auth/verify-otp':
            otp = data.get('otp', '')
            if not otp:
                return self.send_json(400, {"success": False, "message": "Please enter 4-digit OTP"})
            user_profile['phone'] = data.get('phone', user_profile['phone'])
            return self.send_json(200, {
                "success": True,
                "message": "Login successful! Welcome to UniversalPay One.",
                "token": "token_mock_auth",
                "user": user_profile
            })

        # Set Country
        if path == '/api/user/set-country':
            country_code = data.get('countryCode', 'IN')
            country = next((c for c in COUNTRIES if c['code'] == country_code), COUNTRIES[0])
            user_profile['activeCountry'] = country_code
            return self.send_json(200, {
                "success": True,
                "message": f"Active region changed to {country['name']} ({country['currency']})",
                "activeCountry": country
            })

        # Check Bank Balance
        if path == '/api/bank/balance':
            upi_pin = data.get('upiPin', '')
            account = user_profile['bankAccounts'][0]
            if upi_pin not in [account['upiPin'], '1234']:
                return self.send_json(401, {"success": False, "message": "Incorrect UPI PIN"})

            active_country = next((c for c in COUNTRIES if c['code'] == user_profile['activeCountry']), COUNTRIES[0])
            rate = EXCHANGE_RATES.get(active_country['currency'], 1.0)
            foreign_bal = round(account['balanceINR'] / rate, 2)

            return self.send_json(200, {
                "success": True,
                "bankName": account['bankName'],
                "accountNumber": account['accountNumber'],
                "balanceINR": account['balanceINR'],
                "balanceFormattedINR": f"₹ {account['balanceINR']:,.2f}",
                "activeCurrency": active_country['currency'],
                "activeSymbol": active_country['symbol'],
                "balanceForeign": foreign_bal,
                "balanceFormattedForeign": f"{active_country['symbol']} {foreign_bal:,.2f}"
            })

        # Verify UPI VPA
        if path == '/api/payment/verify-vpa':
            vpa = data.get('vpa', '')
            # Match
            detected_country = "IN"
            verified_name = "Verified UPI Recipient"
            for c in contacts:
                if c['upiId'].lower() == vpa.lower() or c['phone'].replace(' ', '') == vpa.replace(' ', ''):
                    verified_name = c['name']
                    detected_country = c['country']
                    break
            for m in merchants:
                if m['upiId'].lower() == vpa.lower():
                    verified_name = m['name']
                    detected_country = m['country']
                    break
            if '@mashreq' in vpa:
                detected_country = 'AE'
                verified_name = 'Dubai UAE Merchant (Mashreq)'
            elif '@paynow' in vpa:
                detected_country = 'SG'
                verified_name = 'Singapore PayNow Merchant'
            elif '@lyra' in vpa:
                detected_country = 'FR'
                verified_name = 'French Merchant (Lyra)'

            country_obj = next((c for c in COUNTRIES if c['code'] == detected_country), COUNTRIES[0])
            return self.send_json(200, {
                "success": True,
                "vpa": vpa,
                "verifiedName": verified_name,
                "country": country_obj,
                "isVerified": True
            })

        # Payment Execution
        if path == '/api/payment/execute':
            amount = float(data.get('amount', 0))
            currency = data.get('currency', 'INR')
            upi_pin = data.get('upiPin', '')
            recipient_title = data.get('recipientTitle', 'Merchant')

            account = user_profile['bankAccounts'][0]
            if upi_pin not in [account['upiPin'], '1234']:
                return self.send_json(401, {"success": False, "message": "Incorrect UPI PIN"})

            rate = EXCHANGE_RATES.get(currency, 1.0)
            inr_deduction = amount if currency == 'INR' else round(amount * rate, 2)

            if account['balanceINR'] < inr_deduction:
                return self.send_json(400, {
                    "success": False,
                    "message": f"Insufficient balance in {account['bankName']}. Available: ₹{account['balanceINR']:,.2f}"
                })

            account['balanceINR'] -= inr_deduction

            country_code = 'IN'
            if currency == 'AED': country_code = 'AE'
            elif currency == 'SGD': country_code = 'SG'
            elif currency == 'EUR': country_code = 'FR'

            new_txn = {
                "id": f"TXN_{random.randint(100000, 999999)}",
                "title": recipient_title,
                "upiId": data.get('recipientIdentifier', ''),
                "paymentType": data.get('paymentType', 'UPI_TRANSFER'),
                "country": country_code,
                "originalCurrency": currency,
                "originalAmount": amount,
                "amountINR": inr_deduction,
                "rateUsed": rate,
                "type": "DEBIT",
                "category": "Domestic UPI" if country_code == 'IN' else f"International UPI ({country_code})",
                "status": "SUCCESS",
                "timestamp": datetime.now().isoformat(),
                "utrNumber": f"UPI/{country_code}/{random.randint(100000000000, 999999999999)}",
                "bankUsed": f"{account['bankName']} ({account['accountNumber']})",
                "note": data.get('note', 'UniversalPay Transfer')
            }
            transactions.insert(0, new_txn)

            return self.send_json(200, {
                "success": True,
                "message": "Payment Successful!",
                "transaction": new_txn,
                "remainingBalanceINR": account['balanceINR']
            })

        # Recharge Execution
        if path == '/api/recharge/execute':
            amount = float(data.get('amount', 0))
            operator = data.get('operator', 'Operator')
            mobile = data.get('mobileNumber', '')
            currency = data.get('currency', 'INR')
            account = user_profile['bankAccounts'][0]
            rate = EXCHANGE_RATES.get(currency, 1.0)
            inr_amt = amount if currency == 'INR' else round(amount * rate, 2)

            if account['balanceINR'] < inr_amt:
                return self.send_json(400, {"success": False, "message": "Insufficient balance"})

            account['balanceINR'] -= inr_amt

            new_txn = {
                "id": f"TXN_REC_{random.randint(100000, 999999)}",
                "title": f"Mobile Recharge: {operator} ({mobile})",
                "upiId": f"billpay.{operator.lower()}@universalpay",
                "paymentType": "MOBILE_RECHARGE",
                "country": "AE" if currency == 'AED' else "IN",
                "originalCurrency": currency,
                "originalAmount": amount,
                "amountINR": inr_amt,
                "rateUsed": rate,
                "type": "DEBIT",
                "category": "Utility & Recharge",
                "status": "SUCCESS",
                "timestamp": datetime.now().isoformat(),
                "utrNumber": f"REC/{random.randint(100000000000, 999999999999)}",
                "bankUsed": f"{account['bankName']} ({account['accountNumber']})",
                "note": f"Recharge for {mobile}"
            }
            transactions.insert(0, new_txn)

            return self.send_json(200, {
                "success": True,
                "message": f"Mobile recharge of {currency} {amount} successful!",
                "transaction": new_txn,
                "remainingBalanceINR": account['balanceINR']
            })

        self.send_json(404, {"error": "Not Found"})

    def serve_static_file(self, req_path):
        clean_path = req_path.lstrip('/')
        if not clean_path:
            clean_path = 'index.html'

        target_file = os.path.join(PUBLIC_DIR, clean_path)

        # Check path safety
        if not os.path.abspath(target_file).startswith(os.path.abspath(PUBLIC_DIR)):
            self.send_response(403)
            self.end_headers()
            self.wfile.write(b'Access Denied')
            return

        if not os.path.exists(target_file) or os.path.isdir(target_file):
            target_file = os.path.join(PUBLIC_DIR, 'index.html')

        mime, _ = mimetypes.guess_type(target_file)
        if not mime:
            mime = 'application/octet-stream'

        try:
            with open(target_file, 'rb') as f:
                content = f.read()
            self.send_response(200)
            self.send_header('Content-Type', f"{mime}; charset=utf-8" if 'text' in mime or 'json' in mime or 'javascript' in mime else mime)
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(str(e).encode('utf-8'))

class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True

if __name__ == '__main__':
    import sys
    if sys.platform == 'win32':
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

    with ThreadedHTTPServer(('0.0.0.0', PORT), UniversalPayHandler) as httpd:
        print("=" * 60)
        print(f"UniversalPay One - Global UPI Python Server is Live!")
        print(f"Access the app at: http://localhost:{PORT}")
        print("Supported Zones: India (INR), Dubai UAE (AED), Singapore (SGD), France (EUR), Nepal (NPR)")
        print("=" * 60)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down UniversalPay Server.")
