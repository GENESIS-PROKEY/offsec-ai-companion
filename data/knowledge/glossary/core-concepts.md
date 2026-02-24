# Cybersecurity Glossary — Core Concepts

## SQL Injection (SQLi)
SQL Injection is a code injection technique that exploits a security vulnerability in an application's database layer. It occurs when user input is incorrectly filtered or not strongly typed and is used as part of SQL commands. This allows attackers to interfere with the queries that an application makes to its database.

SQL injection attacks can be used to:
- Read sensitive data from the database
- Modify database data (insert/update/delete)
- Execute administration operations on the database
- Recover the content of files on the DBMS file system
- Issue commands to the operating system

### Types of SQL Injection
1. **In-band SQLi (Classic)**: The attacker uses the same communication channel to launch the attack and gather results. Error-based and UNION-based are the two most common types.
2. **Blind SQLi**: The attacker sends payloads and observes the response and behavior of the server. Boolean-based and time-based are common subtypes.
3. **Out-of-band SQLi**: The attacker uses a different channel to launch the attack and gather results, typically using DNS or HTTP requests.

### Prevention
- Use parameterized queries (prepared statements)
- Use stored procedures
- Validate and sanitize all input
- Use an ORM with parameterized queries
- Apply the principle of least privilege to database accounts

---

## Cross-Site Scripting (XSS)
Cross-Site Scripting (XSS) attacks are a type of injection where malicious scripts are injected into otherwise benign and trusted websites. XSS attacks occur when an attacker uses a web application to send malicious code, generally in the form of a browser-side script, to a different end user.

### Types of XSS
1. **Stored XSS (Persistent)**: The malicious script is permanently stored on the target server, such as in a database, message forum, or comment field.
2. **Reflected XSS (Non-Persistent)**: The malicious script is reflected off a web server, such as in an error message or search result, embedded in a URL.
3. **DOM-based XSS**: The vulnerability exists in client-side code rather than server-side code. The attack payload is executed as a result of modifying the DOM environment.

### Prevention
- Encode output (HTML entity encoding)
- Validate and sanitize input
- Use Content Security Policy (CSP) headers
- Use HttpOnly cookie flag
- Use frameworks that auto-escape XSS by design

---

## Buffer Overflow
A buffer overflow occurs when a program writes more data to a buffer (a temporary data storage area) than it can hold. This can lead to adjacent memory being overwritten, potentially altering program execution flow.

### How It Works
Programs allocate fixed-size blocks of memory (buffers) for data storage. If input validation is insufficient, an attacker can provide input larger than the buffer, overwriting adjacent memory. In stack-based overflows, this can overwrite the return address, redirecting execution to attacker-controlled code.

### Types
1. **Stack-based Buffer Overflow**: Overwrites data on the call stack, including return addresses
2. **Heap-based Buffer Overflow**: Overwrites data on the heap, affecting dynamically allocated memory
3. **Integer Overflow**: Occurs when an arithmetic operation produces a value outside the range of the data type

### Protections
- Address Space Layout Randomization (ASLR)
- Data Execution Prevention (DEP/NX)
- Stack Canaries
- Use of memory-safe languages (Rust, Go)
- Bounds checking and safe string functions

---

## Privilege Escalation
Privilege escalation is the act of exploiting a bug, design flaw, or configuration oversight in an operating system or software application to gain elevated access to resources that are normally protected.

### Types
1. **Vertical Privilege Escalation**: A lower-privileged user gains higher privileges (e.g., user → root/admin)
2. **Horizontal Privilege Escalation**: A user gains access to another user's resources at the same privilege level

### Common Techniques
- Exploiting misconfigured SUID/SGID binaries
- Kernel exploits
- Exploiting cron jobs and scheduled tasks
- PATH variable manipulation
- Exploiting weak file permissions
- Token manipulation and impersonation

---

## Phishing
Phishing is a social engineering attack that attempts to acquire sensitive information such as usernames, passwords, and credit card details by masquerading as a trustworthy entity in electronic communication.

### Types
1. **Email Phishing**: Mass emails impersonating legitimate organizations
2. **Spear Phishing**: Targeted attacks directed at specific individuals or organizations
3. **Whaling**: Phishing attacks targeting senior executives
4. **Vishing**: Voice phishing via phone calls
5. **Smishing**: SMS-based phishing

### Detection
- Check sender email addresses carefully
- Hover over links before clicking
- Look for urgency and pressure tactics
- Verify requests through separate channels
- Use email authentication (SPF, DKIM, DMARC)
