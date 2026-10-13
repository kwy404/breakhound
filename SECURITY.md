# Security Policy

## Running breakhound safely

breakhound executes the code of the package it analyzes. Calling exported
functions with unusual inputs is how it finds bugs, which means any code in
that package runs on your machine with your permissions.

- Run it only on code you trust, or inside a container or VM.
- When breakhound installs a package from npm, it uses `--ignore-scripts`, so
  install scripts (`preinstall`, `install`, `postinstall`) are not run. The
  package code itself still runs when it is analyzed.
- Each analysis runs in an isolated child process with timeouts. This protects
  the analysis from hangs and crashes. It is not a security sandbox.

## Reporting a vulnerability

If you find a vulnerability in breakhound itself, please report it privately
through GitHub Security Advisories:

https://github.com/kwy404/breakhound/security/advisories/new

Please do not open a public issue for security problems. Include the version,
steps to reproduce, and the impact you observed. You will get a reply as soon
as possible, and a fix will be released before the details are made public.

## Supported versions

Only the latest released version receives security fixes.
