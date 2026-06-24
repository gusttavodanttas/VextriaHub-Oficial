import React from 'react';
import { Box, Container, Typography, Grid, Paper } from '@mui/material';
import { styled } from '@mui/material/styles';

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

function Home() {
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
          Welcome to Vextria Hub
        </Typography>
        <Grid container spacing={4}>
          <Grid item xs={12} md={4}>
            <Item>
              <Typography variant="h5" component="h2" gutterBottom>
                Resource Management
              </Typography>
              <Typography>
                Efficiently organize and manage your resources in one central location.
              </Typography>
            </Item>
          </Grid>
          <Grid item xs={12} md={4}>
            <Item>
              <Typography variant="h5" component="h2" gutterBottom>
                Tool Integration
              </Typography>
              <Typography>
                Access and integrate various tools seamlessly within the platform.
              </Typography>
            </Item>
          </Grid>
          <Grid item xs={12} md={4}>
            <Item>
              <Typography variant="h5" component="h2" gutterBottom>
                Analytics
              </Typography>
              <Typography>
                Track and analyze your resource usage and performance metrics.
              </Typography>
            </Item>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export default Home;