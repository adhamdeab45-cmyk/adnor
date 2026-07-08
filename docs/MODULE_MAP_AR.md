# خريطة ملفات ADNOR V200

## core
- `firebase-config.js`: إعدادات Firebase فقط.
- `firebase.js`: تهيئة Firebase وتصدير auth/db/functions.
- `api.js`: كل استدعاءات Cloud Functions.
- `state.js`: مراقبة تسجيل الدخول وبيانات المستخدم.
- `router.js`: التنقل بين التبويبات.
- `utils.js`: أدوات صغيرة مشتركة.

## services
- `auth.service.js`: دخول المستخدم.
- `finance.service.js`: الإيداع والسحب.
- `market.service.js`: شراء وبيع ADN.
- `lottery.service.js`: التذاكر.
- `wheel.service.js`: العجلة.

## features
- `auth-ui.js`: واجهة الدخول.
- `balance-ui.js`: عرض الأرصدة.
- `finance-ui.js`: واجهة الإيداع والسحب.
- `market-ui.js`: واجهة ADN.
- `lottery-ui.js`: واجهة اليانصيب.
- `wheel-ui.js`: واجهة العجلة.

## admin
- `admin-main.js`: كل لوحة الأدمن.

## agent
- `agent-main.js`: كل صفحة الوكيل.

## functions
كل تعديل رصيد موجود هنا فقط، وليس في الواجهة.
