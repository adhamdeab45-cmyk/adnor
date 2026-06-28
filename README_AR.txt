ADNOR V11 TODAY FULL — مبني على كود V6 الشغال

طريقة الرفع:
1. فك الضغط.
2. ارفع محتويات المجلد كاملة إلى GitHub، وليس ملف ZIP نفسه.
3. على Render استخدم:
   Build Command: npm install --registry=https://registry.npmjs.org/
   Start Command: npm start
4. Environment Variables:
   FIREBASE_DATABASE_URL=https://adnor-new-default-rtdb.firebaseio.com/
   FIREBASE_PROJECT_ID=adnor-new
   DRAW_TIMEZONE=Europe/Istanbul
   ADMIN_TOKEN=اكتب_كلمة_قوية

روابط الفحص:
/api/health
/api/version

بعد دخول المدير:
- افتح لوحة المدير.
- ادخل إلى "إعدادات الموقع العامة".
- اضغط "تثبيت كل إعدادات اليوم الرسمية" مرة واحدة.

النسخة أضافت ملف:
public/adnor_today_full_patch.js
هذا الملف يحتوي كل إضافات اليوم بدون حذف كود V6 الأساسي.


==============================
تحديث V12 — دخول Gmail + رقم هاتف OTP فقط
==============================
- تم إلغاء دخول الإيميل + كلمة السر من الواجهة.
- الدخول الرسمي الآن: Gmail/Google أو رقم هاتف مع كود تحقق.
- Google يستخدم Redirect بدل Popup حتى يكون أكثر ثباتاً على Render والمتصفحات.
- رقم الهاتف يحتاج تفعيل Phone provider من Firebase Authentication.

خطوات Firebase المطلوبة:
1) Firebase Console → Authentication → Sign-in method → فعّل Google.
2) Firebase Console → Authentication → Sign-in method → فعّل Phone.
3) Firebase Console → Authentication → Settings → Authorized domains → أضف: adnor-v11.onrender.com
4) للتجربة بدون SMS حقيقي: من Phone provider أضف Test phone number مثل +905000000000 والكود 123456.

بعد رفع الملفات على GitHub اعمل Render → Manual Deploy → Deploy latest commit.
