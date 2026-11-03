# Google Sheets setup

1. Create a Google Sheet and open **Extensions → Apps Script**.
2. Paste `docs/google-apps-script/Code.gs` into the editor.
3. Save, select `setupSpreadsheet`, and run it once. Approve the requested Sheets permissions.
4. Deploy → New deployment → Web app. Execute as you, and set access to anyone with the link.
5. Copy the deployment URL into `.env.local` as `NEXT_PUBLIC_GOOGLE_APPS_SCRIPT_URL`.
6. Restart Next.js, complete a test inspection, and confirm a row appears in `Completed Checklists` with: Date, Location, Checklist, Daypart, Manager, Completed, Completion Time, and Notes.

The app keeps local copies until the endpoint confirms a successful response. If a submission fails, use History → Retry sync.

Business days roll over at **4 AM Eastern** (`America/New_York`, including daylight saving time). Closing inspections before that cutoff default to the previous business date. A draft or open form keeps its selected date when the cutoff passes.

Select a floor and then Bar or Beverage Stations to begin. Each floor has five dayparts per area: ten slots per floor and thirty across all three floors. Submitted inspections count toward coverage while pending sync; drafts do not. Repeated inspections remain available and count once toward each slot. Progress reflects records on the current device; Google Sheets still receives every submitted inspection with its selected business date, floor, and area.
