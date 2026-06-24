
import { useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';

interface PerformanceMetrics {
  route: string;
  loadTime: number;
  renderTime: number;
  timestamp: number;
  userAgent: string;
}

interface UserInteraction {
  type: 'click' | 'scroll' | 'input';
  element: string;
  timestamp: number;
  route: string;
}

export const usePerformanceMonitoring = () => {
  const location = useLocation();
  const observersRef = useRef<PerformanceObserver[]>([]);
  const isInitializedRef = useRef(false);

  // Monitor navigation performance
  const trackNavigation = useCallback((route: string) => {
    try {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      
      if (navigation) {
        const metrics: PerformanceMetrics = {
          route,
          loadTime: navigation.loadEventEnd - navigation.fetchStart,
          renderTime: navigation.domContentLoadedEventEnd - navigation.fetchStart,
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
        };
        
        // Em produção, enviar para serviço de analytics
        console.log('Performance metrics:', metrics);
        // analyticsService.track('page_performance', metrics);
      }
    } catch (error) {
      console.warn('Error tracking navigation performance:', error);
    }
  }, []);

  // Monitor user interactions
  const trackInteraction = useCallback((type: UserInteraction['type'], element: string) => {
    try {
      const interaction: UserInteraction = {
        type,
        element,
        timestamp: Date.now(),
        route: location.pathname,
      };
      
      console.log('User interaction:', interaction);
      // analyticsService.track('user_interaction', interaction);
    } catch (error) {
      console.warn('Error tracking user interaction:', error);
    }
  }, [location.pathname]);

  // Track Core Web Vitals - inicializado apenas uma vez
  const initializeWebVitalsTracking = useCallback(() => {
    if (isInitializedRef.current) return;
    
    try {
      // Largest Contentful Paint (LCP)
      if ('PerformanceObserver' in window && 'largest-contentful-paint' in PerformanceObserver.supportedEntryTypes) {
        const lcpObserver = new PerformanceObserver((list) => {
          try {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            console.log('LCP:', lastEntry.startTime);
            // analyticsService.track('web_vital', { metric: 'LCP', value: lastEntry.startTime });
          } catch (error) {
            console.warn('Error processing LCP entry:', error);
          }
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        observersRef.current.push(lcpObserver);
      }

      // First Input Delay (FID)
      if ('PerformanceObserver' in window && 'first-input' in PerformanceObserver.supportedEntryTypes) {
        const fidObserver = new PerformanceObserver((list) => {
          try {
            const entries = list.getEntries();
            entries.forEach((entry: any) => {
              console.log('FID:', entry.processingStart - entry.startTime);
              // analyticsService.track('web_vital', { metric: 'FID', value: entry.processingStart - entry.startTime });
            });
          } catch (error) {
            console.warn('Error processing FID entry:', error);
          }
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
        observersRef.current.push(fidObserver);
      }

      // Cumulative Layout Shift (CLS)
      if ('PerformanceObserver' in window && 'layout-shift' in PerformanceObserver.supportedEntryTypes) {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          try {
            const entries = list.getEntries();
            entries.forEach((entry: any) => {
              if (!entry.hadRecentInput) {
                clsValue += entry.value;
              }
            });
            console.log('CLS:', clsValue);
            // analyticsService.track('web_vital', { metric: 'CLS', value: clsValue });
          } catch (error) {
            console.warn('Error processing CLS entry:', error);
          }
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        observersRef.current.push(clsObserver);
      }

      isInitializedRef.current = true;
    } catch (error) {
      console.warn('Error initializing web vitals tracking:', error);
    }
  }, []);

  // Inicializar web vitals apenas uma vez
  useEffect(() => {
    initializeWebVitalsTracking();
    
    // Cleanup observers on unmount
    return () => {
      observersRef.current.forEach(observer => {
        try {
          observer.disconnect();
        } catch (error) {
          console.warn('Error disconnecting observer:', error);
        }
      });
      observersRef.current = [];
      isInitializedRef.current = false;
    };
  }, []); // Empty dependency array - só executa uma vez

  // Track navigation apenas quando a rota muda
  useEffect(() => {
    trackNavigation(location.pathname);
  }, [location.pathname, trackNavigation]);

  return {
    trackInteraction,
    trackNavigation,
  };
};
