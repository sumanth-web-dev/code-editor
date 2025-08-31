import { renderHook, act } from '@testing-library/react';
import { useResponsive } from '../useResponsive';

// Mock window.matchMedia
const mockMatchMedia = (matches: boolean) => ({
  matches,
  media: '',
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
});

describe('useResponsive', () => {
  const originalMatchMedia = window.matchMedia;
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;

  beforeEach(() => {
    // Reset window dimensions
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768,
    });
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: originalInnerHeight,
    });
  });

  it('detects desktop screen correctly', () => {
    window.matchMedia = jest.fn().mockImplementation((query) => {
      if (query === '(max-width: 768px)') return mockMatchMedia(false);
      if (query === '(max-width: 1024px)') return mockMatchMedia(false);
      if (query === '(pointer: coarse)') return mockMatchMedia(false);
      return mockMatchMedia(false);
    });

    const { result } = renderHook(() => useResponsive());

    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isTouchDevice).toBe(false);
    expect(result.current.orientation).toBe('landscape');
  });

  it('detects mobile screen correctly', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    window.matchMedia = jest.fn().mockImplementation((query) => {
      if (query === '(max-width: 768px)') return mockMatchMedia(true);
      if (query === '(max-width: 1024px)') return mockMatchMedia(true);
      if (query === '(pointer: coarse)') return mockMatchMedia(true);
      return mockMatchMedia(false);
    });

    const { result } = renderHook(() => useResponsive());

    expect(result.current.isMobile).toBe(true);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isTouchDevice).toBe(true);
    expect(result.current.orientation).toBe('portrait');
  });

  it('detects tablet screen correctly', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 800,
    });

    window.matchMedia = jest.fn().mockImplementation((query) => {
      if (query === '(max-width: 768px)') return mockMatchMedia(false);
      if (query === '(max-width: 1024px)') return mockMatchMedia(true);
      if (query === '(pointer: coarse)') return mockMatchMedia(true);
      return mockMatchMedia(false);
    });

    const { result } = renderHook(() => useResponsive());

    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(true);
    expect(result.current.isTouchDevice).toBe(true);
    expect(result.current.orientation).toBe('landscape');
  });

  it('detects portrait orientation correctly', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 600,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 800,
    });

    window.matchMedia = jest.fn().mockImplementation((query) => {
      return mockMatchMedia(false);
    });

    const { result } = renderHook(() => useResponsive());

    expect(result.current.orientation).toBe('portrait');
  });

  it('detects landscape orientation correctly', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 800,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 600,
    });

    window.matchMedia = jest.fn().mockImplementation((query) => {
      return mockMatchMedia(false);
    });

    const { result } = renderHook(() => useResponsive());

    expect(result.current.orientation).toBe('landscape');
  });

  it('updates on window resize', () => {
    let mobileQuery: any;
    let tabletQuery: any;
    let touchQuery: any;

    window.matchMedia = jest.fn().mockImplementation((query) => {
      const mockMedia = mockMatchMedia(false);
      if (query === '(max-width: 768px)') {
        mobileQuery = mockMedia;
        return mockMedia;
      }
      if (query === '(max-width: 1024px)') {
        tabletQuery = mockMedia;
        return mockMedia;
      }
      if (query === '(pointer: coarse)') {
        touchQuery = mockMedia;
        return mockMedia;
      }
      return mockMedia;
    });

    const { result } = renderHook(() => useResponsive());

    // Initially desktop
    expect(result.current.isMobile).toBe(false);

    // Simulate mobile breakpoint
    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      
      // Simulate media query change
      if (mobileQuery && mobileQuery.addEventListener) {
        mobileQuery.matches = true;
        const changeEvent = new Event('change');
        mobileQuery.addEventListener.mock.calls[0][1](changeEvent);
      }
    });

    // Should detect mobile after resize
    expect(result.current.isMobile).toBe(true);
  });

  it('handles missing matchMedia gracefully', () => {
    // @ts-ignore
    window.matchMedia = undefined;

    const { result } = renderHook(() => useResponsive());

    // Should provide default values
    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isTouchDevice).toBe(false);
    expect(result.current.orientation).toBe('landscape');
  });

  it('cleans up event listeners on unmount', () => {
    const removeEventListener = jest.fn();
    
    window.matchMedia = jest.fn().mockImplementation(() => ({
      ...mockMatchMedia(false),
      removeEventListener,
    }));

    const { unmount } = renderHook(() => useResponsive());

    unmount();

    // Should have called removeEventListener for each media query
    expect(removeEventListener).toHaveBeenCalledTimes(3);
  });

  it('handles edge case window dimensions', () => {
    // Test exactly at breakpoint
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 768,
    });

    window.matchMedia = jest.fn().mockImplementation((query) => {
      if (query === '(max-width: 768px)') return mockMatchMedia(true);
      if (query === '(max-width: 1024px)') return mockMatchMedia(true);
      return mockMatchMedia(false);
    });

    const { result } = renderHook(() => useResponsive());

    expect(result.current.isMobile).toBe(true);
    expect(result.current.isTablet).toBe(false);
  });

  it('handles square aspect ratio', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 800,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 800,
    });

    window.matchMedia = jest.fn().mockImplementation(() => mockMatchMedia(false));

    const { result } = renderHook(() => useResponsive());

    // Square should be considered landscape (width >= height)
    expect(result.current.orientation).toBe('landscape');
  });
});