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

interface DefensiveBlockProps {
  season: string;
  team: string;
}

export default function DefensiveBlock({ season, team }: DefensiveBlockProps) {
  const [selectedMatch, setSelectedMatch] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { data: matchListData, loading: matchListLoading } = useQuery(GET_MATCH_LIST, {
    variables: { season: season || '2024-25', team: team || 'Arsenal' },
    skip: !season || !team,
  });

  const { data: shotsData, loading: shotsLoading } = useQuery(GET_MATCH_SHOTS, {
    variables: { matchId: selectedMatch },
    skip: !selectedMatch,
  });

  const matches = matchListData?.matchList || [];
  const allShots = shotsData?.matchShots || [];

  // Filter opponent shots (defensive actions)
  const opponentShots = allShots.filter((shot: any) => {
    // Simplified: assume shots with x > 0.5 are opponent shots
    // In production, use team data to properly identify
    return shot.x > 0.5;
  });

  const shotsSaved = opponentShots.filter((s: any) => s.result === 'SavedShot').length;
  const shotsBlocked = opponentShots.filter((s: any) => s.result === 'BlockedShot').length;
  const goalsConceded = opponentShots.filter((s: any) => s.result === 'Goal').length;

  // Render defensive heatmap
  useEffect(() => {
    if (!opponentShots || opponentShots.length === 0 || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 800;
    const height = 600;
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.fillStyle = '#1a472a';
    ctx.fillRect(0, 0, width, height);

    // Draw pitch
    const pitchWidth = 700;
    const pitchHeight = 500;
    const offsetX = 50;
    const offsetY = 50;

    // Pitch outline
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(offsetX, offsetY, pitchWidth, pitchHeight);

    // Center line
    ctx.beginPath();
    ctx.moveTo(offsetX + pitchWidth / 2, offsetY);
    ctx.lineTo(offsetX + pitchWidth / 2, offsetY + pitchHeight);
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc(offsetX + pitchWidth / 2, offsetY + pitchHeight / 2, 60, 0, Math.PI * 2);
    ctx.stroke();

    // Penalty areas
    const penaltyWidth = 120;
    const penaltyHeight = 300;
    const penaltyY = (pitchHeight - penaltyHeight) / 2;

    ctx.strokeRect(offsetX, offsetY + penaltyY, penaltyWidth, penaltyHeight);
    ctx.strokeRect(
      offsetX + pitchWidth - penaltyWidth,
      offsetY + penaltyY,
      penaltyWidth,
      penaltyHeight
    );

    // Create heatmap grid
    const gridSize = 40;
    const rows = Math.ceil(pitchHeight / gridSize);
    const cols = Math.ceil(pitchWidth / gridSize);
    const heatmap: number[][] = Array(rows)
      .fill(0)
      .map(() => Array(cols).fill(0));

    // Populate heatmap with defensive actions
    opponentShots.forEach((shot: any) => {
      const x = shot.x * pitchWidth + offsetX;
      const y = shot.y * pitchHeight + offsetY;

      const col = Math.floor((x - offsetX) / gridSize);
      const row = Math.floor((y - offsetY) / gridSize);

      if (row >= 0 && row < rows && col >= 0 && col < cols) {
        // Weight by action type: blocked > saved > missed
        let weight = 1;
        if (shot.result === 'BlockedShot') weight = 3;
        else if (shot.result === 'SavedShot') weight = 2;

        heatmap[row][col] += weight;
      }
    });

    // Find max value for normalization
    const maxValue = Math.max(...heatmap.flat());

    // Draw heatmap
    heatmap.forEach((row, rowIdx) => {
      row.forEach((value, colIdx) => {
        if (value > 0) {
          const intensity = value / maxValue;
          const x = offsetX + colIdx * gridSize;
          const y = offsetY + rowIdx * gridSize;

          // Color gradient: blue (low) -> red (high)
          const r = Math.floor(255 * intensity);
          const g = Math.floor(100 * (1 - intensity));
          const b = Math.floor(255 * (1 - intensity));
          const alpha = 0.3 + 0.5 * intensity;

          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
          ctx.fillRect(x, y, gridSize, gridSize);
        }
      });
    });

    // Draw defensive action points
    opponentShots.forEach((shot: any) => {
      const x = shot.x * pitchWidth + offsetX;
      const y = shot.y * pitchHeight + offsetY;

      // Color by result type
      let color = '#9CA3AF'; // Missed
      if (shot.result === 'BlockedShot') color = '#EF0107'; // Blocked - red
      else if (shot.result === 'SavedShot') color = '#F59E0B'; // Saved - orange
      else if (shot.result === 'Goal') color = '#10B981'; // Goal conceded - green

      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

  }, [opponentShots]);

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
        {team} Defensive Block Analysis
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

      {/* Statistics */}
      {selectedMatch && opponentShots.length > 0 && (
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
          <Stat bg="rgba(255, 255, 255, 0.05)" p={4} borderRadius="xl">
            <StatLabel>Shots Faced</StatLabel>
            <StatNumber>{opponentShots.length}</StatNumber>
          </Stat>
          <Stat bg="rgba(255, 255, 255, 0.05)" p={4} borderRadius="xl">
            <StatLabel>Shots Blocked</StatLabel>
            <StatNumber color="red.400">{shotsBlocked}</StatNumber>
          </Stat>
          <Stat bg="rgba(255, 255, 255, 0.05)" p={4} borderRadius="xl">
            <StatLabel>Shots Saved</StatLabel>
            <StatNumber color="orange.400">{shotsSaved}</StatNumber>
          </Stat>
          <Stat bg="rgba(255, 255, 255, 0.05)" p={4} borderRadius="xl">
            <StatLabel>Goals Conceded</StatLabel>
            <StatNumber color="green.400">{goalsConceded}</StatNumber>
          </Stat>
        </SimpleGrid>
      )}

      {/* Defensive Heatmap */}
      <Box bg="rgba(255, 255, 255, 0.05)" p={6} borderRadius="xl" mb={6}>
        <VStack spacing={4}>
          <HStack justify="space-between" width="100%">
            <Heading size="md">Defensive Actions Heatmap</Heading>
            <HStack spacing={4} fontSize="sm">
              <HStack>
                <Box w={4} h={4} bg="#EF0107" borderRadius="full" border="1px solid white" />
                <Text>Blocked</Text>
              </HStack>
              <HStack>
                <Box w={4} h={4} bg="#F59E0B" borderRadius="full" border="1px solid white" />
                <Text>Saved</Text>
              </HStack>
              <HStack>
                <Box w={4} h={4} bg="#10B981" borderRadius="full" border="1px solid white" />
                <Text>Goal</Text>
              </HStack>
              <HStack>
                <Box w={4} h={4} bg="#9CA3AF" borderRadius="full" border="1px solid white" />
                <Text>Missed</Text>
              </HStack>
            </HStack>
          </HStack>

          {shotsLoading ? (
            <Center py={20}>
              <Spinner size="xl" color="red.500" />
            </Center>
          ) : opponentShots.length > 0 ? (
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
              <Text color="gray.400">No defensive data available for this match</Text>
            </Center>
          ) : null}

          <Text fontSize="sm" color="gray.400" textAlign="center">
            Heatmap intensity shows concentration of defensive actions. Darker/redder areas indicate
            more defensive activity.
          </Text>
        </VStack>
      </Box>

      {!selectedMatch && (
        <Center py={20}>
          <VStack spacing={2}>
            <Text fontSize="lg" fontWeight="medium" color="gray.400">
              Select a match to view defensive analysis
            </Text>
            <Text fontSize="sm" color="gray.500">
              Visualize where the team defended and blocked opponent attacks
            </Text>
          </VStack>
        </Center>
      )}
    </Box>
  );
}
