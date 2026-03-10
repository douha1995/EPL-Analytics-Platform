'use client';

import {
  Box,
  Container,
  Flex,
  Heading,
  Image,
  Select,
  HStack,
} from '@chakra-ui/react';
import { useQuery, gql } from '@apollo/client';
import { useSeason } from '@/contexts/SeasonContext';
import { useTeam } from '@/contexts/TeamContext';
import { useEffect } from 'react';
import DataQualityIndicator from './DataQualityIndicator';
import TeamSelector from './TeamSelector';

const GET_SEASONS = gql`
  query GetSeasons($team: String) {
    seasons(team: $team)
  }
`;

export default function Header() {
  const { team } = useTeam();
  const { data } = useQuery(GET_SEASONS, {
    variables: { team },
    skip: !team,
  });
  const { season, setSeason } = useSeason();

  useEffect(() => {
    if (data?.seasons && data.seasons.length > 0 && !season) {
      setSeason(data.seasons[0]);
    }
  }, [data, season, setSeason]);

  return (
    <Box
      bg="rgba(255, 255, 255, 0.05)"
      backdropFilter="blur(20px)"
      borderBottom="1px solid rgba(255, 255, 255, 0.1)"
      py={4}
      position="sticky"
      top={0}
      zIndex={1000}
      boxShadow="0 8px 32px rgba(0, 0, 0, 0.3)"
    >
      <Container maxW="container.xl">
        <Flex align="center" justify="space-between">
          <HStack spacing={4}>
            <Box
              width="50px"
              height="50px"
              bg="linear-gradient(135deg, #37003C 0%, #04F5FF 100%)"
              borderRadius="xl"
              display="flex"
              alignItems="center"
              justifyContent="center"
              color="white"
              fontWeight="black"
              fontSize="xl"
              boxShadow="0 4px 20px rgba(55, 0, 60, 0.6)"
              border="2px solid rgba(4, 245, 255, 0.3)"
              position="relative"
              overflow="hidden"
              _before={{
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%)',
                animation: 'shimmer 3s infinite',
              }}
            >
              ⚽
            </Box>
            <Box>
              <Heading
                size="lg"
                bgGradient="linear(to-r, #37003C, #04F5FF, #FFFFFF)"
                bgClip="text"
                fontWeight="black"
                letterSpacing="tight"
              >
                EPL Analytics
              </Heading>
              <Box
                fontSize="xs"
                color="rgba(255, 255, 255, 0.6)"
                fontWeight="semibold"
                letterSpacing="wider"
                mt={-1}
              >
                PREMIER LEAGUE INSIGHTS
              </Box>
            </Box>
          </HStack>
          <HStack spacing={4}>
            <TeamSelector />
            {data?.seasons && data.seasons.length > 0 && (
              <Select
                value={season || data.seasons[0]}
                onChange={(e) => setSeason(e.target.value)}
                width="150px"
                bg="rgba(255, 255, 255, 0.05)"
                backdropFilter="blur(10px)"
                border="1px solid rgba(255, 255, 255, 0.1)"
                color="white"
                _hover={{
                  bg: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(239, 1, 7, 0.3)',
                }}
                _focus={{
                  border: '1px solid #EF0107',
                  boxShadow: '0 0 0 1px #EF0107',
                }}
                transition="all 0.3s ease"
              >
                {data.seasons.map((s: string) => (
                  <option key={s} value={s} style={{ background: '#001F3F', color: 'white' }}>
                    {s}
                  </option>
                ))}
              </Select>
            )}
            <DataQualityIndicator />
          </HStack>
        </Flex>
      </Container>
    </Box>
  );
}
