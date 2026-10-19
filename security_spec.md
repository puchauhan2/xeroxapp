# Security Specification: DocuDrop India Customer Document Collection System

## 1. Data Invariants
1. Customer sessions can only be created with valid identifiers and constrained fields (max sizes, required token, customer name).
2. Unauthenticated customers can NEVER list, query, or enumerate other customers' sessions or documents.
3. Only the authenticated shop owner (`puchauhan4@gmail.com` or verified admin) can list customer sessions, change print status, or delete files.
4. Document files can only be added to a matching parent session ID.
5. All IDs must strictly match regex `^[a-zA-Z0-9_\-]+$` and be <= 128 characters to prevent path traversal or injection.

## 2. Dirty Dozen Threat Scenarios
1. Scraping attack: Malicious customer calls `getDocs(collection(db, 'sessions'))` to view all documents from today's customers. MUST BE DENIED (`allow list: if isAdmin()`).
2. Impersonation update: Malicious customer attempts to mark their order as "completed" or change customerName. MUST BE DENIED (`allow update: if isAdmin()`).
3. Bulk deletion: Unauthenticated script sends delete requests to wipe shop records. MUST BE DENIED (`allow delete: if isAdmin()`).
4. ID Poisoning: An attacker passes an oversized or path-traversing ID (e.g. `../../etc/passwd` or 10KB string). MUST BE DENIED (`isValidId` check).
5. Cross-session injection: Uploading a file record with `file.sessionId != path.sessionId`. MUST BE DENIED.
6. Shadow fields: Injecting arbitrary privileged fields like `isAdmin: true` into a session document. MUST BE DENIED.
7. Unbounded string injection: Submitting a 5MB payload in customerName to cause database bloat. MUST BE DENIED (`<= 100` chars limit).
8. Admin privilege escalation: Non-owner claiming admin role without verified email or database record. MUST BE DENIED.
9. Malicious file status flip: Customer trying to tamper with file verification flags. MUST BE DENIED.
10. Unauthenticated batch deletion of files in subcollections. MUST BE DENIED.
11. Reading another customer's file list. MUST BE DENIED (`allow list: if isAdmin()`).
12. Attempting to write to root-level system collections. MUST BE DENIED (Default deny).
