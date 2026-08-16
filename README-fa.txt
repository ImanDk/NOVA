MIA v1.1.0 — Final Hardened

این نسخه ادامه مستقیم v1.0.0 است و دیتابیس nova_core_v06 / version 3 را بدون Migration مخرب حفظ می‌کند.

بهبودهای نهایی:
1) تمام عملیات مالی حساس (هزینه، درآمد، انتقال، تقسیم درآمد، تطبیق موجودی و Undo هزینه) در IndexedDB Transaction اتمیک انجام می‌شوند.
2) هر تطبیق دستی موجودی یک رکورد reconcile غیر درآمد/هزینه ثبت می‌کند.
3) Cloud Dirty State به صورت پایدار ذخیره می‌شود؛ اگر برنامه قبل از Sync بسته شود، اجرای بعدی ادامه می‌دهد.
4) Auto Backup عادی هر 5 دقیقه Debounce/Throttle می‌شود و هنگام Background/PageHide یک تلاش فوری انجام می‌شود.
5) GitHub Conflict Detection اضافه شده؛ تغییر Remote دیگر کورکورانه overwrite نمی‌شود.
6) بکاپ همچنان AES-GCM-256 است و Token/Recovery Key داخل Snapshot قرار نمی‌گیرند.
7) ID رکوردهای جدید از crypto.randomUUID استفاده می‌کنند.
8) Inline onclick حذف و Event Delegation اضافه شد؛ script-src دیگر unsafe-inline ندارد.
9) مقادیر کاربر مثل نام بانک و Notification text قبل از innerHTML Escape می‌شوند.
10) کدهای حساس به ماژول‌های core.js / actions.js / finance-store.js / self-test.js تفکیک شدند.
11) Logها محدود می‌شوند: حداکثر 100 app-error و 3 pre-cloud-restore.
12) Asset Versioning ?v=110 و Service Worker Cache جدید برای جلوگیری از ترکیب فایل قدیمی/جدید اضافه شد.
13) تست‌های Runtime Pure + QA Static داخل ZIP قرار دارند.

Test URL:
https://imandk.github.io/NOVA/?v=110

Quick Entry:
https://imandk.github.io/NOVA/?mode=quick&v=110
