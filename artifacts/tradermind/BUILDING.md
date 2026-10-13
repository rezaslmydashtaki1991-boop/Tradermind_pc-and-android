# ساخت نسخه‌های Android و Windows

## اجرای برنامه در وب

```sh
pnpm --filter @workspace/tradermind run dev
```

تایپ صوتی فارسی از Web Speech API مرورگر استفاده می‌کند؛ مرورگر سازگار و مجوز
میکروفون لازم است و در بیشتر مرورگرها اتصال اینترنت نیاز می‌شود. در نسخهٔ فعلی
تشخیص گفتار آفلاین تضمین نشده است.

## ساخت APK اندروید برای نصب و آزمایش

روی دستگاه سازنده باید Java 21 و Android SDK نصب باشد و `ANDROID_HOME` یا
`ANDROID_SDK_ROOT` تنظیم شده باشد. سپس:

```sh
pnpm install --frozen-lockfile --filter @workspace/tradermind...
pnpm --filter @workspace/tradermind run build:android:debug
```

فایل خروجی:

```text
artifacts/tradermind/android/app/build/outputs/apk/debug/app-debug.apk
```

این APK با کلید debug خود Android امضا می‌شود و برای نصب و آزمایش است؛ نسخه
فروشگاهی محسوب نمی‌شود.

## ساخت نسخه Windows 64-bit

این دستور را روی Windows اجرا کنید:

```powershell
pnpm install --frozen-lockfile --filter @workspace/tradermind...
pnpm --filter @workspace/tradermind run build:windows:x64
```

خروجی‌ها در `artifacts/tradermind/dist/windows/` قرار می‌گیرند: نصب‌کننده‌ی
NSIS و نسخه‌ی portable برای معماری x64.

## ساخت خودکار با GitHub Actions

گردش‌کار `.github/workflows/build-tradermind-releases.yml` با اجرای دستی، فایل‌ها
را به **Artifacts** همان اجرای Actions اضافه می‌کند و Release عمومی نمی‌سازد.
برای ساخت و انتشار Release نسخه‌دار، تگ `v*` را push کنید؛ فقط در این حالت job
انتشار GitHub Release اجرا می‌شود. اجرای دستی روی `main` عمداً Release با نام
`main` منتشر نمی‌کند.

## راهنمای نصب

### ویندوز

1. فایل `TraderMind-…-Windows-x64.exe` را برای نصب معمولی اجرا کنید.
2. مسیر نصب ثابت است تا نصب نسخهٔ جدید با نصب قبلی تداخل نداشته باشد.
3. فایل `…-Portable.exe` را برای اجرای بدون نصب انتخاب کنید.

### اندروید

1. APK را به دستگاه منتقل و باز کنید.
2. در صورت درخواست، اجازهٔ نصب برنامه از منبع انتخاب‌شده را فعال کنید.
3. پس از نصب، برنامه را از صفحهٔ برنامه‌ها باز کنید.

این APK برای نصب و آزمایش مستقیم امضای debug دارد و جایگزین نسخهٔ امضاشدهٔ
فروشگاهی نیست.

## راهنمای انتقال اطلاعات بین دستگاه‌ها

1. در دستگاه مبدأ از بخش **پشتیبان‌گیری و بازیابی**، پشتیبان کامل برنامه را
   بسازید و فایل را به دستگاه مقصد منتقل کنید.
2. در نسخهٔ وب، ویندوز یا اندروید همان بخش را باز و فایل پشتیبان کامل را وارد
   کنید.
3. حالت **جایگزینی** اطلاعات مقصد را با پشتیبان عوض می‌کند؛ حالت **ادغام**
   اطلاعات را با داده‌های موجود ترکیب می‌کند.
4. گزارش Word فقط برای مطالعه و چاپ است و برای بازیابی استفاده نمی‌شود.
