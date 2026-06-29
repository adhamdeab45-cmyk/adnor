ADNOR V9 - إعادة كتابة من الصفر

هذه النسخة تركّز أولاً على تسجيل الدخول بجوجل فقط.
لا يوجد دخول بكلمة سر ولا رقم هاتف في هذه النسخة، حتى نثبت Google 100%.

Firebase الرسمي:
adnor-vp

مطلوب قبل تجربة Google:
1) Firebase Authentication > Sign-in method > Google = Enabled
2) Firebase Authentication > Settings > Authorized domains:
   أضف دومين Render مثل: adnor1.onrender.com
3) Google Cloud project: adnor-vp > APIs & Services > Credentials > Web client
   Authorized JavaScript origins:
   https://adnor1.onrender.com
   Authorized redirect URIs:
   https://adnor-vp.firebaseapp.com/__/auth/handler
   https://adnor-vp.web.app/__/auth/handler
4) Render Environment:
   FIREBASE_DATABASE_URL=https://adnor-vp-default-rtdb.firebaseio.com
   DRAW_TIMEZONE=Europe/Istanbul
   ADMIN_EMAIL=adhamdeab45@gmail.com
   ADMIN_PHONE=+905445034910

ملاحظة:
FIREBASE_SERVICE_ACCOUNT_JSON اختياري للسيرفر وجدولة السحب الساعة 8. الموقع يعمل بدونه، لكن الجدولة التلقائية من السيرفر تحتاجه.
