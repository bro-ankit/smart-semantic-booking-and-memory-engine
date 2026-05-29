// jsdom → parse5 is pure ESM which ts-jest cannot handle in CJS mode.
// Factory mocks intercept require() before Jest tries to load the real modules.
jest.mock('jsdom', () => ({ JSDOM: jest.fn() }));
jest.mock('@mozilla/readability', () => ({ Readability: jest.fn() }));
jest.mock('puppeteer', () => ({ __esModule: true, default: { launch: jest.fn() } }));
