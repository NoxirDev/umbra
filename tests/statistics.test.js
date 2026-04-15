describe('StatisticsManager', () => {
  let mockFs;
  let mockPath;
  let mockApp;
  let StatisticsManager;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();

    const stats = { 'test-stats': JSON.stringify({
      allTime: { totalDonations: 10, totalAmount: 5000, totalMessages: 200, topDonators: [], firstDonation: null, lastDonation: null },
      sessions: []
    })};

    mockFs = {
      existsSync: jest.fn((p) => p.includes('statistics')),
      readFileSync: jest.fn((p) => {
        if (p.includes('statistics')) return stats['test-stats'];
        return '{}';
      }),
      writeFileSync: jest.fn(),
      renameSync: jest.fn(),
      unlinkSync: jest.fn(),
    };

    mockApp = { getPath: jest.fn(() => '/tmp/test') };

    jest.doMock('fs', () => mockFs);
    jest.doMock('electron', () => ({ app: mockApp }));
    jest.doMock('../src/shared/constants', () => ({
      APP_NAME: 'UMBRA', APP_VERSION: '2.1.1',
    }));

    StatisticsManager = require('../src/main/statistics');
  });

  afterEach(() => {
    jest.runAllTimers();
    jest.useRealTimers();
  });

  test('loads statistics from disk', () => {
    const mgr = new StatisticsManager();
    const stats = mgr.getAllTimeStats();
    expect(stats.totalDonations).toBe(10);
    expect(stats.totalAmount).toBe(5000);
    expect(stats.totalMessages).toBe(200);
  });

  test('recordDonation updates stats', () => {
    const mgr = new StatisticsManager();
    mgr.recordDonation({ name: 'Alice', amount: 100, timestamp: new Date().toISOString() });
    const stats = mgr.getAllTimeStats();
    expect(stats.totalDonations).toBe(11);
    expect(stats.totalAmount).toBe(5100);
  });

  test('recordMessage updates stats', () => {
    const mgr = new StatisticsManager();
    mgr.recordMessage();
    const stats = mgr.getAllTimeStats();
    expect(stats.totalMessages).toBe(201);
  });

  test('topDonators is sorted and limited', () => {
    const mgr = new StatisticsManager();
    mgr.recordDonation({ name: 'A', amount: 100, timestamp: new Date().toISOString() });
    mgr.recordDonation({ name: 'B', amount: 500, timestamp: new Date().toISOString() });
    mgr.recordDonation({ name: 'C', amount: 300, timestamp: new Date().toISOString() });
    const top = mgr.getTopDonators(3);
    expect(top[0].name).toBe('B');
    expect(top[1].name).toBe('C');
    expect(top[2].name).toBe('A');
  });

  test('import validates data', () => {
    const mgr = new StatisticsManager();
    const result = mgr.import({
      allTime: { totalDonations: 'invalid', totalAmount: -5, totalMessages: 50, topDonators: 'not-array' },
      sessions: [{ start: 'bad', end: 'bad' }]
    });
    expect(result).toBe(true);
    const stats = mgr.getAllTimeStats();
    expect(stats.totalDonations).toBe(0);
    expect(stats.totalAmount).toBe(0);
  });

  test('reset clears stats', () => {
    const mgr = new StatisticsManager();
    mgr.reset();
    const stats = mgr.getAllTimeStats();
    expect(stats.totalDonations).toBe(0);
    expect(stats.totalAmount).toBe(0);
  });
});
