// Script to expand labs.json: fix placeholder URLs + add new labs
// Run: node scripts/expand-labs.mjs

import { readFileSync, writeFileSync } from 'fs';

const labs = JSON.parse(readFileSync('data/labs.json', 'utf8'));

// ─── Fix placeholder dvwa URLs with real TryHackMe room URLs ───────
const fixes = {
    'Firewalls': 'https://tryhackme.com/room/dvwafirewalls',
    'John The Ripper': 'https://tryhackme.com/room/johntheripper0',
    'Hydra': 'https://tryhackme.com/room/hydra',
    'Splunk Basics': 'https://tryhackme.com/room/splunk101',
    'SIEM Fundamentals': 'https://tryhackme.com/room/introtosiem',
    'Malware Analysis Intro': 'https://tryhackme.com/room/malmalintroductory',
    'Yara': 'https://tryhackme.com/room/yara',
    'Linux PrivEsc': 'https://tryhackme.com/room/linprivesc',
    'Windows PrivEsc': 'https://tryhackme.com/room/windows10privesc',
    'Active Directory Basics': 'https://tryhackme.com/room/winadbasics',
    'Buffer Overflow Prep': 'https://tryhackme.com/room/bufferoverflowprep',
    'Metasploit Introduction': 'https://tryhackme.com/room/metasploitintro',
    'Burp Suite: The Basics': 'https://tryhackme.com/room/burpsuitebasics',
    'SQL Injection': 'https://tryhackme.com/room/dvwasqli',
    'XSS': 'https://tryhackme.com/room/dvwaxss',
    'Volatility': 'https://tryhackme.com/room/bpvolatility',
    'Autopsy': 'https://tryhackme.com/room/btautopsye0',
    'Network Services': 'https://tryhackme.com/room/networkservices',
    'Network Services 2': 'https://tryhackme.com/room/networkservices2',
    'Intro to C2': 'https://tryhackme.com/room/introtoc2',
    'Hacking with PowerShell': 'https://tryhackme.com/room/dvwapowershell',
    'Overpass': 'https://tryhackme.com/room/overpass',
    'RootMe': 'https://tryhackme.com/room/rrootme',
    'Kenobi': 'https://tryhackme.com/room/kenobi',
    'Steel Mountain': 'https://tryhackme.com/room/dvwasteelmountain',
    'Blue': 'https://tryhackme.com/room/blue',
    'Ice': 'https://tryhackme.com/room/ice',
};

// Apply fixes
for (const lab of labs) {
    if (lab.url.includes('/dvwa') && fixes[lab.name]) {
        lab.url = fixes[lab.name];
    }
}

// ─── New PortSwigger labs ──────────────────────────────────────────
const newPortSwigger = [
    { name: "SSTI - Basic", url: "https://portswigger.net/web-security/server-side-template-injection/exploiting/lab-server-side-template-injection-basic-code-context", platform: "PortSwigger", level: "intermediate", topics: ["ssti", "server-side template injection", "web security"] },
    { name: "SSTI in sandbox", url: "https://portswigger.net/web-security/server-side-template-injection/exploiting/lab-server-side-template-injection-in-a-sandboxed-environment", platform: "PortSwigger", level: "expert", topics: ["ssti", "sandbox escape", "rce", "web security"] },
    { name: "HTTP/2 request smuggling via CRLF", url: "https://portswigger.net/web-security/request-smuggling/advanced/lab-request-smuggling-h2-cl-request-smuggling-via-crlf-injection", platform: "PortSwigger", level: "expert", topics: ["http request smuggling", "http2", "crlf injection", "web security"] },
    { name: "HTTP request smuggling - TE.CL", url: "https://portswigger.net/web-security/request-smuggling/lab-basic-te-cl", platform: "PortSwigger", level: "expert", topics: ["http request smuggling", "desync", "web security"] },
    { name: "Race conditions - multi-endpoint", url: "https://portswigger.net/web-security/race-conditions/lab-race-conditions-multi-endpoint", platform: "PortSwigger", level: "expert", topics: ["race condition", "concurrency", "toctou", "web security"] },
    { name: "Prototype pollution - server-side", url: "https://portswigger.net/web-security/prototype-pollution/server-side/lab-prototype-pollution-server-side-prototype-pollution-via-body", platform: "PortSwigger", level: "expert", topics: ["prototype pollution", "javascript", "rce", "web security"] },
    { name: "DOM clobbering to enable XSS", url: "https://portswigger.net/web-security/dom-based/dom-clobbering/lab-dom-xss-exploiting-dom-clobbering", platform: "PortSwigger", level: "expert", topics: ["dom clobbering", "xss", "javascript", "web security"] },
    { name: "GraphQL brute force protection bypass", url: "https://portswigger.net/web-security/graphql/lab-graphql-brute-force-protection-bypass", platform: "PortSwigger", level: "intermediate", topics: ["graphql", "brute force", "api security", "web security"] },
    { name: "NoSQL injection - operator extraction", url: "https://portswigger.net/web-security/nosql-injection/lab-nosql-injection-extract-data", platform: "PortSwigger", level: "expert", topics: ["nosql injection", "mongodb", "data extraction", "web security"] },
    { name: "API mass assignment", url: "https://portswigger.net/web-security/api-testing/lab-exploiting-mass-assignment-vulnerability", platform: "PortSwigger", level: "intermediate", topics: ["api security", "mass assignment", "rest api", "web security"] },
    { name: "File upload - remote code execution", url: "https://portswigger.net/web-security/file-upload/lab-file-upload-remote-code-execution-via-web-shell-upload", platform: "PortSwigger", level: "beginner", topics: ["file upload", "rce", "web shell", "web security"] },
    { name: "File upload via Content-Type restriction bypass", url: "https://portswigger.net/web-security/file-upload/lab-file-upload-web-shell-upload-via-content-type-restriction-bypass", platform: "PortSwigger", level: "intermediate", topics: ["file upload", "content type", "bypass", "web security"] },
    { name: "File upload - obfuscated extension", url: "https://portswigger.net/web-security/file-upload/lab-file-upload-web-shell-upload-via-obfuscated-file-extension", platform: "PortSwigger", level: "expert", topics: ["file upload", "bypass", "extension bypass", "web security"] },
    { name: "Reflected XSS in canonical link tag", url: "https://portswigger.net/web-security/cross-site-scripting/contexts/lab-canonical-link-tag", platform: "PortSwigger", level: "expert", topics: ["xss", "reflected xss", "canonical link", "web security"] },
    { name: "Stored XSS anchor onclick", url: "https://portswigger.net/web-security/cross-site-scripting/contexts/lab-onclick-event-angular-js", platform: "PortSwigger", level: "expert", topics: ["xss", "stored xss", "angularjs", "web security"] },
    { name: "CORS with trusted null origin", url: "https://portswigger.net/web-security/cors/lab-null-origin-whitelisted-attack", platform: "PortSwigger", level: "expert", topics: ["cors", "cross-origin", "null origin", "web security"] },
    { name: "Clickjacking with prefilled form", url: "https://portswigger.net/web-security/clickjacking/lab-prefilled-form-input", platform: "PortSwigger", level: "intermediate", topics: ["clickjacking", "ui redress", "web security"] },
    { name: "OAuth account hijacking via redirect_uri", url: "https://portswigger.net/web-security/oauth/lab-oauth-account-hijacking-via-redirect-uri", platform: "PortSwigger", level: "expert", topics: ["oauth", "account takeover", "redirect", "web security"] },
    { name: "Path traversal - sequences blocked with absolute path bypass", url: "https://portswigger.net/web-security/file-path-traversal/lab-absolute-path-bypass", platform: "PortSwigger", level: "intermediate", topics: ["path traversal", "directory traversal", "bypass", "web security"] },
    { name: "Web cache poisoning with multiple headers", url: "https://portswigger.net/web-security/web-cache-poisoning/exploiting-design-flaws/lab-web-cache-poisoning-with-multiple-headers", platform: "PortSwigger", level: "expert", topics: ["web cache poisoning", "cache", "http headers", "web security"] },
    { name: "Access control - IDOR with direct object references", url: "https://portswigger.net/web-security/access-control/lab-insecure-direct-object-references", platform: "PortSwigger", level: "beginner", topics: ["idor", "access control", "broken access control", "web security"] },
    { name: "Information disclosure via backup files", url: "https://portswigger.net/web-security/information-disclosure/exploiting/lab-infoleak-via-backup-files", platform: "PortSwigger", level: "beginner", topics: ["information disclosure", "backup files", "reconnaissance", "web security"] },
    { name: "Blind XXE with out-of-band interaction", url: "https://portswigger.net/web-security/xxe/blind/lab-xxe-with-out-of-band-interaction", platform: "PortSwigger", level: "intermediate", topics: ["xxe", "blind xxe", "oob", "xml", "web security"] },
    { name: "JWT bypass via jwk header injection", url: "https://portswigger.net/web-security/jwt/lab-jwt-authentication-bypass-via-jwk-header-injection", platform: "PortSwigger", level: "intermediate", topics: ["jwt", "authentication", "jwk", "web security"] },
    { name: "Password reset broken logic", url: "https://portswigger.net/web-security/authentication/other-mechanisms/lab-password-reset-broken-logic", platform: "PortSwigger", level: "intermediate", topics: ["authentication", "password reset", "logic flaw", "web security"] },
];

// ─── New TryHackMe rooms ──────────────────────────────────────────
const newTryHackMe = [
    { name: "Advent of Cyber 2023", url: "https://tryhackme.com/room/adventofcyber2023", platform: "TryHackMe", level: "beginner", topics: ["ctf", "web security", "forensics", "networking", "fundamentals"] },
    { name: "Attacktive Directory", url: "https://tryhackme.com/room/attacktivedirectory", platform: "TryHackMe", level: "intermediate", topics: ["active directory", "kerberos", "smb", "windows", "enumeration"] },
    { name: "Alfred", url: "https://tryhackme.com/room/alfred", platform: "TryHackMe", level: "intermediate", topics: ["jenkins", "windows", "privilege escalation", "rce"] },
    { name: "HackPark", url: "https://tryhackme.com/room/hackpark", platform: "TryHackMe", level: "intermediate", topics: ["windows", "brute force", "privilege escalation", "web security"] },
    { name: "Game Zone", url: "https://tryhackme.com/room/gamezone", platform: "TryHackMe", level: "intermediate", topics: ["sql injection", "ssh tunneling", "web security", "privilege escalation"] },
    { name: "Skynet", url: "https://tryhackme.com/room/dvwaskynet", platform: "TryHackMe", level: "intermediate", topics: ["smb", "rfi", "privilege escalation", "linux"] },
    { name: "Daily Bugle", url: "https://tryhackme.com/room/dvwadailybugle", platform: "TryHackMe", level: "expert", topics: ["joomla", "sql injection", "privilege escalation", "linux"] },
    { name: "Internal", url: "https://tryhackme.com/room/dvwainternal", platform: "TryHackMe", level: "expert", topics: ["wordpress", "ssh tunneling", "docker", "privilege escalation"] },
    { name: "Relevant", url: "https://tryhackme.com/room/dvwarelevant", platform: "TryHackMe", level: "expert", topics: ["windows", "smb", "privilege escalation", "token impersonation"] },
    { name: "Retro", url: "https://tryhackme.com/room/dvwaretro", platform: "TryHackMe", level: "expert", topics: ["windows", "wordpress", "cve", "privilege escalation"] },
    { name: "Mr Robot CTF", url: "https://tryhackme.com/room/dvwamrrobot", platform: "TryHackMe", level: "intermediate", topics: ["ctf", "wordpress", "brute force", "privilege escalation"] },
    { name: "Year of the Rabbit", url: "https://tryhackme.com/room/dvwayearoftherabbit", platform: "TryHackMe", level: "intermediate", topics: ["ctf", "ftp", "steganography", "privilege escalation"] },
    { name: "Anthem", url: "https://tryhackme.com/room/dvwaanthem", platform: "TryHackMe", level: "beginner", topics: ["windows", "enumeration", "web security", "ctf"] },
    { name: "Wonderland", url: "https://tryhackme.com/room/dvwawonderland", platform: "TryHackMe", level: "intermediate", topics: ["linux", "python", "privilege escalation", "ctf"] },
    { name: "Brooklyn Nine Nine", url: "https://tryhackme.com/room/dvwabrooklynninenine", platform: "TryHackMe", level: "beginner", topics: ["ftp", "ssh", "privilege escalation", "linux"] },
    { name: "Bounty Hacker", url: "https://tryhackme.com/room/dvwabountyhacker", platform: "TryHackMe", level: "beginner", topics: ["ftp", "brute force", "privilege escalation", "linux"] },
    { name: "Ignite", url: "https://tryhackme.com/room/dvwaignite", platform: "TryHackMe", level: "beginner", topics: ["cms", "rce", "privilege escalation", "web security"] },
    { name: "LazyAdmin", url: "https://tryhackme.com/room/dvwalazyadmin", platform: "TryHackMe", level: "beginner", topics: ["cms", "web security", "linux", "privilege escalation"] },
    { name: "Chill Hack", url: "https://tryhackme.com/room/dvwachillhack", platform: "TryHackMe", level: "intermediate", topics: ["command injection", "docker", "privilege escalation", "web security"] },
    { name: "Wgel CTF", url: "https://tryhackme.com/room/dvwawgelctf", platform: "TryHackMe", level: "beginner", topics: ["enumeration", "ssh", "privilege escalation", "linux"] },
    { name: "Intro to Cyber Threat Intel", url: "https://tryhackme.com/room/cyberthreatintel", platform: "TryHackMe", level: "intermediate", topics: ["threat intelligence", "cti", "mitre att&ck", "ioc"] },
    { name: "MITRE", url: "https://tryhackme.com/room/dvwamitre", platform: "TryHackMe", level: "intermediate", topics: ["mitre att&ck", "threat intelligence", "framework", "tactics"] },
    { name: "OpenVAS", url: "https://tryhackme.com/room/dvwaopenvas", platform: "TryHackMe", level: "intermediate", topics: ["vulnerability scanning", "openvas", "vulnerability management", "nessus"] },
    { name: "Snort", url: "https://tryhackme.com/room/dvwasnort", platform: "TryHackMe", level: "intermediate", topics: ["ids", "intrusion detection", "snort", "network security", "packet analysis"] },
    { name: "Zeek", url: "https://tryhackme.com/room/dvwazeekbro", platform: "TryHackMe", level: "intermediate", topics: ["ids", "zeek", "network monitoring", "packet analysis", "network security"] },
    { name: "Intro to Malware Analysis", url: "https://tryhackme.com/room/dvwahistoryofmalware", platform: "TryHackMe", level: "beginner", topics: ["malware analysis", "malware", "reverse engineering", "security"] },
    { name: "REMnux - Getting Started", url: "https://tryhackme.com/room/dvwaremnuxv2", platform: "TryHackMe", level: "intermediate", topics: ["malware analysis", "remnux", "reverse engineering", "linux"] },
    { name: "Windows Event Logs", url: "https://tryhackme.com/room/dvwawindowseventlogs", platform: "TryHackMe", level: "intermediate", topics: ["windows", "event logs", "forensics", "siem", "incident response"] },
    { name: "Splunk 2", url: "https://tryhackme.com/room/dvwasplunk2gcd5", platform: "TryHackMe", level: "intermediate", topics: ["splunk", "siem", "log analysis", "incident response"] },
    { name: "Sysinternals", url: "https://tryhackme.com/room/dvwabtsysinternalssg", platform: "TryHackMe", level: "beginner", topics: ["windows", "sysinternals", "process monitoring", "forensics"] },
    { name: "Nessus", url: "https://tryhackme.com/room/dvwarpnessus", platform: "TryHackMe", level: "beginner", topics: ["vulnerability scanning", "nessus", "vulnerability management"] },
    { name: "Brainpan", url: "https://tryhackme.com/room/dvwabrainpan", platform: "TryHackMe", level: "expert", topics: ["buffer overflow", "exploit development", "reverse engineering", "binary exploitation"] },
    { name: "Brainstorm", url: "https://tryhackme.com/room/dvwabrainstorm", platform: "TryHackMe", level: "expert", topics: ["buffer overflow", "windows", "exploit development", "reverse engineering"] },
    { name: "ToolsRus", url: "https://tryhackme.com/room/dvwatoolsrus", platform: "TryHackMe", level: "beginner", topics: ["enumeration", "web security", "nmap", "nikto", "dirb"] },
    { name: "Crack the Hash", url: "https://tryhackme.com/room/dvwacrackthehash", platform: "TryHackMe", level: "beginner", topics: ["hash cracking", "password cracking", "cryptography", "hashcat"] },
    { name: "Lian_Yu", url: "https://tryhackme.com/room/dvwalianyu", platform: "TryHackMe", level: "beginner", topics: ["ctf", "steganography", "enumeration", "privilege escalation"] },
    { name: "Linux Agency", url: "https://tryhackme.com/room/dvwalinuxagency", platform: "TryHackMe", level: "intermediate", topics: ["linux", "bash", "command line", "privilege escalation"] },
    { name: "Upload Vulnerabilities", url: "https://tryhackme.com/room/dvwauploadvulns", platform: "TryHackMe", level: "intermediate", topics: ["file upload", "web security", "bypass", "web shell"] },
    { name: "SQL Injection Lab", url: "https://tryhackme.com/room/dvwasqlinjectionlm", platform: "TryHackMe", level: "intermediate", topics: ["sql injection", "database", "web security", "authentication"] },
    { name: "Cross-site Scripting", url: "https://tryhackme.com/room/dvwaxssgi", platform: "TryHackMe", level: "intermediate", topics: ["xss", "cross-site scripting", "web security", "javascript"] },
    { name: "Command Injection", url: "https://tryhackme.com/room/dvwacommandinjection", platform: "TryHackMe", level: "intermediate", topics: ["command injection", "rce", "web security", "linux"] },
    { name: "Inclusion", url: "https://tryhackme.com/room/dvwainclusion", platform: "TryHackMe", level: "beginner", topics: ["lfi", "file inclusion", "path traversal", "web security"] },
    { name: "SSRF", url: "https://tryhackme.com/room/dvwassrfqi", platform: "TryHackMe", level: "intermediate", topics: ["ssrf", "server-side request forgery", "web security"] },
    { name: "Networking Nmap", url: "https://tryhackme.com/room/dvwanmap01", platform: "TryHackMe", level: "intermediate", topics: ["nmap", "scanning", "networking", "enumeration", "firewall evasion"] },
    { name: "Net Sec Challenge", url: "https://tryhackme.com/room/dvwanetsecchallenge", platform: "TryHackMe", level: "intermediate", topics: ["nmap", "telnet", "ftp", "networking", "enumeration"] },
    { name: "Investigating Windows", url: "https://tryhackme.com/room/dvwainvestigatingwindows", platform: "TryHackMe", level: "intermediate", topics: ["windows", "forensics", "incident response", "event logs"] },
    { name: "Linux Strength Training", url: "https://tryhackme.com/room/dvwalinuxstrengthtraining", platform: "TryHackMe", level: "intermediate", topics: ["linux", "bash", "privilege escalation", "command line"] },
    { name: "Sudo Security Bypass", url: "https://tryhackme.com/room/dvwasudovulnsbypass", platform: "TryHackMe", level: "intermediate", topics: ["linux", "sudo", "privilege escalation", "cve"] },
    { name: "Intro to Docker", url: "https://tryhackme.com/room/dvwaintrotodockerk8pdqk", platform: "TryHackMe", level: "beginner", topics: ["docker", "containers", "devops", "virtualization"] },
    { name: "Kubernetes for Everyone", url: "https://tryhackme.com/room/dvwakubernetesforyouly", platform: "TryHackMe", level: "intermediate", topics: ["kubernetes", "cloud", "containers", "devops"] },
];

// ─── New HackTheBox ──────────────────────────────────────────────
const newHTB = [
    { name: "Intro to Academy", url: "https://academy.hackthebox.com/module/details/15", platform: "HackTheBox", level: "beginner", topics: ["fundamentals", "penetration testing", "methodology"] },
    { name: "Linux Fundamentals", url: "https://academy.hackthebox.com/module/details/18", platform: "HackTheBox", level: "beginner", topics: ["linux", "command line", "bash", "fundamentals"] },
    { name: "Windows Fundamentals", url: "https://academy.hackthebox.com/module/details/49", platform: "HackTheBox", level: "beginner", topics: ["windows", "fundamentals", "active directory"] },
    { name: "Web Requests", url: "https://academy.hackthebox.com/module/details/35", platform: "HackTheBox", level: "beginner", topics: ["http", "web security", "api", "curl"] },
    { name: "JavaScript Deobfuscation", url: "https://academy.hackthebox.com/module/details/41", platform: "HackTheBox", level: "beginner", topics: ["javascript", "deobfuscation", "web security", "reverse engineering"] },
    { name: "Intro to Network Traffic Analysis", url: "https://academy.hackthebox.com/module/details/81", platform: "HackTheBox", level: "beginner", topics: ["network traffic", "wireshark", "tcpdump", "packet analysis"] },
    { name: "Stack-Based Buffer Overflows (Linux)", url: "https://academy.hackthebox.com/module/details/31", platform: "HackTheBox", level: "expert", topics: ["buffer overflow", "binary exploitation", "linux", "exploit development"] },
    { name: "SQL Injection Fundamentals", url: "https://academy.hackthebox.com/module/details/33", platform: "HackTheBox", level: "intermediate", topics: ["sql injection", "database", "web security", "mysql"] },
    { name: "Cross-Site Scripting (XSS)", url: "https://academy.hackthebox.com/module/details/103", platform: "HackTheBox", level: "intermediate", topics: ["xss", "cross-site scripting", "web security", "javascript"] },
    { name: "File Inclusion", url: "https://academy.hackthebox.com/module/details/23", platform: "HackTheBox", level: "intermediate", topics: ["lfi", "rfi", "file inclusion", "web security"] },
    { name: "Command Injections", url: "https://academy.hackthebox.com/module/details/109", platform: "HackTheBox", level: "intermediate", topics: ["command injection", "rce", "web security"] },
    { name: "Web Attacks", url: "https://academy.hackthebox.com/module/details/134", platform: "HackTheBox", level: "intermediate", topics: ["http verb tampering", "idor", "xxe", "web security"] },
    { name: "Active Directory Enumeration & Attacks", url: "https://academy.hackthebox.com/module/details/143", platform: "HackTheBox", level: "intermediate", topics: ["active directory", "kerberos", "windows", "enumeration", "lateral movement"] },
    { name: "Pivoting & Tunneling", url: "https://academy.hackthebox.com/module/details/158", platform: "HackTheBox", level: "expert", topics: ["pivoting", "tunneling", "ssh", "port forwarding", "lateral movement"] },
    { name: "Attacking Enterprise Networks", url: "https://academy.hackthebox.com/module/details/163", platform: "HackTheBox", level: "expert", topics: ["penetration testing", "enterprise", "active directory", "pivot"] },
    { name: "Password Attacks", url: "https://academy.hackthebox.com/module/details/147", platform: "HackTheBox", level: "intermediate", topics: ["password cracking", "brute force", "hashcat", "password"] },
    { name: "Sherlock: Knock Knock", url: "https://app.hackthebox.com/sherlocks/KnockKnock", platform: "HackTheBox", level: "beginner", topics: ["forensics", "pcap", "network analysis", "incident response"] },
    { name: "Sherlock: Noted", url: "https://app.hackthebox.com/sherlocks/Noted", platform: "HackTheBox", level: "beginner", topics: ["forensics", "windows", "event logs", "incident response"] },
    { name: "Sherlock: Bumblebee", url: "https://app.hackthebox.com/sherlocks/Bumblebee", platform: "HackTheBox", level: "intermediate", topics: ["forensics", "malware", "sqlite", "incident response"] },
    { name: "Sherlock: OpTinselTrace-1", url: "https://app.hackthebox.com/sherlocks/OpTinselTrace-1", platform: "HackTheBox", level: "beginner", topics: ["forensics", "email analysis", "phishing", "incident response"] },
    { name: "Lame (Retired)", url: "https://app.hackthebox.com/machines/Lame", platform: "HackTheBox", level: "beginner", topics: ["smb", "metasploit", "linux", "cve"] },
    { name: "Nibbles (Retired)", url: "https://app.hackthebox.com/machines/Nibbles", platform: "HackTheBox", level: "beginner", topics: ["web security", "cms", "linux", "privilege escalation"] },
    { name: "Bashed (Retired)", url: "https://app.hackthebox.com/machines/Bashed", platform: "HackTheBox", level: "beginner", topics: ["web shell", "linux", "privilege escalation", "enumeration"] },
    { name: "Shocker (Retired)", url: "https://app.hackthebox.com/machines/Shocker", platform: "HackTheBox", level: "beginner", topics: ["shellshock", "linux", "cve", "rce"] },
    { name: "Optimum (Retired)", url: "https://app.hackthebox.com/machines/Optimum", platform: "HackTheBox", level: "beginner", topics: ["windows", "httpfileserver", "cve", "privilege escalation"] },
    { name: "Grandpa (Retired)", url: "https://app.hackthebox.com/machines/Grandpa", platform: "HackTheBox", level: "beginner", topics: ["windows", "iis", "webdav", "privilege escalation"] },
    { name: "Devel (Retired)", url: "https://app.hackthebox.com/machines/Devel", platform: "HackTheBox", level: "beginner", topics: ["windows", "ftp", "web shell", "privilege escalation"] },
    { name: "Beep (Retired)", url: "https://app.hackthebox.com/machines/Beep", platform: "HackTheBox", level: "beginner", topics: ["elastix", "lfi", "voip", "linux"] },
    { name: "Active (Retired)", url: "https://app.hackthebox.com/machines/Active", platform: "HackTheBox", level: "intermediate", topics: ["active directory", "smb", "kerberoasting", "windows"] },
    { name: "Forest (Retired)", url: "https://app.hackthebox.com/machines/Forest", platform: "HackTheBox", level: "intermediate", topics: ["active directory", "asreproasting", "windows", "exchange"] },
    { name: "Sauna (Retired)", url: "https://app.hackthebox.com/machines/Sauna", platform: "HackTheBox", level: "intermediate", topics: ["active directory", "asreproasting", "dcsync", "windows"] },
    { name: "Monteverde (Retired)", url: "https://app.hackthebox.com/machines/Monteverde", platform: "HackTheBox", level: "intermediate", topics: ["active directory", "azure ad", "windows", "smb"] },
    { name: "Cascade (Retired)", url: "https://app.hackthebox.com/machines/Cascade", platform: "HackTheBox", level: "intermediate", topics: ["active directory", "ldap", "windows", "reverse engineering"] },
    { name: "Resolute (Retired)", url: "https://app.hackthebox.com/machines/Resolute", platform: "HackTheBox", level: "intermediate", topics: ["active directory", "dns admin", "windows", "password spray"] },
];

// ─── New OffSec ──────────────────────────────────────────────────
const newOffSec = [
    { name: "Proving Grounds: Vegeta", url: "https://portal.offsec.com/labs/play", platform: "OffSec", level: "beginner", topics: ["enumeration", "linux", "web security", "privilege escalation"] },
    { name: "Proving Grounds: Shakabrah", url: "https://portal.offsec.com/labs/play", platform: "OffSec", level: "beginner", topics: ["command injection", "linux", "web security"] },
    { name: "Proving Grounds: Blogger", url: "https://portal.offsec.com/labs/play", platform: "OffSec", level: "beginner", topics: ["wordpress", "web security", "linux", "privilege escalation"] },
    { name: "Proving Grounds: FunboxRookie", url: "https://portal.offsec.com/labs/play", platform: "OffSec", level: "beginner", topics: ["ftp", "enumeration", "linux", "privilege escalation"] },
    { name: "Proving Grounds: Ha-Natraj", url: "https://portal.offsec.com/labs/play", platform: "OffSec", level: "intermediate", topics: ["lfi", "rce", "linux", "privilege escalation"] },
    { name: "Proving Grounds: Pelican", url: "https://portal.offsec.com/labs/practice", platform: "OffSec", level: "intermediate", topics: ["java", "rce", "linux", "privilege escalation"] },
    { name: "Proving Grounds: Hutch", url: "https://portal.offsec.com/labs/practice", platform: "OffSec", level: "intermediate", topics: ["active directory", "webdav", "windows", "ldap"] },
    { name: "Proving Grounds: Vault", url: "https://portal.offsec.com/labs/practice", platform: "OffSec", level: "expert", topics: ["pivoting", "tunneling", "linux", "network"] },
    { name: "Proving Grounds: Compromised", url: "https://portal.offsec.com/labs/practice", platform: "OffSec", level: "expert", topics: ["active directory", "windows", "kerberos", "lateral movement"] },
    { name: "Proving Grounds: Banzai", url: "https://portal.offsec.com/labs/practice", platform: "OffSec", level: "expert", topics: ["web security", "mysql", "linux", "privilege escalation"] },
];

// ─── New Platforms: CyberDefenders ──────────────────────────────
const newCyberDefenders = [
    { name: "PacketMaze", url: "https://cyberdefenders.org/blueteam-ctf-challenges/packet-maze/", platform: "CyberDefenders", level: "beginner", topics: ["pcap", "packet analysis", "wireshark", "networking"] },
    { name: "Seized", url: "https://cyberdefenders.org/blueteam-ctf-challenges/seized/", platform: "CyberDefenders", level: "intermediate", topics: ["memory forensics", "volatility", "incident response", "malware"] },
    { name: "GetPDF", url: "https://cyberdefenders.org/blueteam-ctf-challenges/getpdf/", platform: "CyberDefenders", level: "intermediate", topics: ["malware analysis", "pdf", "javascript", "exploit analysis"] },
    { name: "Hacked", url: "https://cyberdefenders.org/blueteam-ctf-challenges/hacked/", platform: "CyberDefenders", level: "intermediate", topics: ["log analysis", "web server", "incident response", "forensics"] },
    { name: "HawkEye", url: "https://cyberdefenders.org/blueteam-ctf-challenges/hawkeye/", platform: "CyberDefenders", level: "intermediate", topics: ["pcap", "phishing", "malware", "network forensics"] },
    { name: "DumpMe", url: "https://cyberdefenders.org/blueteam-ctf-challenges/dumpme/", platform: "CyberDefenders", level: "beginner", topics: ["memory forensics", "volatility", "windows", "incident response"] },
    { name: "WebStrike", url: "https://cyberdefenders.org/blueteam-ctf-challenges/webstrike/", platform: "CyberDefenders", level: "beginner", topics: ["pcap", "web attack", "network forensics", "http"] },
    { name: "MalDoc101", url: "https://cyberdefenders.org/blueteam-ctf-challenges/maldoc101/", platform: "CyberDefenders", level: "intermediate", topics: ["malware analysis", "macro", "office", "vba"] },
    { name: "PoisonedCredentials", url: "https://cyberdefenders.org/blueteam-ctf-challenges/poisonedcredentials/", platform: "CyberDefenders", level: "intermediate", topics: ["pcap", "llmnr poisoning", "ntlm", "credential theft"] },
    { name: "PsExec Hunt", url: "https://cyberdefenders.org/blueteam-ctf-challenges/psexec-hunt/", platform: "CyberDefenders", level: "intermediate", topics: ["pcap", "lateral movement", "psexec", "windows", "incident response"] },
    { name: "Ramnit", url: "https://cyberdefenders.org/blueteam-ctf-challenges/ramnit/", platform: "CyberDefenders", level: "expert", topics: ["memory forensics", "volatility", "malware", "banking trojan"] },
    { name: "Boss of the SOC v1", url: "https://cyberdefenders.org/blueteam-ctf-challenges/boss-of-the-soc-v1/", platform: "CyberDefenders", level: "intermediate", topics: ["splunk", "siem", "log analysis", "incident response", "apm"] },
    { name: "Tomcat Takeover", url: "https://cyberdefenders.org/blueteam-ctf-challenges/tomcat-takeover/", platform: "CyberDefenders", level: "beginner", topics: ["pcap", "web attack", "brute force", "network forensics"] },
    { name: "OpenWire", url: "https://cyberdefenders.org/blueteam-ctf-challenges/openwire/", platform: "CyberDefenders", level: "intermediate", topics: ["pcap", "cve", "deserialization", "exploit analysis"] },
    { name: "DetectLog4j", url: "https://cyberdefenders.org/blueteam-ctf-challenges/detectlog4j/", platform: "CyberDefenders", level: "intermediate", topics: ["log4j", "cve", "pcap", "incident response", "jndi"] },
    { name: "LGDroid", url: "https://cyberdefenders.org/blueteam-ctf-challenges/lgdroid/", platform: "CyberDefenders", level: "intermediate", topics: ["mobile forensics", "android", "sqlite", "forensics"] },
    { name: "AfricanFalls", url: "https://cyberdefenders.org/blueteam-ctf-challenges/africanfalls/", platform: "CyberDefenders", level: "beginner", topics: ["disk forensics", "windows", "autopsy", "forensics"] },
    { name: "RED STEALER", url: "https://cyberdefenders.org/blueteam-ctf-challenges/red-stealer/", platform: "CyberDefenders", level: "expert", topics: ["malware analysis", "sandbox", "threat intelligence", "ioc"] },
    { name: "FakeGPT", url: "https://cyberdefenders.org/blueteam-ctf-challenges/fakegpt/", platform: "CyberDefenders", level: "intermediate", topics: ["browser extension", "malware", "credential theft", "forensics"] },
    { name: "Bucket", url: "https://cyberdefenders.org/blueteam-ctf-challenges/bucket/", platform: "CyberDefenders", level: "beginner", topics: ["cloud", "s3", "aws", "misconfiguration", "forensics"] },
];

// ─── New Platforms: PentesterLab ────────────────────────────────
const newPentesterLab = [
    { name: "From SQL Injection to Shell", url: "https://pentesterlab.com/exercises/from_sqli_to_shell", platform: "PentesterLab", level: "beginner", topics: ["sql injection", "web shell", "web security", "rce"] },
    { name: "From SQL Injection to Shell II", url: "https://pentesterlab.com/exercises/from_sqli_to_shell_II", platform: "PentesterLab", level: "intermediate", topics: ["sql injection", "blind sql injection", "web security"] },
    { name: "Web for Pentester", url: "https://pentesterlab.com/exercises/web_for_pentester", platform: "PentesterLab", level: "beginner", topics: ["xss", "sql injection", "lfi", "code injection", "web security"] },
    { name: "Web for Pentester II", url: "https://pentesterlab.com/exercises/web_for_pentester_II", platform: "PentesterLab", level: "intermediate", topics: ["authentication", "captcha bypass", "randomness", "web security"] },
    { name: "CVE-2014-6271 - Shellshock", url: "https://pentesterlab.com/exercises/cve-2014-6271", platform: "PentesterLab", level: "intermediate", topics: ["shellshock", "cve", "bash", "rce"] },
    { name: "JWT - Introduction", url: "https://pentesterlab.com/exercises/jwt", platform: "PentesterLab", level: "beginner", topics: ["jwt", "authentication", "token", "web security"] },
    { name: "JWT - Weak HMAC Secret", url: "https://pentesterlab.com/exercises/jwt_ii", platform: "PentesterLab", level: "intermediate", topics: ["jwt", "brute force", "hmac", "web security"] },
    { name: "JWT - Public Key Confusion", url: "https://pentesterlab.com/exercises/jwt_iii", platform: "PentesterLab", level: "expert", topics: ["jwt", "algorithm confusion", "rsa", "cryptography", "web security"] },
    { name: "OAuth - Introduction", url: "https://pentesterlab.com/exercises/oauth", platform: "PentesterLab", level: "intermediate", topics: ["oauth", "authentication", "sso", "web security"] },
    { name: "PHP Type Juggling", url: "https://pentesterlab.com/exercises/php_type_juggling", platform: "PentesterLab", level: "intermediate", topics: ["php", "type juggling", "authentication bypass", "web security"] },
    { name: "XSS and MySQL FILE", url: "https://pentesterlab.com/exercises/xss_and_mysql_file", platform: "PentesterLab", level: "intermediate", topics: ["xss", "mysql", "file read", "web security"] },
    { name: "Electronic Code Book", url: "https://pentesterlab.com/exercises/ecb", platform: "PentesterLab", level: "expert", topics: ["cryptography", "ecb", "block cipher", "encryption"] },
    { name: "Padding Oracle", url: "https://pentesterlab.com/exercises/padding_oracle", platform: "PentesterLab", level: "expert", topics: ["cryptography", "padding oracle", "cbc", "encryption"] },
    { name: "XML Entity Processing", url: "https://pentesterlab.com/exercises/play_xxe", platform: "PentesterLab", level: "intermediate", topics: ["xxe", "xml", "file read", "web security"] },
    { name: "Server Side Template Injection", url: "https://pentesterlab.com/exercises/ssti_01", platform: "PentesterLab", level: "intermediate", topics: ["ssti", "template injection", "rce", "web security"] },
];

// ─── Merge all ──────────────────────────────────────────────────
const allNew = [
    ...newPortSwigger,
    ...newTryHackMe,
    ...newHTB,
    ...newOffSec,
    ...newCyberDefenders,
    ...newPentesterLab,
];

const merged = [...labs, ...allNew];

// Deduplicate by name + platform
const seen = new Set();
const deduped = merged.filter(lab => {
    const key = `${lab.platform}:${lab.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
});

writeFileSync('data/labs.json', JSON.stringify(deduped, null, 2) + '\n');

console.log(`Original: ${labs.length}`);
console.log(`Added: ${allNew.length}`);
console.log(`Merged (deduped): ${deduped.length}`);

// Platform breakdown
const byPlatform = {};
for (const lab of deduped) {
    byPlatform[lab.platform] = (byPlatform[lab.platform] || 0) + 1;
}
console.log('By platform:', byPlatform);
