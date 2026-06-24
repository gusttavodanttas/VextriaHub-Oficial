import React from 'react';
import { Box, Container, Typography, Grid, Card, CardContent, LinearProgress, Chip } from '@mui/material';
import { BarChart, TrendingUp, PieChart, Activity, Users, Clock, Target, DollarSign } from 'lucide-react';

function Analytics() {
  const metrics = [
    {
      title: 'Usuários Ativos',
      value: '--',
      change: 'N/A',
      trend: 'neutral',
      icon: <Users size={24} />,
      color: 'primary'
    },
    {
      title: 'Taxa de Conversão',
      value: '--%',
      change: 'N/A',
      trend: 'neutral',
      icon: <Target size={24} />,
      color: 'success'
    },
    {
      title: 'Receita Total',
      value: 'R$ --',
      change: 'N/A',
      trend: 'neutral',
      icon: <DollarSign size={24} />,
      color: 'info'
    },
    {
      title: 'Tempo Médio',
      value: '--',
      change: 'N/A',
      trend: 'neutral',
      icon: <Clock size={24} />,
      color: 'warning'
    }
  ];

  const chartData = [
    { name: 'Desktop', value: 0, color: '#1976d2' },
    { name: 'Mobile', value: 0, color: '#dc004e' },
    { name: 'Tablet', value: 0, color: '#9c27b0' }
  ];

  const getTrendColor = (trend) => {
    return trend === 'up' ? 'success' : trend === 'down' ? 'error' : 'default';
  };

  const getTrendIcon = (trend) => {
    return trend === 'up' ? '↗' : trend === 'down' ? '↘' : '--';
  };

  return (
    <Box sx={{ flexGrow: 1, py: 8 }}>
      <Container maxWidth="lg">
        <Typography
          variant="h2"
          component="h1"
          gutterBottom
          align="center"
          sx={{ mb: 6 }}
        >
          Analytics
        </Typography>
        
        <Typography
          variant="h6"
          component="p"
          align="center"
          sx={{ mb: 6, color: 'text.secondary' }}
        >
          Acompanhe métricas importantes e insights do seu negócio
        </Typography>
        
        {/* Métricas Principais */}
        <Grid container spacing={4} sx={{ mb: 6 }}>
          {metrics.map((metric, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ color: `${metric.color}.main` }}>
                      {metric.icon}
                    </Box>
                    <Chip 
                      label={`${getTrendIcon(metric.trend)} ${metric.change}`}
                      size="small"
                      color={getTrendColor(metric.trend)}
                      variant="outlined"
                    />
                  </Box>
                  <Typography variant="h4" component="div" gutterBottom>
                    {metric.value}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {metric.title}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
        
        {/* Gráficos e Análises */}
        <Grid container spacing={4}>
          <Grid item xs={12} md={8}>
            <Card sx={{ height: '400px' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <BarChart size={24} sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h5" component="h2">
                    Tráfego ao Longo do Tempo
                  </Typography>
                </Box>
                <Box sx={{ 
                  height: '300px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  backgroundColor: 'grey.50',
                  borderRadius: 1
                }}>
                  <Typography variant="h6" color="text.secondary">
                    Conecte suas fontes de dados para visualizar gráficos
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '400px' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <PieChart size={24} sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h5" component="h2">
                    Dispositivos
                  </Typography>
                </Box>
                <Box sx={{ mt: 2 }}>
                  {chartData.map((item, index) => (
                    <Box key={index} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2">{item.name}</Typography>
                        <Typography variant="body2" fontWeight="bold">{item.value}%</Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={item.value} 
                        sx={{ 
                          height: 8, 
                          borderRadius: 4,
                          backgroundColor: 'grey.200',
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: item.color
                          }
                        }}
                      />
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        
        {/* Insights e Atividades */}
        <Grid container spacing={4} sx={{ mt: 4 }}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <TrendingUp size={24} sx={{ mr: 1, color: 'success.main' }} />
                  <Typography variant="h5" component="h2">
                    Insights Principais
                  </Typography>
                </Box>
                <Box sx={{ space: 2 }}>
                  <Typography variant="body1" color="text.secondary" gutterBottom>
                    • Conecte suas fontes de dados para ver insights personalizados
                  </Typography>
                  <Typography variant="body1" color="text.secondary" gutterBottom>
                    • Análises automáticas serão geradas com base nos seus dados
                  </Typography>
                  <Typography variant="body1" color="text.secondary" gutterBottom>
                    • Identifique padrões e tendências importantes
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    • Receba recomendações baseadas em IA
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <Activity size={24} sx={{ mr: 1, color: 'info.main' }} />
                  <Typography variant="h5" component="h2">
                    Atividade Recente
                  </Typography>
                </Box>
                <Box sx={{ space: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Nenhuma atividade registrada ainda
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    As atividades do sistema aparecerão aqui
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Configure suas integrações para começar
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Monitore eventos em tempo real
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export default Analytics;