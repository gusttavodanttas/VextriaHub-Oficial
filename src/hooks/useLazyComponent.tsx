
import React, { Suspense, ComponentType, lazy } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface LazyComponentOptions {
  fallback?: React.ReactNode;
  errorBoundary?: boolean;
}

export const useLazyComponent = (
  importFunc: () => Promise<{ default: ComponentType<any> }>,
  options: LazyComponentOptions = {}
) => {
  const LazyComponent = lazy(importFunc);
  
  const Component = (props: any) => {
    const fallback = options.fallback || (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-32 w-full" />
      </div>
    );

    return (
      <Suspense fallback={fallback}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };

  return Component;
};

// Utility for creating lazy routes
export const createLazyRoute = (
  importFunc: () => Promise<{ default: ComponentType<any> }>,
  fallback?: React.ReactNode
) => {
  return useLazyComponent(importFunc, { fallback });
};
