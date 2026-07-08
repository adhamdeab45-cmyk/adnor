ADNOR V201 ROOT/PUBLIC DEPLOY READY

هذه النسخة مصممة حتى تعمل سواء كان النشر من الجذر root أو من مجلد public.

المهم:
- إذا موقعك GitHub Pages أو Render يقرأ من الجذر: استخدم index.html الموجود مباشرة في الجذر.
- إذا Firebase Hosting يقرأ من public: استخدم public/index.html.
- تم تكرار الملفات في الجذر وداخل public حتى لا يبقى الموقع يفتح نسخة قديمة.

علامة التأكد داخل الموقع:
يجب أن ترى في الأعلى: V201 ROOT READY
وداخل شراء/بيع ADN: V201 ROOT/PUBLIC

إذا لم تظهر هذه العبارة، فأنت لم تفتح النسخة الجديدة أو يوجد كاش/نشر قديم.

الأوامر النظامية عند وجود Firebase CLI:
npm --prefix functions install
firebase deploy --only functions,database,hosting

إذا ترفع على GitHub فقط، تأكد أن index.html والـ assets موجودين في جذر المستودع، وليس داخل مجلد فرعي فقط.
