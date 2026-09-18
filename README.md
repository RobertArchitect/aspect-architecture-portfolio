# ASPECT portfolio

The public portfolio is a static Vite/React site deployed to GitHub Pages. Project content is read from Cloud Firestore; authenticated publishing uses Firebase Authentication, Firestore, and Cloud Storage.

## Run locally

```bash
npm install
npm run dev
```

Use `/admin` to open the project editor. The editor requires Google sign-in. Publishing and uploads are authorised by the Firebase Security Rules, not by a client-side allowlist.

## Firebase configuration

The Firebase project is `aspectportfolio`. The browser configuration lives in `src/firebase.js`; Firebase web configuration is public by design. Its API key does not grant data access — the deployed Firestore rules do.

The allowlisted administrators are `robertarch9@gmail.com` and `s.s.guyum@gmail.com`. Firestore reads are public so portfolio visitors can see published work. Firestore writes require one of those Google accounts. Image uploads use Cloudinary's public client-side upload configuration (cloud name `fogield7`, preset `aspect-portfolio`); never add a Cloudinary API secret to this repository. The Cloudinary preset must remain unsigned and restrict uploads to JPG, JPEG, PNG, and WebP files no larger than 10 MB.

Deploy the rules after signing in to the Firebase CLI:

```bash
npx firebase-tools login
npm run firebase:deploy-rules
```

In Firebase Authentication, enable Google and authorise `aspect.am`, `www.aspect.am`, and `robertarchitect.github.io`.

## First Firestore seed

After the rules are deployed, sign in to `/admin` as an allowlisted administrator and select **Seed original projects**. This writes the existing four projects to Firestore while retaining their current static images. Later projects can upload images directly to Cloudinary.

## Verify

```bash
npm run lint
npm run build
```

For a production check, visit `https://aspect.am/admin` signed out, then sign in with the allowlisted Google account. Add, edit, and remove a temporary project, verifying each change from an incognito browser before deleting it.
