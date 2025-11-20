# Mobile App Setup Guide

## Overview
The MZ Assistant app has been configured for mobile deployment using Capacitor. The app is optimized for mobile screens with responsive layouts, full-screen dialogs, and touch-friendly UI elements.

## Prerequisites

1. **Android Studio** - Download and install from [developer.android.com](https://developer.android.com/studio)
2. **Java Development Kit (JDK)** - Android Studio includes JDK, but ensure JDK 11 or higher is installed
3. **Android SDK** - Install through Android Studio's SDK Manager

## Project Structure

- `capacitor.config.ts` - Capacitor configuration file
- `android/` - Android native project directory
- `dist/` - Built web assets (generated after `npm run build`)

## Building the APK

### Step 1: Build Web Assets
```bash
npm run build
```

This creates the optimized production build in the `dist/` folder.

### Step 2: Sync with Capacitor
```bash
npx cap sync android
```

This copies the web assets to the Android project and updates native dependencies.

### Step 3: Open in Android Studio
```bash
npx cap open android
```

Or manually open Android Studio and select `File > Open` and navigate to the `android/` folder.

### Step 4: Build APK in Android Studio

1. **Wait for Gradle Sync** - Android Studio will automatically sync Gradle files. Wait for this to complete.

2. **Configure Build Variant**:
   - Click on `Build Variants` tab (usually at bottom left)
   - Select `debug` for testing or `release` for production

3. **Build Debug APK** (for testing):
   - Go to `Build > Build Bundle(s) / APK(s) > Build APK(s)`
   - Wait for build to complete
   - Click `locate` in the notification to find the APK
   - Location: `android/app/build/outputs/apk/debug/app-debug.apk`

4. **Build Release APK** (for distribution):
   - First, set up signing:
     - Go to `Build > Generate Signed Bundle / APK`
     - Select `APK`
     - Create or select a keystore
     - Fill in keystore details
   - Build the signed APK
   - Location: `android/app/build/outputs/apk/release/app-release.apk`

## Android Permissions

The following permissions are configured in `AndroidManifest.xml`:
- **INTERNET** - Required for API calls to Supabase
- **CAMERA** - For receipt/statement photo capture
- **READ_EXTERNAL_STORAGE** - For accessing files
- **WRITE_EXTERNAL_STORAGE** - For saving files (Android 9 and below)
- **READ_MEDIA_IMAGES** - For accessing images (Android 13+)
- **READ_MEDIA_VIDEO** - For accessing videos (Android 13+)

## Mobile Optimizations

### UI Improvements
- ✅ Responsive header (stacks on mobile)
- ✅ Scrollable tabs on mobile
- ✅ Full-screen dialogs on mobile
- ✅ Touch-friendly buttons (minimum 44x44px)
- ✅ Optimized chart sizes for mobile
- ✅ Mobile-friendly chat interfaces
- ✅ Card-based layouts for tables on mobile
- ✅ Proper spacing and padding adjustments

### Components Optimized
- Layout.tsx - Header and tabs
- BudgetModule - All budget components
- TransactionList - Filters and cards
- FinancialChat - Chat interface
- DevAssistantModule - Chat interface
- DebtorsModule - Card grid layout
- All dialogs - Full-screen on mobile

## Development Workflow

1. **Make changes** to React components
2. **Build** with `npm run build`
3. **Sync** with `npx cap sync android`
4. **Test** in Android Studio emulator or device
5. **Repeat** as needed

## Testing on Device

1. Enable **Developer Options** on your Android device:
   - Go to Settings > About Phone
   - Tap "Build Number" 7 times
   
2. Enable **USB Debugging**:
   - Go to Settings > Developer Options
   - Enable "USB Debugging"

3. Connect device via USB and run:
   ```bash
   npx cap run android
   ```

Or use Android Studio's device manager to deploy directly.

## Troubleshooting

### Gradle Sync Fails
- Ensure you have the latest Android SDK installed
- Check that `compileSdkVersion` matches your SDK version
- Try `File > Invalidate Caches / Restart` in Android Studio

### Build Errors
- Clean project: `Build > Clean Project`
- Rebuild: `Build > Rebuild Project`
- Check that all dependencies are properly synced

### App Crashes on Launch
- Check Android Studio Logcat for error messages
- Ensure all Capacitor plugins are properly installed
- Verify that `dist/` folder contains built assets

### Permission Issues
- Check `AndroidManifest.xml` for required permissions
- For Android 13+, ensure runtime permissions are requested in code if needed

## Next Steps

1. **Test the app** on a physical device or emulator
2. **Customize app icon** in `android/app/src/main/res/`
3. **Configure app signing** for release builds
4. **Set up app store listing** if publishing to Google Play Store

## Notes

- The app uses HTTPS scheme for security
- File provider is configured for file sharing
- All web assets are bundled in the APK
- The app works offline for cached content, but requires internet for API calls

