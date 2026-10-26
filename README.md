# Nightfall Game Lounge

Fresh Vite + vanilla JS project with Firebase Authentication, a Realtime Database lobby, room creation/joining, and live Tic-Tac-Toe moves.

## Install and run
Node.js 20.19+ or 22.12+ recommended for Vite 8.
```bash
npm install
npm run dev
```
Build/deploy:
```bash
npm run build
firebase deploy --only hosting
```
Firebase Console: enable Email/Password in Authentication and create Realtime Database.

IMPORTANT: The current database rules you set earlier allow all signed-in users to write all data. They are not safe for a public launch. Before launch, add restrictive Realtime Database rules or trusted backend validation. This is a multiplayer prototype; chat and admin moderation are not included yet.
## Game deletion and admin
The lobby shows **Delete game** only to the room creator or the admin account `vmsk131uh@gmail.com`. A confirmation appears before the room (including chat stored under it) is removed.

For Firebase-side enforcement, `database.rules.json` contains starter Realtime Database rules for authenticated room access and deletion. Review and publish these in **Firebase Console → Realtime Database → Rules**. Replace conflicting broad write rules, especially any `.write` rule at the database root or `/games`, because Firebase grants access if an ancestor rule already grants it. Test the rules with two accounts before launch. These are starter rules for this prototype, not a full validation of every game move.
