import React from 'react';
import { Box, Container, Typography, Grid, Card, CardContent, CardActions, Button, Chip } from '@mui/material';
import { Wrench, Calculator, Palette, Code, Shield, Zap } from 'lucide-react';

function Tools() {
  const tools = [];

  const getStatusColor = (status) => {
    switch (status) {
      case 'Ativo': return 'success';
      case 'Beta': return 'warning';
      case 'Novo': return 'info';
      default: return 'default';
    }
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
          Ferramentas
        </Typography>
        
        <Typography
          variant="h6"
          component="p"
          align="center"
          sx={{ mb: 6, color: 'text.secondary' }}
        >
          Acesse uma variedade de ferramentas integradas para aumentar sua produtividade
        </Typography>
        
        {tools.length > 0 ? (
          <Grid container spacing={4}>
            {tools.map((tool, index) => (
              <Grid item xs={12} md={6} lg={4} key={index}>
                <Card 
                  sx={{ 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column',
                    transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-5px)',
                      boxShadow: 6
                    }
                  }}
                >
                  <CardContent sx={{ flexGrow: 1, textAlign: 'center' }}>
                    <Box sx={{ mb: 2, color: 'primary.main' }}>
                      {tool.icon}
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Chip 
                        label={tool.category} 
                        size="small" 
                        variant="outlined"
                      />
                      <Chip 
                        label={tool.status} 
                        size="small" 
                        color={getStatusColor(tool.status)}
                      />
                    </Box>
                    
                    <Typography variant="h5" component="h2" gutterBottom>
                      {tool.title}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary">
                      {tool.description}
                    </Typography>
                  </CardContent>
                  
                  <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
                    <Button size="small" variant="contained">
                      Abrir
                    </Button>
                    <Button size="small" variant="outlined">
                      Detalhes
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Wrench size={64} style={{ color: '#666', marginBottom: '16px' }} />
            <Typography variant="h5" gutterBottom color="text.secondary">
              Nenhuma ferramenta configurada
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Adicione suas ferramentas personalizadas para aumentar sua produtividade
            </Typography>
            <Button variant="contained" size="large">
              Adicionar Primeira Ferramenta
            </Button>
          </Box>
        )}
        
        {tools.length > 0 && (
          <Box sx={{ mt: 6, textAlign: 'center' }}>
            <Typography variant="h5" gutterBottom>
              Precisa de uma ferramenta específica?
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Adicione novas ferramentas ou configure integrações personalizadas.
            </Typography>
            <Button variant="contained" size="large">
              Adicionar Ferramenta
            </Button>
          </Box>
        )}
      </Container>
    </Box>
  );
}

export default Tools;