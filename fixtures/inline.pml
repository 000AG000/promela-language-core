/* Inline definitions are expanded at call sites by SPIN. */
inline reset(target, replacement) {
  target = replacement;
}

inline increment(target) {
  target = target + 1;
}

inline tick() {
  skip;
}

active proctype Worker() {
  byte counter;
  reset(counter, 0);
  increment(counter);
  tick();
  assert(counter == 1);
}
