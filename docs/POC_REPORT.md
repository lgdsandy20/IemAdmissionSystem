# MERN Stack POC — IEM Admission Management System

**Course:** PCC-CS504, Software Engineering and Project Management Lab  
**Project:** IEM Admission Management System  
**Purpose:** Academic demonstration using synthetic users and sample files

## Objective and architecture

The POC implements one working slice of an online admission portal. React sends a JSON application to Express running on Node.js. Express validates the request, Mongoose stores the application in MongoDB, and JSON responses update the applicant and staff screens. The lecturer permits React instead of Angular, so the POC uses **MERN**. It demonstrates the request-response loop, not a real institutional admissions service.

MongoDB was selected because an application naturally contains course, campus, marks, document-verification objects, payment status, and status history. Express centralizes authorization and validation so that a modified browser interface cannot bypass business rules.

## Implemented features

**Document uploads:** Applicants upload a mark sheet, identity proof, and photograph. Multer stores accepted JPEG, PNG or PDF files, limited to 5 MiB, using generated names on the backend. MongoDB stores their file references and review statuses, not the binary data. Officers use protected endpoints to view the files and verify or reject them, giving a reason for rejection.

**Authentication and roles:** Applicants register with an email and password; sign-in returns a short-lived JWT. On each protected route, the backend checks the token and allowed role (applicant versus officer/admin). Frontend screen navigation is for usability and is not relied upon for security.

**Eligibility and application creation:** The API rejects nonnumeric or out-of-range marks, enforces the 50% demonstration cutoff, and allows one application per applicant. A unique application ID identifies the saved record.

**Status transitions:** A newly created application begins at Submitted. The first officer document-verification action moves it to Under Review. Approval is permitted only after all three documents are uploaded and verified, and the simulated fee is Paid. Rejection is available; Approved and Rejected are final. The backend records status changes with an actor and timestamp so the applicant can see the outcome.

**Simulated integrations:** The fee route marks the application Paid without transferring money. Notification events appear in server logs, not in actual email or SMS. This is intentionally within the assignment's POC scope.

## Testing and demonstration

The pure-rule unit tests cover marks boundaries, malformed inputs, allowed and forbidden status transitions, approval conditions, rejection reasons, and file-extension/MIME checks. They do not replace backend integration testing with MongoDB. The recording or in-lab demonstration should show registration, one saved application, document upload, MongoDB persistence, staff verification, an invalid or premature operation being blocked, and the applicant's final status.

## Limitations and future work

The POC omits real payment gateways, OTP verification, outbound notifications, live seat availability, production admissions, and full audit/receipt generation. Future improvements include automated integration and end-to-end tests, stronger file inspection and malware scanning, rate limiting, accurate seat allocation, receipt PDF generation, and resilience against interrupted uploads. Only synthetic data should be used; previously published secrets need rotation.
