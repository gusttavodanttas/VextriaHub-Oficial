import React from 'react';
import { Box, Container, Typography, Grid, Paper, Card, CardContent } from '@mui/material';
import { styled } from '@mui/material/styles';
import { BarChart, TrendingUp, Users, Activity } from 'lucide-react';

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'dark' ? '#1A2027' : '#fff',
  ...theme.typography.body2,
  padding: theme.spacing(3),
  textAlign: 'center',
  color: theme.palette.text.secondary,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  transition: 'transform 0.3s ease-in-out',
  '&:hover': {
    transform: 'translateY(-5px)',
  },
}));

function Dashboard() {
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
          Dashboard
        </Typography>
        
        <Grid container spacing={4}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Users size={24} />
                  <Typography variant="h6" sx={{ ml: 1 }}>Usuários</Typography>
                </Box>
                <Typography variant="h4" color="primary">--</Typography>
                <Typography variant="body2" color="text.secondary">Aguardando dados</Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Activity size={24} />
                  <Typography variant="h6" sx={{ ml: 1 }}>Atividade</Typography>
                </Box>
                <Typography variant="h4" color="primary">--</Typography>
                <Typography variant="body2" color="text.secondary">Aguardando dados</Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <TrendingUp size={24} />
                  <Typography variant="h6" sx={{ ml: 1 }}>Crescimento</Typography>
                </Box>
                <Typography variant="h4" color="primary">--%</Typography>
                <Typography variant="body2" color="text.secondary">Aguardando dados</Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <BarChart size={24} />
                  <Typography variant="h6" sx={{ ml: 1 }}>Relatórios</Typography>
                </Box>
                <Typography variant="h4" color="primary">--</Typography>
                <Typography variant="body2" color="text.secondary">Aguardando dados</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        
        <Grid container spacing={4} sx={{ mt: 4 }}>
          <Grid item xs={12} md={8}>
            <Item>
              <Typography variant="h5" component="h2" gutterBottom>
                Gráfico de Performance
              </Typography>
              <Typography color="text.secondary">
                Conecte suas fontes de dados para visualizar gráficos de performance em tempo real.
              </Typography>
            </Item>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Item>
              <Typography variant="h5" component="h2" gutterBottom>
                Atividades Recentes
              </Typography>
              <Typography color="text.secondary">
                As atividades recentes aparecerão aqui quando você começar a usar o sistema.
              </Typography>
            </Item>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export default Dashboard;