# Privacy Policy — DMS-ACAD

_Last updated: August 5, 2026_

> This file mirrors [`public/privacy-policy.html`](public/privacy-policy.html), which is the version served
> live once the app is deployed (e.g. `https://dmsacad.com/privacy-policy.html`). **Use the live HTML URL**,
> not this file, as the Privacy Policy link in Google Play Console — Play Store requires a reachable web URL,
> not a repository file.

DMS-ACAD ("the App") is a school administration application developed by **DMS DEV** ("we", "us") and
provided to schools and their staff, students, and parents ("you", "users") to manage academic records such
as staff, students, classes, subjects, marks, and attendance. This policy explains what data the App handles
and how.

## Who controls the data

DMS-ACAD is a multi-tenant application: each subscribing school has its own dedicated database, and accounts
are created and managed by that school's own administrators. The school you belong to is the **data
controller** for the academic records it stores (student and staff personal data, marks, attendance, etc.).
DMS DEV acts as the **data processor**, providing the technical infrastructure that stores and serves this
data on the school's behalf. Requests to access, correct, or delete a specific student's or staff member's
record should be directed to your school's administration first; we assist the school in fulfilling such
requests.

## Information we process

- **Account credentials** — the login and password issued to you by your school's administrator, used solely
  to authenticate you to the App.
- **Staff and student records** — as entered by your school's administrators: names, sex, date/place of
  birth, class/subject assignments, marks, attendance and discipline records, parent/guardian names, and
  (optionally) a profile photo uploaded by an administrator.
- **Session information** — your selected school, school year, and section, kept on your device (browser
  local/session storage) so you don't have to re-select them each time you open the App.
- **Authentication tokens** — a short-lived access token is kept in memory only (never written to disk) and a
  longer-lived refresh token is stored in a secure, HTTP-only cookie that your device sends automatically to
  keep you signed in; neither is readable by other apps or scripts.

We do **not** collect this information for our own purposes (marketing, profiling, resale, or any use
unrelated to operating the App for your school). We do not use advertising SDKs, third-party
analytics/tracking SDKs, or sell any data to third parties.

## Device permissions

The Android app only requests Internet access. It does not request camera, microphone, location, contacts, or
storage permissions. Photos (student/staff pictures) are selected via the device's normal file/photo picker,
not captured directly through a permission the App holds.

## Documents generated on your device

Report cards, class lists, mark sheets, and similar PDF/Excel documents are generated locally on your device
from data already loaded in the App, then handed to Android's native share sheet so you can save or share
them (e.g., to Google Drive, email, or a file manager). These generated files are not additionally uploaded
to any server operated by us.

## Data storage and security

Academic data is stored in your school's dedicated database on our hosting infrastructure and is transmitted
using authenticated, token-based API requests. Access to a school's data is restricted to accounts created by
that school's own administrators and scoped by role (administrator, teacher, supervisor, parent, student,
etc.).

## Data retention and deletion

Records are retained for as long as your school continues to use the App, or as required by the school's own
record-keeping obligations. A school administrator can remove a staff or student account and its associated
records at any time through the App. To request deletion of your personal account or data directly from us,
use the contact details below.

## Children's data

Because DMS-ACAD manages school records, it may process data relating to students who are minors. This data
is entered and controlled by the school (acting in its educational capacity), not collected directly from
children by us. Parent/student accounts only expose the records the school has chosen to make visible to
that role.

## Changes to this policy

We may update this policy from time to time. Material changes will be reflected by updating the "Last
updated" date above. Continued use of the App after a change constitutes acceptance of the revised policy.

## Contact us

**DMS DEV**
Email: [dmsschoolmanager@gmail.com](mailto:dmsschoolmanager@gmail.com)
Phone: [+237 698 64 06 70](tel:+237698640670)
Website: [https://dmsacad.com](https://dmsacad.com)
