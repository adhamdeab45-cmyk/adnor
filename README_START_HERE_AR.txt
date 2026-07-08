ADNOR V200 MODULAR REBUILD
==========================

هذه نسخة جديدة منظمة من الصفر، هدفها أن كل جزء يكون مفصول حتى ما نخرب الموقع كل ما عدلنا شيء.

الهيكل:

public/index.html              واجهة المستخدم
public/admin.html              لوحة الأدمن
public/agent.html              صفحة وكيل الشحن
public/assets/css/base.css     التصميم العام فقط
public/assets/js/core/         ملفات Firebase والحالة والراوتر والأدوات
public/assets/js/services/     الاتصال بالسيرفر والخدمات
public/assets/js/features/     صفحات المستخدم: محفظة، ADN، يانصيب، عجلة
public/assets/js/admin/        أكواد الأدمن فقط
public/assets/js/agent/        أكواد الوكيل فقط
functions/index.js             كل العمليات المالية الآمنة من السيرفر
database.rules.json            قواعد Realtime Database
firebase.json                  إعداد النشر

مهم جداً:
كل العمليات المالية صارت من Cloud Functions:
- شراء ADN
- بيع ADN
- شراء تذكرة
- عجلة الحظ
- طلب الإيداع
- طلب السحب
- شحن الوكيل

يعني المستخدم لا يعدل رصيده من الواجهة. هذا يمنع أخطاء PERMISSION_DENIED ويمنع التلاعب.

طريقة الرفع الصحيحة:
1) ارفع الملف كامل على GitHub.
2) من جهاز فيه Firebase CLI أو من بيئة النشر، نفذ:
   npm --prefix functions install
   firebase deploy --only functions,database,hosting

إذا رفعت hosting فقط بدون functions، الشراء والبيع المالي لن يعمل، وهذا مقصود للأمان.

أول أدمن:
تم تثبيت إيميلات الأدمن داخل functions/index.js:
- adhamdeab2@gmail.com
- adhamdeab45@gmail.com

افتح:
/           للمستخدم
/admin.html للأدمن
/agent.html للوكيل

ملاحظة:
هذه نسخة منظمة جديدة وليست ترقيعاً فوق ملف V175 الكبير. الهدف أن نكمل عليها مستقبلاً بترتيب.
