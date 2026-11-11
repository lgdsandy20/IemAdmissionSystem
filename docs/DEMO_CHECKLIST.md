# MERN POC demo checklist

1. Use sample names and documents only. Do not reveal passwords, private tokens or MongoDB connection strings.
2. Explain the flow: React -> Express/Node -> Mongoose -> MongoDB -> JSON -> React.
3. Start backend and frontend; show both startup logs briefly.
4. Register a new applicant; test marks 49 (not eligible), 101 (invalid) and 70 (eligible).
5. Submit the form and upload all three required files; complete the simulated fee action.
6. Show the saved application in MongoDB Atlas/Compass, including ID, filename references and status.
7. Sign in as a test officer, search the ID, and view/verify the documents.
8. Show one blocked approval or invalid status operation to demonstrate backend safeguards.
9. Approve and log back in as applicant to show the updated persistent status timeline.
10. Explain what is NOT implemented: actual payments, messages, OTP or seat inventory.
11. Run npm test from the server directory and explain unit tests versus integration tests.
12. Use clear browser zoom, close password-manager popups and narrate the architecture.
