import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * The spec asks for a code review before merge confirming that practice screens
 * import no API client, no data hooks and no payment SDK. A review catches it
 * once; this catches it on every run, including for whoever adds the next demo
 * screen a year from now.
 *
 * This is the whole safety argument for the demo approach. There is no runtime
 * guard, no allowlist and no request interceptor — a guide cannot book, charge,
 * log or send anything because the code that would do it is not on these
 * screens at all. That claim is only true while this test passes.
 */
const DEMO_DIR = join(process.cwd(), 'src/guide/demo');

const FORBIDDEN = [
  { pattern: /from\s+['"].*services\/apiService['"]/, what: 'the shared API client' },
  { pattern: /from\s+['"].*services\/cafeApiService['"]/, what: 'the cafe API client' },
  { pattern: /from\s+['"].*services\/cafeSupabase['"]/, what: 'the cafe Supabase client' },
  { pattern: /from\s+['"].*services\/\w+Service['"]/, what: 'a data service' },
  { pattern: /from\s+['"]axios['"]/, what: 'axios directly' },
  { pattern: /from\s+['"]react-native-razorpay['"]/, what: 'the payment SDK' },
  { pattern: /from\s+['"].*services\/socketService['"]/, what: 'the socket client' },
  { pattern: /from\s+['"]expo-notifications['"]/, what: 'the notifications module' },
  { pattern: /from\s+['"].*store\/walletStore['"]/, what: "the member's real wallet" },
  { pattern: /from\s+['"].*store\/chatStore['"]/, what: 'the real chat store' },
  { pattern: /from\s+['"].*utils\/handleInsufficientCoins['"]/, what: 'the coin-shortfall helper' },
  { pattern: /\bfetch\s*\(/, what: 'a bare fetch call' },
];

const demoFiles = readdirSync(DEMO_DIR).filter((f) => f.endsWith('.js'));

/**
 * Comments are stripped before checking. These files explain at length what
 * they deliberately do not import, so a naive scan flags the very sentence
 * promising the thing is absent.
 */
function code(file) {
  return readFileSync(join(DEMO_DIR, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('demo screens are isolated from everything that writes', () => {
  it('finds the demo screens to check', () => {
    expect(demoFiles.length).toBeGreaterThan(8);
  });

  for (const file of demoFiles) {
    it(`${file} imports nothing that could reach the network`, () => {
      const src = code(file);
      for (const { pattern, what } of FORBIDDEN) {
        expect(pattern.test(src), `${file} reaches for ${what}`).toBe(false);
      }
    });
  }

  // The banner is the member's only signal that a balance dropping on screen is
  // not their real one, so it has to be on every screen of the run.
  it('puts the practice banner on every demo screen', () => {
    const screens = demoFiles.filter((f) => f.startsWith('GuideDemo'));
    expect(screens.length).toBeGreaterThan(5);
    for (const file of screens) {
      const src = code(file);
      expect(src.includes('DemoScaffold'), `${file} has no practice banner`).toBe(true);
    }
  });

  // The practice balance must never come from, or write to, the real one.
  it('keeps the practice balance in its own store', () => {
    const src = code('demoBookingState.js');
    expect(src).not.toMatch(/AsyncStorage|SecureStore/);
    expect(src).toMatch(/DEMO_BALANCE/);
  });
});
