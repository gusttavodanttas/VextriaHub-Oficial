import React from 'react';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Crown, Zap, Star } from 'lucide-react';

interface PlanGuardProps {
  children: React.ReactNode;
  feature: keyof ReturnType<typeof usePlanFeatures>;
  fallback?: React.ReactNode;
  showUpgrade?: boolean;
}

export const PlanGuard: React.FC<PlanGuardProps> = ({
  children,
  feature,
  fallback,
  showUpgrade = true
}) => {
  const features = usePlanFeatures();
  const hasFeature = features[feature];

  if (hasFeature) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (showUpgrade) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-amber-800">Funcionalidade Premium</CardTitle>
          </div>
          <CardDescription className="text-amber-700">
            Esta funcionalidade não está disponível no seu plano atual.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="border-amber-300 text-amber-700 hover:bg-amber-100">
              <Zap className="h-4 w-4 mr-2" />
              Fazer Upgrade
            </Button>
            <Button variant="ghost" size="sm" className="text-amber-600 hover:bg-amber-100">
              Ver Planos
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
};

interface PlanLimitGuardProps {
  children: React.ReactNode;
  currentCount: number;
  maxCount: number;
  itemName: string;
  fallback?: React.ReactNode;
}

export const PlanLimitGuard: React.FC<PlanLimitGuardProps> = ({
  children,
  currentCount,
  maxCount,
  itemName,
  fallback
}) => {
  const isLimitReached = maxCount !== -1 && currentCount >= maxCount;
  const percentage = maxCount === -1 ? 0 : (currentCount / maxCount) * 100;

  if (!isLimitReached) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <Alert variant="destructive" className="border-red-200 bg-red-50">
      <Lock className="h-4 w-4" />
      <AlertDescription className="text-red-800">
        <strong>Limite atingido:</strong> Você atingiu o limite de {maxCount} {itemName} do seu plano.
        <Button variant="outline" size="sm" className="ml-2 border-red-300 text-red-700 hover:bg-red-100">
          Fazer Upgrade
        </Button>
      </AlertDescription>
    </Alert>
  );
};

interface PlanUsageIndicatorProps {
  currentCount: number;
  maxCount: number;
  itemName: string;
  showPercentage?: boolean;
}

export const PlanUsageIndicator: React.FC<PlanUsageIndicatorProps> = ({
  currentCount,
  maxCount,
  itemName,
  showPercentage = true
}) => {
  if (maxCount === -1) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Star className="h-4 w-4 text-yellow-500" />
        <span>{currentCount} {itemName} (Ilimitado)</span>
      </div>
    );
  }

  const percentage = Math.min((currentCount / maxCount) * 100, 100);
  const isNearLimit = percentage > 80;
  const isAtLimit = percentage >= 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{itemName}</span>
        <span className={`font-medium ${isAtLimit ? 'text-red-600' : isNearLimit ? 'text-yellow-600' : 'text-green-600'}`}>
          {currentCount} / {maxCount}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${
            isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-yellow-500' : 'bg-green-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showPercentage && (
        <div className="text-xs text-muted-foreground">
          {percentage.toFixed(1)}% usado
        </div>
      )}
    </div>
  );
};