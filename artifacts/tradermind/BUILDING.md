# ساخت نسخه‌های Android و Windows

## اجرای برنامه در وب

```sh
pnpm --filter @workspace/tradermind run dev
```

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

گردش‌کار `.github/workflows/build-native.yml` روی push به `main`/`master` و با
اجرای دستی ساخته می‌شود. پس از پایان هر دو job، APK و فایل‌های Windows را از
بخش **Artifacts** همان اجرای workflow دانلود کنید. این روند فقط فایل‌های ساخت
را نگه می‌دارد؛ چیزی را به فروشگاه یا GitHub Release منتشر نمی‌کند.
