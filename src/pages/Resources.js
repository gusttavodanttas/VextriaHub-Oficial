import React from 'react';
import { Box, Container, Typography, Grid, Paper, Card, CardContent, CardActions, Button } from '@mui/material';
import { styled } from '@mui/material/styles';
import { FileText, Database, Cloud, Settings } from 'lucide-react';

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

function Resources() {
  const resources = [
    {
      title: 'Documentos',
      description: 'Gerencie todos os seus documentos e arquivos importantes.',
      icon: <FileText size={48} />,
      count: 'Não configurado'
    },
    {
      title: 'Base de Dados',
      description: 'Acesse e gerencie suas bases de dados e informações.',
      icon: <Database size={48} />,
      count: 'Não configurado'
    },
    {
      title: 'Armazenamento',
      description: 'Controle seu espaço de armazenamento na nuvem.',
      icon: <Cloud size={48} />,
      count: 'Não configurado'
    },
    {
      title: 'Configurações',
      description: 'Configure e personalize seus recursos do sistema.',
      icon: <Settings size={48} />,
      count: 'Não configurado'
    }
  ];

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
          Recursos
        </Typography>
        
        <Typography
          variant="h6"
          component="p"
          align="center"
          sx={{ mb: 6, color: 'text.secondary' }}
        >
          Gerencie todos os seus recursos e ferramentas em um só lugar
        </Typography>
        
        <Grid container spacing={4}>
          {resources.map((resource, index) => (
            <Grid item xs={12} md={6} lg={3} key={index}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1, textAlign: 'center' }}>
                  <Box sx={{ mb: 2, color: 'primary.main' }}>
                    {resource.icon}
                  </Box>
                  <Typography variant="h5" component="h2" gutterBottom>
                    {resource.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {resource.description}
                  </Typography>
                  <Typography variant="h6" color="text.secondary">
                    {resource.count}
                  </Typography>
                </CardContent>
                <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
                  <Button size="small" variant="contained">
                    Acessar
                  </Button>
                  <Button size="small" variant="outlined">
                    Configurar
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
        
        <Grid container spacing={4} sx={{ mt: 4 }}>
          <Grid item xs={12}>
            <Item>
              <Typography variant="h5" component="h2" gutterBottom>
                Uso de Recursos
              </Typography>
              <Typography color="text.secondary">
                Configure seus recursos para visualizar estatísticas de uso,
                gráficos de utilização e recomendações personalizadas de otimização.
              </Typography>
            </Item>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export default Resources;