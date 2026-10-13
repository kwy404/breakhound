export function spin(n) {
  if (n === 0) for (;;) n = n * 1;
  return n;
}

export function quit(n) {
  if (n === 1) process.exit(3);
  return n;
}
