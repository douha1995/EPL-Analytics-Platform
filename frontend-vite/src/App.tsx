import { Container, Tabs, TabList, TabPanels, Tab, TabPanel, Box } from '@chakra-ui/react'
import Header from './components/Header'
import Footer from './components/Footer'
import { SeasonProvider, useSeason } from './contexts/SeasonContext'
import { TeamProvider, useTeam } from './contexts/TeamContext'
import SeasonOverview from './components/dashboards/SeasonOverview'
import MatchDetail from './components/dashboards/MatchDetail'
import PlayerStats from './components/dashboards/PlayerStats'
import TacticalAnalysis from './components/dashboards/TacticalAnalysis'
import ShotNetworks from './components/dashboards/ShotNetworks'
import ExpectedThreat from './components/dashboards/ExpectedThreat'
import PlayerMatchAnalysis from './components/dashboards/PlayerMatchAnalysis'
import OpponentAnalysis from './components/dashboards/OpponentAnalysis'
import PerformanceTrends from './components/dashboards/PerformanceTrends'
import PlayerComparison from './components/dashboards/PlayerComparison'
import MatchInsights from './components/dashboards/MatchInsights'
import { PassingNetwork, DefensiveBlock, ProgressivePasses, ZoneAnalysis } from './components/dashboards/advanced'
import AIChatbot from './components/AIChatbot'

function AppContent() {
  const { season } = useSeason()
  const { team } = useTeam()
  const currentSeason = season || '2024-25'
  const currentTeam = team || 'Arsenal'

  return (
    <Box minH="100vh">
      <Header />
      <Container maxW="container.xl" py={8}>
        <Tabs
          colorScheme="arsenal"
          variant="line"
        >
          <TabList
            overflowX="auto"
            overflowY="hidden"
            flexWrap="wrap"
            css={{
              '&::-webkit-scrollbar': {
                height: '6px',
              },
              '&::-webkit-scrollbar-track': {
                background: 'rgba(255, 255, 255, 0.05)',
              },
              '&::-webkit-scrollbar-thumb': {
                background: '#EF0107',
                borderRadius: '3px',
              },
            }}
          >
            <Tab>📊 Season Overview</Tab>
            <Tab>⚽ Match Detail</Tab>
            <Tab>👤 Player Stats</Tab>
            <Tab>📈 Tactical Analysis</Tab>
            <Tab>🔗 Shot Networks</Tab>
            <Tab>📍 Expected Threat</Tab>
            <Tab>🔥 Player Match</Tab>
            <Tab>🆚 Opponent Analysis</Tab>
            <Tab>📉 Performance Trends</Tab>
            <Tab>⚖️ Player Comparison</Tab>
            <Tab>💡 Match Insights</Tab>
            <Tab>🔀 Passing Network</Tab>
            <Tab>🛡️ Defensive Block</Tab>
            <Tab>➡️ Progressive Passes</Tab>
            <Tab>📐 Zone Analysis</Tab>
          </TabList>

          <TabPanels>
            <TabPanel>
              <SeasonOverview season={currentSeason} team={currentTeam} />
            </TabPanel>
            <TabPanel>
              <MatchDetail season={currentSeason} team={currentTeam} />
            </TabPanel>
            <TabPanel>
              <PlayerStats season={currentSeason} team={currentTeam} />
            </TabPanel>
            <TabPanel>
              <TacticalAnalysis season={currentSeason} team={currentTeam} />
            </TabPanel>
            <TabPanel>
              <ShotNetworks season={currentSeason} team={currentTeam} />
            </TabPanel>
            <TabPanel>
              <ExpectedThreat season={currentSeason} team={currentTeam} />
            </TabPanel>
            <TabPanel>
              <PlayerMatchAnalysis season={currentSeason} team={currentTeam} />
            </TabPanel>
            <TabPanel>
              <OpponentAnalysis season={currentSeason} team={currentTeam} />
            </TabPanel>
            <TabPanel>
              <PerformanceTrends season={currentSeason} team={currentTeam} />
            </TabPanel>
            <TabPanel>
              <PlayerComparison season={currentSeason} team={currentTeam} />
            </TabPanel>
            <TabPanel>
              <MatchInsights season={currentSeason} team={currentTeam} />
            </TabPanel>
            <TabPanel>
              <PassingNetwork season={currentSeason} team={currentTeam} />
            </TabPanel>
            <TabPanel>
              <DefensiveBlock season={currentSeason} team={currentTeam} />
            </TabPanel>
            <TabPanel>
              <ProgressivePasses season={currentSeason} team={currentTeam} />
            </TabPanel>
            <TabPanel>
              <ZoneAnalysis season={currentSeason} team={currentTeam} />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Container>
      <Footer />
      <AIChatbot />
    </Box>
  )
}

function App() {
  return (
    <TeamProvider>
      <SeasonProvider>
        <AppContent />
      </SeasonProvider>
    </TeamProvider>
  )
}

export default App
