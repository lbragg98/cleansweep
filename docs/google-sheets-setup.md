# Google Sheets setup

1. Create a Google Sheet and open **Extensions → Apps Script**.
2. Paste `docs/google-apps-script/Code.gs` into the editor.
3. Save, select `setupSpreadsheet`, and run it once. Approve the requested Sheets permissions.
4. Deploy → New deployment → Web app. Execute as you, and set access to anyone with the link.
5. Copy the deployment URL into `.env.local` as `NEXT_PUBLIC_GOOGLE_APPS_SCRIPT_URL`.
6. Restart Next.js, complete a test inspection, and confirm rows appear in the four tabs.

The app keeps local copies until the endpoint confirms a successful response. If a submission fails, use History → Retry sync.
