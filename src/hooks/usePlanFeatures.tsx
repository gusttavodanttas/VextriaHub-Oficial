import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export type PlanType = 'trial' | 'basico' | 'intermediario' | 'avancado' | 'premium';

interface PlanFeatures {
  // Limites quantitativos
  maxProcesses: number;
  maxClients: number;
  maxUsers: number;
  maxTasks: number;
  maxDeadlines: number;
  
  // Funcionalidades
  hasFinancialModule: boolean;
  hasGoalsModule: boolean;
  hasIAModule: boolean;
  hasAdvancedReports: boolean;
  hasTeamManagement: boolean;
  hasCustomFields: boolean;
  hasAutomation: boolean;
  hasIntegrations: boolean;
  hasAdvancedSearch: boolean;
  hasBackup: boolean;
  hasPrioritySport: boolean;
  hasWhiteLabel: boolean;
  hasApiAccess: boolean;
  
  // Notificações
  hasEmailNotifications: boolean;
  hasSmsNotifications: boolean;
  hasWhatsappNotifications: boolean;
  
  // Armazenamento
  storageLimit: number; // em GB
  hasCloudStorage: boolean;
  
  // Suporte
  supportLevel: 'basic' | 'standard' | 'premium' | 'vip';
  
  // Recursos visuais
  canCustomizeTheme: boolean;
  canUploadLogo: boolean;
}

const PLAN_FEATURES: Record<PlanType, PlanFeatures> = {
  trial: {
    maxProcesses: 10,
    maxClients: 20,
    maxUsers: 1,
    maxTasks: 50,
    maxDeadlines: 20,
    hasFinancialModule: false,
    hasGoalsModule: false,
    hasIAModule: false,
    hasAdvancedReports: false,
    hasTeamManagement: false,
    hasCustomFields: false,
    hasAutomation: false,
    hasIntegrations: false,
    hasAdvancedSearch: false,
    hasBackup: false,
    hasPrioritySport: false,
    hasWhiteLabel: false,
    hasApiAccess: false,
    hasEmailNotifications: true,
    hasSmsNotifications: false,
    hasWhatsappNotifications: false,
    storageLimit: 0.5,
    hasCloudStorage: false,
    supportLevel: 'basic',
    canCustomizeTheme: false,
    canUploadLogo: false,
  },
  basico: {
    maxProcesses: 30,
    maxClients: 100,
    maxUsers: 1,
    maxTasks: 500,
    maxDeadlines: 200,
    hasFinancialModule: false,
    hasGoalsModule: false,
    hasIAModule: false,
    hasAdvancedReports: false,
    hasTeamManagement: false,
    hasCustomFields: true,
    hasAutomation: false,
    hasIntegrations: false,
    hasAdvancedSearch: true,
    hasBackup: true,
    hasPrioritySport: false,
    hasWhiteLabel: false,
    hasApiAccess: false,
    hasEmailNotifications: true,
    hasSmsNotifications: true,
    hasWhatsappNotifications: false,
    storageLimit: 5,
    hasCloudStorage: true,
    supportLevel: 'standard',
    canCustomizeTheme: true,
    canUploadLogo: true,
  },
  intermediario: {
    maxProcesses: 100,
    maxClients: 500,
    maxUsers: 3,
    maxTasks: 2000,
    maxDeadlines: 1000,
    hasFinancialModule: false,
    hasGoalsModule: false,
    hasIAModule: false,
    hasAdvancedReports: true,
    hasTeamManagement: true,
    hasCustomFields: true,
    hasAutomation: false,
    hasIntegrations: false,
    hasAdvancedSearch: true,
    hasBackup: true,
    hasPrioritySport: false,
    hasWhiteLabel: false,
    hasApiAccess: false,
    hasEmailNotifications: true,
    hasSmsNotifications: true,
    hasWhatsappNotifications: true,
    storageLimit: 15,
    hasCloudStorage: true,
    supportLevel: 'standard',
    canCustomizeTheme: true,
    canUploadLogo: true,
  },
  avancado: {
    maxProcesses: 300,
    maxClients: 2000,
    maxUsers: 5,
    maxTasks: 10000,
    maxDeadlines: 5000,
    hasFinancialModule: true,
    hasGoalsModule: false,
    hasIAModule: false,
    hasAdvancedReports: true,
    hasTeamManagement: true,
    hasCustomFields: true,
    hasAutomation: true,
    hasIntegrations: true,
    hasAdvancedSearch: true,
    hasBackup: true,
    hasPrioritySport: true,
    hasWhiteLabel: false,
    hasApiAccess: true,
    hasEmailNotifications: true,
    hasSmsNotifications: true,
    hasWhatsappNotifications: true,
    storageLimit: 50,
    hasCloudStorage: true,
    supportLevel: 'premium',
    canCustomizeTheme: true,
    canUploadLogo: true,
  },
  premium: {
    maxProcesses: -1, // Ilimitado
    maxClients: -1,
    maxUsers: 10,
    maxTasks: -1,
    maxDeadlines: -1,
    hasFinancialModule: true,
    hasGoalsModule: true,
    hasIAModule: true,
    hasAdvancedReports: true,
    hasTeamManagement: true,
    hasCustomFields: true,
    hasAutomation: true,
    hasIntegrations: true,
    hasAdvancedSearch: true,
    hasBackup: true,
    hasPrioritySport: true,
    hasWhiteLabel: true,
    hasApiAccess: true,
    hasEmailNotifications: true,
    hasSmsNotifications: true,
    hasWhatsappNotifications: true,
    storageLimit: 100,
    hasCloudStorage: true,
    supportLevel: 'vip',
    canCustomizeTheme: true,
    canUploadLogo: true,
  },
};

export const usePlanFeatures = () => {
  const { office, isSuperAdmin } = useAuth();
  
  return useMemo(() => {
    // Super admin tem acesso completo
    if (isSuperAdmin) {
      return PLAN_FEATURES.premium;
    }
    
    // Escritório Vitalício tem acesso completo (Premium)
    if (office?.is_lifetime) {
      return PLAN_FEATURES.premium;
    }
    
    // Usar o plano do escritório ou trial como padrão
    const plan = office?.plan || 'trial';
    const features = PLAN_FEATURES[plan as PlanType] || PLAN_FEATURES.trial;
    
    return features;
  }, [office?.plan, office?.is_lifetime, isSuperAdmin]);
};

import { useStats } from './useStats';

export const usePlanLimits = () => {
  const features = usePlanFeatures();
  const { office } = useAuth();
  const { stats, loading } = useStats();
  
  return useMemo(() => {
    const checkLimit = (current: number, max: number) => {
      if (max === -1) return false; // Ilimitado
      return current >= max;
    };
    
    const getPercentage = (current: number, max: number) => {
      if (max === -1) return 0; // Ilimitado
      return Math.min((current / max) * 100, 100);
    };
    
    return {
      limits: {
        processes: {
          current: stats.processosAtivos,
          max: features.maxProcesses,
          isReached: checkLimit(stats.processosAtivos, features.maxProcesses),
          percentage: getPercentage(stats.processosAtivos, features.maxProcesses)
        },
        clients: {
          current: stats.clientes,
          max: features.maxClients,
          isReached: checkLimit(stats.clientes, features.maxClients),
          percentage: getPercentage(stats.clientes, features.maxClients)
        },
        users: {
          current: stats.colaboradores,
          max: features.maxUsers,
          isReached: checkLimit(stats.colaboradores, features.maxUsers),
          percentage: getPercentage(stats.colaboradores, features.maxUsers)
        },
        tasks: {
          current: stats.tarefasPendentes + stats.tarefasConcluidas,
          max: features.maxTasks,
          isReached: checkLimit(stats.tarefasPendentes + stats.tarefasConcluidas, features.maxTasks),
          percentage: getPercentage(stats.tarefasPendentes + stats.tarefasConcluidas, features.maxTasks)
        },
        deadlines: {
          current: stats.prazosVencendo,
          max: features.maxDeadlines,
          isReached: checkLimit(stats.prazosVencendo, features.maxDeadlines),
          percentage: getPercentage(stats.prazosVencendo, features.maxDeadlines)
        }
      },
      features,
      loading,
      currentPlan: (office?.plan || 'trial') as PlanType,
    };
  }, [features, office?.plan, stats, loading]);
};

export const PLAN_NAMES: Record<PlanType, string> = {
  trial: 'Trial (7 dias)',
  basico: 'Básico',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
  premium: 'Premium',
};

export const PLAN_PRICES: Record<PlanType, { monthly: number; yearly: number }> = {
  trial: { monthly: 0, yearly: 0 },
  basico: { monthly: 47, yearly: 470 },
  intermediario: { monthly: 97, yearly: 970 },
  avancado: { monthly: 197, yearly: 1970 },
  premium: { monthly: 397, yearly: 3970 },
};