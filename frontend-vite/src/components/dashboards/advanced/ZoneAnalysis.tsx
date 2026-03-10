'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, gql } from '@apollo/client';
import {
  Box,
  Heading,
  Select,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  Spinner,
  Center,
  Text,
  HStack,
  VStack,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Badge,
} from '@chakra-ui/react';
import * as d3 from 'd3';

const GET_MATCH_LIST = gql`
  query GetMatchList($season: String!, $team: String!) {
    matchList(season: $season, team: $team) {
      matchId
      matchName
      matchDate
    }
  }
`;

const GET_MATCH_SHOTS = gql`
  query GetMatchShots($matchId: String!, $team: String) {
    matchShots(matchId: $matchId, team: $team) {
      x
      y
      xg
      result
      playerName
      minute
      team
    }
  }
`;

interface ZoneAnalysisProps {
  season: string;
  team: string;
}

export default function ZoneAnalysis({ season, team }: ZoneAnalysisProps) {
  const [selectedMatch, setSelectedMatch] = useState<string>('');
  const [activeZone, setActiveZone] = useState<'zone14' | 'halfspace'>('zone14');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { data: matchListData, loading: matchListLoading } = useQuery(GET_MATCH_LIST, {
    variables: { season: season || '2024-25', team: team || 'Arsenal' },
    skip: !season || !team,
  });

  const { data: shotsData, loading: shotsLoading } = useQuery(GET_MATCH_SHOTS, {
    variables: { matchId: selectedMatch, team: team },
    skip: !selectedMatch,
  });

  const matches = matchListData?.matchList || [];
  const shots = shotsData?.matchShots || [];

  // Define Zone 14 (central area just outside penalty box)
  const isInZone14 = (x: number, y: number): boolean => {
    return x >= 0.65 && x <= 0.85 && y >= 0.3 && y <= 0.7;
  };

  // Define Half-Spaces (channels between center and wings)
  const isInHalfSpace = (x: number, y: number): { isIn: boolean; side: 'left' | 'right' | null } => {
    const leftHalfSpace = x >= 0.5 && x <= 0.8 && y >= 0.15 && y <= 0.35;
    const rightHalfSpace = x >= 0.5 && x <= 0.8 && y >= 0.65 && y <= 0.85;

    if (leftHalfSpace) return { isIn: true, side: 'left' };
    if (rightHalfSpace) return { isIn: true, side: 'right' };
    return { isIn: false, side: null };
  };

  // Calculate zone statistics
  const zone14Shots = shots.filter((s: any) => isInZone14(s.x, s.y));
  const zone14Goals = zone14Shots.filter((s: any) => s.result === 'Goal').length;
  const zone14Xg = zone14Shots.reduce((sum: number, s: any) => sum + s.xg, 0);

  const halfSpaceShots = shots.filter((s: any) => isInHalfSpace(s.x, s.y).isIn);
  const leftHalfSpaceShots = shots.filter((s: any) => isInHalfSpace(s.x, s.y).side === 'left');
  const rightHalfSpaceShots = shots.filter((s: any) => isInHalfSpace(s.x, s.y).side === 'right');

  // Render zone visualization
  useEffect(() => {
    if (!shots || shots.length === 0 || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 900;
    const height = 600;
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.fillStyle = '#1a472a';
    ctx.fillRect(0, 0, width, height);

    // Pitch dimensions
    const pitchWidth = 800;
    const pitchHeight = 500;
    const offsetX = 50;
    const offsetY = 50;

    // Draw pitch
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(offsetX, offsetY, pitchWidth, pitchHeight);

    // Center line
    ctx.beginPath();
    ctx.moveTo(offsetX + pitchWidth / 2, offsetY);
    ctx.lineTo(offsetX + pitchWidth / 2, offsetY + pitchHeight);
    ctx.stroke();

    // Penalty box
    const penaltyWidth = 120;
    const penaltyHeight = 300;
    const penaltyY = (pitchHeight - penaltyHeight) / 2;
    ctx.strokeRect(
      offsetX + pitchWidth - penaltyWidth,
      offsetY + penaltyY,
      penaltyWidth,
      penaltyHeight
    );

    if (activeZone === 'zone14') {
      // Highlight Zone 14
      const zone14X = offsetX + pitchWidth * 0.65;
      const zone14Y = offsetY + pitchHeight * 0.3;
      const zone14Width = pitchWidth * 0.2;
      const zone14Height = pitchHeight * 0.4;

      // Draw hexagonal grid pattern in Zone 14
      ctx.fillStyle = 'rgba(239, 1, 7, 0.15)';
      ctx.fillRect(zone14X, zone14Y, zone14Width, zone14Height);

      ctx.strokeStyle = '#EF0107';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(zone14X, zone14Y, zone14Width, zone14Height);
      ctx.setLineDash([]);

      // Draw hexagon pattern
      const hexSize = 30;
      const hexHeight = hexSize * Math.sqrt(3);

      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 4; col++) {
          const x = zone14X + col * hexSize * 1.5 + hexSize;
          const y = zone14Y + row * hexHeight * 0.75 + hexHeight / 2;

          // Offset every other row
          const offsetCol = row % 2 === 0 ? 0 : hexSize * 0.75;

          // Count shots in this hexagon
          const shotsInHex = zone14Shots.filter((shot: any) => {
            const shotX = offsetX + shot.x * pitchWidth;
            const shotY = offsetY + shot.y * pitchHeight;
            const distance = Math.sqrt(Math.pow(shotX - (x + offsetCol), 2) + Math.pow(shotY - y, 2));
            return distance < hexSize / 2;
          }).length;

          if (shotsInHex > 0) {
            const intensity = Math.min(shotsInHex / 3, 1);
            ctx.fillStyle = `rgba(239, 1, 7, ${0.3 + intensity * 0.5})`;
            drawHexagon(ctx, x + offsetCol, y, hexSize / 2);
            ctx.fill();
          }

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.lineWidth = 1;
          drawHexagon(ctx, x + offsetCol, y, hexSize / 2);
          ctx.stroke();
        }
      }

      // Label
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('ZONE 14', zone14X + zone14Width / 2, zone14Y - 10);

    } else {
      // Highlight Half-Spaces
      const halfSpaceWidth = pitchWidth * 0.3;
      const halfSpaceHeight = pitchHeight * 0.2;
      const halfSpaceX = offsetX + pitchWidth * 0.5;

      // Left half-space
      const leftY = offsetY + pitchHeight * 0.15;
      ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
      ctx.fillRect(halfSpaceX, leftY, halfSpaceWidth, halfSpaceHeight);

      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(halfSpaceX, leftY, halfSpaceWidth, halfSpaceHeight);

      // Right half-space
      const rightY = offsetY + pitchHeight * 0.65;
      ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
      ctx.fillRect(halfSpaceX, rightY, halfSpaceWidth, halfSpaceHeight);

      ctx.strokeStyle = '#F59E0B';
      ctx.strokeRect(halfSpaceX, rightY, halfSpaceWidth, halfSpaceHeight);
      ctx.setLineDash([]);

      // Labels
      ctx.fillStyle = '#10B981';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('LEFT HALF-SPACE', halfSpaceX + halfSpaceWidth / 2, leftY - 10);

      ctx.fillStyle = '#F59E0B';
      ctx.fillText('RIGHT HALF-SPACE', halfSpaceX + halfSpaceWidth / 2, rightY - 10);
    }

    // Draw shots
    shots.forEach((shot: any) => {
      const x = offsetX + shot.x * pitchWidth;
      const y = offsetY + shot.y * pitchHeight;

      let color = '#9CA3AF';
      let radius = 5;

      if (activeZone === 'zone14' && isInZone14(shot.x, shot.y)) {
        color = shot.result === 'Goal' ? '#10B981' : '#EF0107';
        radius = 7;
      } else if (activeZone === 'halfspace' && isInHalfSpace(shot.x, shot.y).isIn) {
        const { side } = isInHalfSpace(shot.x, shot.y);
        color = side === 'left' ? '#10B981' : '#F59E0B';
        radius = 7;
      }

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

  }, [shots, activeZone]);

  // Helper function to draw hexagon
  const drawHexagon = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const px = x + size * Math.cos(angle);
      const py = y + size * Math.sin(angle);
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
  };

  if (matchListLoading) {
    return (
      <Center py={10}>
        <Spinner size="xl" color="red.500" />
      </Center>
    );
  }

  return (
    <Box>
      <Heading size="lg" mb={6}>
        {team} Zone Analysis
      </Heading>

      {/* Match Selector */}
      <Box mb={6}>
        <Text mb={2} fontWeight="medium">
          Select Match
        </Text>
        <Select
          placeholder="Choose a match"
          value={selectedMatch}
          onChange={(e) => setSelectedMatch(e.target.value)}
          bg="rgba(255, 255, 255, 0.05)"
          size="lg"
        >
          {matches.map((match: any) => (
            <option key={match.matchId} value={match.matchId}>
              {match.matchName} - {new Date(match.matchDate).toLocaleDateString()}
            </option>
          ))}
        </Select>
      </Box>

      {/* Zone Type Selector */}
      {selectedMatch && (
        <Tabs
          index={activeZone === 'zone14' ? 0 : 1}
          onChange={(idx) => setActiveZone(idx === 0 ? 'zone14' : 'halfspace')}
          colorScheme="red"
          mb={6}
        >
          <TabList>
            <Tab>Zone 14 Analysis</Tab>
            <Tab>Half-Space Analysis</Tab>
          </TabList>
        </Tabs>
      )}

      {/* Statistics */}
      {selectedMatch && shots.length > 0 && (
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
          {activeZone === 'zone14' ? (
            <>
              <Stat bg="rgba(255, 255, 255, 0.05)" p={4} borderRadius="xl">
                <StatLabel>Zone 14 Shots</StatLabel>
                <StatNumber color="red.400">{zone14Shots.length}</StatNumber>
              </Stat>
              <Stat bg="rgba(255, 255, 255, 0.05)" p={4} borderRadius="xl">
                <StatLabel>Goals from Zone 14</StatLabel>
                <StatNumber color="green.400">{zone14Goals}</StatNumber>
              </Stat>
              <Stat bg="rgba(255, 255, 255, 0.05)" p={4} borderRadius="xl">
                <StatLabel>Zone 14 xG</StatLabel>
                <StatNumber>{zone14Xg.toFixed(2)}</StatNumber>
              </Stat>
              <Stat bg="rgba(255, 255, 255, 0.05)" p={4} borderRadius="xl">
                <StatLabel>Conversion Rate</StatLabel>
                <StatNumber>
                  {zone14Shots.length > 0 ? ((zone14Goals / zone14Shots.length) * 100).toFixed(1) : 0}%
                </StatNumber>
              </Stat>
            </>
          ) : (
            <>
              <Stat bg="rgba(255, 255, 255, 0.05)" p={4} borderRadius="xl">
                <StatLabel>Half-Space Shots</StatLabel>
                <StatNumber>{halfSpaceShots.length}</StatNumber>
              </Stat>
              <Stat bg="rgba(255, 255, 255, 0.05)" p={4} borderRadius="xl">
                <StatLabel>Left Half-Space</StatLabel>
                <StatNumber color="green.400">{leftHalfSpaceShots.length}</StatNumber>
              </Stat>
              <Stat bg="rgba(255, 255, 255, 0.05)" p={4} borderRadius="xl">
                <StatLabel>Right Half-Space</StatLabel>
                <StatNumber color="orange.400">{rightHalfSpaceShots.length}</StatNumber>
              </Stat>
              <Stat bg="rgba(255, 255, 255, 0.05)" p={4} borderRadius="xl">
                <StatLabel>Goals</StatLabel>
                <StatNumber>
                  {halfSpaceShots.filter((s: any) => s.result === 'Goal').length}
                </StatNumber>
              </Stat>
            </>
          )}
        </SimpleGrid>
      )}

      {/* Zone Visualization */}
      <Box bg="rgba(255, 255, 255, 0.05)" p={6} borderRadius="xl" mb={6}>
        <VStack spacing={4}>
          <HStack justify="space-between" width="100%">
            <Heading size="md">
              {activeZone === 'zone14' ? 'Zone 14 Heat Map' : 'Half-Space Activity'}
            </Heading>
          </HStack>

          {shotsLoading ? (
            <Center py={20}>
              <Spinner size="xl" color="red.500" />
            </Center>
          ) : shots.length > 0 ? (
            <Box width="100%" overflow="auto">
              <canvas
                ref={canvasRef}
                style={{
                  display: 'block',
                  margin: '0 auto',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                }}
              />
            </Box>
          ) : selectedMatch ? (
            <Center py={20}>
              <Text color="gray.400">No zone data available for this match</Text>
            </Center>
          ) : null}

          <Box width="100%" p={4} bg="rgba(0,0,0,0.2)" borderRadius="md">
            <Text fontSize="sm" fontWeight="bold" mb={2}>
              Tactical Insight:
            </Text>
            <Text fontSize="sm" color="gray.300">
              {activeZone === 'zone14' ? (
                <>
                  <strong>Zone 14</strong> (the "Hole") is the area just outside the penalty box in
                  central positions. It's considered one of the most dangerous zones to receive the ball
                  as it allows time on the ball while being close to goal.
                </>
              ) : (
                <>
                  <strong>Half-Spaces</strong> are the channels between the center and wings. Attacks
                  through these zones are harder to defend as they exploit gaps between center-backs
                  and full-backs.
                </>
              )}
            </Text>
          </Box>
        </VStack>
      </Box>

      {!selectedMatch && (
        <Center py={20}>
          <VStack spacing={2}>
            <Text fontSize="lg" fontWeight="medium" color="gray.400">
              Select a match to view zone analysis
            </Text>
            <Text fontSize="sm" color="gray.500">
              Analyze activity in key tactical zones: Zone 14 and Half-Spaces
            </Text>
          </VStack>
        </Center>
      )}
    </Box>
  );
}
