# SmartPackageHub_Mobile

React Native (Expo) skeleton for **Resident** and **Staff** apps, sitting next to `SmartPackageHub_UI` / `SmartPackageHub_API`.

Admin Portal stays in the web UI for now.

## Stack

- Expo SDK 58 + React Native
- TypeScript
- React Navigation (native stack)

## Run

```bash
cd SmartPackageHub_Mobile
npm start
```

Then press `a` (Android emulator), `i` (iOS Simulator on macOS), or scan the QR code with Expo Go.

## Layout (mirrors web feature folders)

```
src/
  app/navigation/          # root stack
  config/env.ts            # API base URL
  features/
    authentication/        # launch, resident OTP, staff login
    package-inbox/         # resident home (skeleton)
    package-intake/        # staff intake (skeleton)
  shared/
    services/apiClient.ts
    theme/colors.ts
```

## API

Default API host is the QA VM (`http://34.180.50.189:5000`). Override with `EXPO_PUBLIC_API_BASE_URL` (see `.env.example`). Paths use `/api/v2`.

## Auth (wired)

- **Resident:** `POST /auth/resident/otp/request` + `/otp/verify` (shows test OTP when SMS is off)
- **Staff:** `POST /auth/staff/login`
- Tokens/sessions stored with **Expo SecureStore**

## Not included yet

- Camera, barcode, OCR intake
- Door slots, shelves, handover parity with web
