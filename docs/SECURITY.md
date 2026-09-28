# Security architecture

## Decision

Use Firebase callable Cloud Functions running the Admin SDK as the only trusted boundary for invitation validation and survey submission.

- Require Firebase Authentication on every callable. The current UX uses anonymous sign-in to avoid adding a visible account step.
- Enforce Firebase App Check on callable requests, using the web app's configured reCAPTCHA provider.
- Keep Firestore Admin SDK reads and writes inside Functions. Browser clients must not read invitation documents or write submissions directly.
- Submit answers and mark the invitation used in one Firestore transaction.
- Treat a retry with the same answers as the same successful submission; reject conflicting retries without overwriting.
- Return only the participant display name needed by the welcome screen from invitation validation.

The `submitSurvey(invitationId, answers)` callable is implemented in `functions/src/index.ts`. It validates the full question/option allowlist, payload shape and size, and invitation document before writing. Restrictive client rules are implemented in TODO-037; moving invitation lookup behind a callable remains in TODO-038.

The interim rules from TODO-037 deny collection listing, all client writes, and all response reads. They temporarily permit an authenticated single-document invitation read until TODO-038 moves validation fully server-side.

## Credential limitations

Anonymous Authentication identifies a client session; it does not prove a participant's real-world identity. An invitation code remains a bearer credential. App Check helps reject requests that do not come from an attested app, but it is not a replacement for strong user authentication or a defense against every automated attack.

Invitation codes should be generated with sufficient entropy and delivered privately. If the application later handles data requiring stronger identity assurance, add a second authentication factor rather than treating a secret word as proof of identity.

## Deployment requirements

- Enable Firebase Anonymous Authentication and App Check for the web app.
- Configure the App Check site key in the web environment.
- Deploy the callable Functions and restrictive Firestore rules from this repository.
- Cloud Functions deployment requires a Firebase project on a plan that supports Functions.
- Never expose Admin SDK credentials or service-account keys to the browser.