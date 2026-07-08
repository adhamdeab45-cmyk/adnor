# طريقة النشر

لازم تنشر 3 أشياء:

```bash
npm --prefix functions install
firebase deploy --only functions,database,hosting
```

لو تنشر GitHub Pages أو Render كواجهة فقط، الصفحات ستفتح لكن العمليات المالية لن تعمل.

سبب هذا التصميم: الأرصدة لا يجب أن تتعدل من المتصفح. كل عملية مالية تمر من السيرفر.
