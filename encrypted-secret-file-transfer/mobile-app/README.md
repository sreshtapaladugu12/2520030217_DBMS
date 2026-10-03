# Secret Transfer Mobile App

Expo / React Native / TypeScript client for the existing Encrypted Secret File Transfer backend. All app API requests go through the API Gateway; the app never contacts MongoDB or internal services. The gateway and services remain the authority for authentication, file authorization, encryption and audit events.

## Requirements

- Node.js 22.13 or newer and npm (SDK 57 minimum)
- Expo Go for quick device testing, or Android Studio / Xcode for native builds
- The backend and MongoDB configured and running (see the repository README)

## Install and run

```powershell
cd mobile-app
Copy-Item .env.example .env
npm install
npx expo start
```

This project targets the current Expo SDK 57, so install the current Expo Go app. Scan the QR code or press `a` / `i` in the Expo terminal when the corresponding emulator is available. Android Studio must have an Android emulator image installed; open the emulator before `npx expo start --android`. On a Mac, install Xcode and an iOS Simulator runtime before `npx expo start --ios`. Use `npx expo start --clear` after changing the API URL or Expo configuration.

## API URL

Set `EXPO_PUBLIC_API_URL` in `mobile-app/.env` to the gateway origin including port, with no `/api` suffix:

| Target | Example |
| --- | --- |
| Android Studio emulator | `http://10.0.2.2:4000` |
| iOS simulator | `http://localhost:4000` |
| Physical Android or iPhone | `http://<computer-LAN-IP>:4000` |
| Production build | `https://<your-gateway-host>` |

For a physical phone, find the computer's LAN IPv4 address with `ipconfig` (Windows) or `ip addr` / Network settings (Linux/macOS). The phone and computer must be on a reachable network, and the gateway/firewall must permit port 4000. For Docker, publish the gateway on the host (the included compose file maps `4000:4000`). Do not use `localhost` from a physical phone. Restart Expo after changing `.env`.

For a physical Android phone, install Expo Go from Google Play, put the phone and computer on the same Wi-Fi network, set the LAN address in `.env`, run `npx expo start --lan`, and scan the QR code. To sideload an EAS APK, download the build artifact and run `adb install .\app-preview.apk` with Android platform-tools installed and USB debugging enabled. iPhone development through Expo Go requires the iPhone app and a reachable gateway; native iOS builds and the iOS Simulator require macOS/Xcode locally, or an EAS cloud build.

Local development allows cleartext HTTP for the emulator and LAN gateway through `plugins/withDevelopmentCleartext.js`. Production builds explicitly disable cleartext, and the API client requires an HTTPS URL in any non-development build. Use TLS at the production gateway or reverse proxy. Never put backend `.env` secrets in the mobile `.env`.

## Backend and database

From the repository root, copy `.env.example` to `.env`, set strong `MONGODB_URI`, `JWT_SECRET`, `FILE_ENCRYPTION_KEY` and `INTERNAL_API_KEY` values, and start MongoDB. Then run:

```powershell
npm install
npm run start
```

This starts the auth, file, permission and audit services plus the gateway on port 4000. The mobile app uses only `/api/*` routes on that gateway. `npm run reset:data` seeds demo accounts and data; it is destructive to existing database contents, so use it only with a disposable development database.

## App features and backend routes

- Registration, login, session restore in `expo-secure-store`, logout and automatic clearing on a 401.
- Dashboard aggregates live data from `GET /api/overview`.
- Owned and shared file lists use `GET /api/files?scope=owned|shared`, FlatList, search and pull-to-refresh.
- Upload uses the device document picker and multipart field `file` at `POST /api/files/upload`; AES-256-GCM encryption remains server-side.
- Details, authorized download, owner sharing, permission list/revoke and deletion use the existing `/api/files` and `/api/permissions` endpoints. Downloads are saved in app cache and offered to the OS share/open sheet. The backend's current upload limit defaults to 10 MB and allowed extensions are configured in `shared/constants.js`.
- Activity uses `GET /api/logs`; profile exposes live gateway service health.
- Admin role receives real admin stats, user list and system-wide logs, and can enable/disable other accounts through the existing admin API. Backend role checks remain authoritative.

## Android APK / AAB with EAS

The included `eas.json` defines preview APK and production AAB profiles. Set a reachable HTTPS gateway URL in each EAS environment and build as follows (replace the example host):

```powershell
npm install --global eas-cli
eas login
eas init
eas env:set --name EXPO_PUBLIC_API_URL --value https://api.example.com --environment preview --visibility plaintext
eas env:set --name EXPO_PUBLIC_API_URL --value https://api.example.com --environment production --visibility plaintext
eas build --platform android --profile preview
eas build --platform android --profile production
```

The preview build is an installable APK; production produces an Android App Bundle. EAS prompts for Android signing credentials. The Android application ID and iOS bundle ID are `com.example.secrettransfer`; change them in `app.config.js` to your own reverse-DNS identifier before publishing.

## iOS

Expo Go on iOS simulator or a physical iPhone can run the development app. A physical iPhone and App Store/TestFlight builds require an Apple developer account and EAS credentials. Set the HTTPS gateway URL for production and run `eas build --platform ios --profile production`; use `npx expo start --ios` for the simulator on macOS with Xcode installed. EAS can build iOS in the cloud from Windows. SDK 57 builds target iOS 16.4 or newer.

## Limitations in this backend

- Uploads are currently limited by the backend (10 MB by default) and only its extension allowlist is accepted. Increasing the limit requires coordinated gateway and file-service configuration.
- The permission API supports `download` and `view`; the app offers download sharing. A `view` grant cannot download bytes.
- Shared file listings do not return permission creation timestamps, so the app cannot display the shared date.
- Admins can view metadata, statistics and audit records, but cannot download other users' files; the app preserves that authorization model.
- `npm audit` currently reports 4 high and 12 moderate advisories in the Expo dependency tree. The suggested fixes do not preserve the tested SDK 57 dependency set, so they were not applied; re-audit before publishing and update when compatible fixes are available.

## Troubleshooting

- **Network request failed:** verify the backend is listening on `:4000`; use `10.0.2.2` on Android emulator, `localhost` on iOS simulator, or the computer LAN IP on a phone.
- **401 / returned to sign in:** token expired or was invalidated; sign in again.
- **413 / 415 on upload:** backend size cap or extension allowlist rejected the file.
- **502 / partial dashboard:** one of the independently running backend services is unavailable; check `/api/service-status`.
- **Physical phone cannot connect:** check same LAN, host firewall, Docker port publishing and gateway binding. The server must be reachable on the host interface, not only loopback.
- **Production build says API URL is missing:** set `EXPO_PUBLIC_API_URL` to a publicly reachable HTTPS gateway URL in the EAS build environment.
