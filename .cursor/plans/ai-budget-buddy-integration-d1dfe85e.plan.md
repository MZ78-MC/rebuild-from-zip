<!-- d1dfe85e-e203-40df-8bd5-fc92403d4768 8f6117e0-9ada-48cd-a972-6f45fdc79bfa -->
# Mobile App with Capacitor and Android APK

## Overview

Convert the existing web app to a mobile app using Capacitor, optimize all UI components for mobile screens, and build an Android APK using Android Studio.

## Phase 1: Install and Configure Capacitor

### 1.1 Install Capacitor Dependencies

- Install `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`
- Add Capacitor scripts to `package.json`
- Initialize Capacitor configuration

### 1.2 Configure Capacitor

- Create `capacitor.config.ts` with app ID, app name, webDir
- Set up Android platform configuration
- Configure build output directory

## Phase 2: Mobile UI Optimization

### 2.1 Layout Component (`src/components/Layout.tsx`)

- Make header responsive (stack on mobile, horizontal on desktop)
- Optimize tab navigation for mobile (consider bottom navigation or scrollable tabs)
- Fix button spacing and prevent overlapping
- Reduce padding/margins on mobile
- Make header title smaller on mobile

### 2.2 Budget Module (`src/components/modules/BudgetModule.tsx`)

- Optimize header buttons (stack vertically or use icon-only on mobile)
- Make tabs scrollable or use dropdown on mobile
- Fix card layouts for mobile (single column)
- Optimize chart sizes for mobile screens

### 2.3 Transaction Components

- Make transaction list cards mobile-friendly
- Optimize dialogs for mobile (full-screen on mobile)
- Fix form inputs and buttons spacing
- Make tables scrollable horizontally if needed

### 2.4 Debtors Module

- Optimize table views for mobile (card view instead of table)
- Fix button groups to prevent overlapping
- Make dialogs mobile-responsive

### 2.5 Dev Assistant Module

- Optimize chat interface for mobile
- Fix input area and send button spacing
- Make message bubbles mobile-friendly

### 2.6 Global Mobile Styles

- Add mobile-specific Tailwind classes
- Fix z-index issues for mobile overlays
- Optimize touch targets (minimum 44x44px)
- Add safe area insets for notched devices

## Phase 3: Capacitor Android Setup

### 3.1 Add Android Platform

- Run `npx cap add android`
- Configure Android package name and app details
- Set up Android build configuration

### 3.2 Configure Android Permissions

- Add required permissions (internet, camera for receipt upload, file access)
- Configure AndroidManifest.xml
- Set up file provider for file uploads

### 3.3 Build Configuration

- Configure build.gradle for proper signing
- Set up version codes and names
- Configure ProGuard rules if needed

## Phase 4: Android Studio Setup

### 4.1 Open Project in Android Studio

- Sync Gradle files
- Install required SDK versions
- Configure build variants

### 4.2 Build APK

- Create signed APK or debug APK
- Test on emulator/device
- Generate release APK for distribution

## Phase 5: Testing and Fixes

### 5.1 Mobile Testing

- Test all modules on mobile viewport
- Fix any remaining UI issues
- Test file uploads (receipts, bank statements)
- Test camera access if needed

### 5.2 Performance Optimization

- Optimize images for mobile
- Reduce bundle size if needed
- Test loading times

## Implementation Details

### Key Files to Modify:

1. `package.json` - Add Capacitor dependencies and scripts
2. `capacitor.config.ts` - New file for Capacitor config
3. `src/components/Layout.tsx` - Mobile responsive header and tabs
4. `src/components/modules/BudgetModule.tsx` - Mobile-optimized layout
5. `src/components/budget/*.tsx` - All budget components for mobile
6. `src/components/modules/DebtorsModule.tsx` - Mobile table/card views
7. `src/components/modules/DevAssistantModule.tsx` - Mobile chat interface
8. `tailwind.config.ts` - Add mobile-specific breakpoints if needed
9. `vite.config.ts` - Ensure build output is correct for Capacitor

### Mobile Breakpoints:

- Use existing `useIsMobile` hook (768px breakpoint)
- Add additional breakpoints for tablets if needed
- Test on common mobile screen sizes (375px, 414px, 428px)

### Responsive Patterns:

- Stack elements vertically on mobile
- Use icon-only buttons where space is limited
- Make dialogs full-screen on mobile
- Use bottom sheets for mobile actions
- Horizontal scroll for tables/charts if needed

### To-dos

- [ ] Create database migration for user_finances and budget_goals tables with RLS policies and indexes
- [ ] Update TypeScript types in src/integrations/supabase/types.ts to include new tables
- [ ] Create finance-assistant edge function for handling financial queries and transactions
- [ ] Create process-receipt edge function for OCR using GPT-4 Vision
- [ ] Create finance-summary edge function for generating summaries and trends
- [ ] Update dev-assistant function to detect and route financial queries to finance-assistant
- [ ] Create BudgetModule component with tabs, header, and basic layout structure
- [ ] Create transaction list, add dialog, and transaction card components
- [ ] Create FinancialSummary component with monthly overview cards (Income, Expenses, Savings, Balance)
- [ ] Create SpendingCharts component with Bar, Line, and Pie charts using Recharts
- [ ] Create CategoryBreakdown component showing top spending categories
- [ ] Create BudgetGoals component for displaying and managing financial goals
- [ ] Create AITipCard component that fetches and displays daily AI-generated financial tips
- [ ] Create UploadReceiptDialog component with file upload and OCR processing
- [ ] Update Layout.tsx to add Budget Buddy tab and integrate BudgetModule
- [ ] Add financial chat interface to BudgetModule that integrates with finance-assistant
- [ ] Install Capacitor dependencies (@capacitor/core, @capacitor/cli, @capacitor/android) and add scripts to package.json
- [ ] Create capacitor.config.ts with app configuration (appId, appName, webDir, android config)
- [ ] Optimize Layout.tsx for mobile: responsive header, mobile-friendly tabs, fix button spacing
- [ ] Make BudgetModule mobile-responsive: stack header buttons, optimize tabs, fix card layouts, resize charts
- [ ] Optimize transaction list, dialogs, and forms for mobile screens (full-screen dialogs, proper spacing)
- [ ] Convert debtors table to card view on mobile, fix button groups, optimize dialogs
- [ ] Optimize chat interface for mobile: fix input area, message bubbles, send button spacing
- [ ] Run npx cap add android and configure Android package name and build settings
- [ ] Add required Android permissions (internet, camera, file access) to AndroidManifest.xml
- [ ] Open project in Android Studio, sync Gradle, configure build variants, and prepare for APK generation