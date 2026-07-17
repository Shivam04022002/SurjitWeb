import { useNavigate } from 'react-router-dom'
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Container
} from '@mui/material'
import {
  Inventory,
  Work,
  WorkOutline,
  PhotoLibrary,
  PermMedia,
  People,
  Info,
  Settings
} from '@mui/icons-material'
import { DASHBOARD_CARDS } from '../utils/constants'

const iconMap = {
  Inventory,
  Work,
  WorkOutline,
  PhotoLibrary,
  PermMedia,
  People,
  Info,
  Settings
}

const DashboardPage = () => {
  const navigate = useNavigate()

  return (
    <Container maxWidth="xl" disableGutters>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: 700 }}>
        Dashboard
      </Typography>

      <Grid container spacing={3}>
        {DASHBOARD_CARDS.map((card) => {
          const Icon = iconMap[card.icon]
          return (
            <Grid item xs={12} sm={6} md={4} lg={3} key={card.title}>
              <Card
                sx={{
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4
                  }
                }}
                onClick={() => card.path !== '#' && navigate(card.path)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: 'rgba(26, 35, 126, 0.1)',
                        color: 'primary.main',
                        mr: 2
                      }}
                    >
                      <Icon sx={{ fontSize: 32 }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {card.title}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {card.title} management module placeholder.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          )
        })}
      </Grid>
    </Container>
  )
}

export default DashboardPage
