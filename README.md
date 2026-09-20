# ZenjiGO Super Admin Web Frontend

Responsive Super Admin frontend derived from the supplied ZenjiGO Rider and Driver Flutter applications.

## Run
Open `index.html` in a browser, or serve this folder with any static server.

Example:
```bash
python -m http.server 8080
```
Then open `http://localhost:8080`.

## Demo authentication
- Email: any valid email (pre-filled with `admin@zenjigo.com`)
- Password: any non-empty password (demo pre-filled)
- OTP: any 6 digits
- Forgot password: email → recovery OTP → new password

## Included frontend modules
- Super Admin email + password + OTP login
- Forgot password / OTP / reset password flow
- Dashboard analytics
- Live ride / driver / parcel / tour map
- Full ride lifecycle management and ride details
- Rider accounts, wallet and activity controls
- Driver profiles, registration applications, manual verification, documents, renewals and profile-change concepts
- Parcel delivery administration
- Tour package and booking administration
- Finance ledger, wallet/top-ups, payments, commissions, driver earnings
- Driver withdrawal review
- Promotions, referrals and driver incentives
- Support chat center with ride/user context
- Safety/report investigation
- Notification campaigns
- Ride pricing, service configuration and zones
- Admin users, roles and permissions
- Audit logs
- Platform/localization/security/integration settings
- Loading states, modals, filters, responsive sidebar, dark mode and toast feedback

## Tech
HTML5, CSS3, Vanilla JavaScript, Bootstrap 5, Bootstrap Icons, Chart.js and Leaflet.

This is a frontend implementation with mock data and integration points. Replace the data in `assets/js/data.js` and action handlers in `assets/js/app.js` with API calls when the backend endpoints are ready.
